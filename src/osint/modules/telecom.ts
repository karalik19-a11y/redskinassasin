/**
 * MODULE: telecom — phone number intelligence
 * ---------------------------------------------------------------------------
 * Offline by default (no network needed for routing intelligence):
 *   • E.164 normalisation + numbering-plan validation (60+ calling codes)
 *   • DEF-code → operator + home region matrix for Russian/CIS numbering
 *     (explicitly modelled as *historical* data: MNP means the current carrier
 *     can differ, which the module states instead of pretending certainty)
 *   • MVNO / virtual-number detection (numbers sold by aggregators)
 *   • messenger reachability map (Telegram / WhatsApp / Viber / Signal)
 *   • directory & spam-database pivots (NumBuster, Truecaller, GetContact)
 *   • risk factors: virtual numbers, VoIP ranges, PII in phone-number dumps
 */

import type { ModuleInput, ModuleResult, OsintModule } from '../types/module';
import { parsePhone, COUNTRY_CALLING_CODES } from '../algo/normalize';
import { RU_DEF_MATRIX, identifyDefRange } from '../datasets/defCodes';
import { evidence, entity, edge, pivot, risk, DIRECTORY_LINKS } from './common';

const MODULE_ID = 'telecom.phone';

function messengerLinks(e164: string): Record<string, string> {
  const digits = e164.replace(/\D/g, '');
  return {
    telegram: `https://t.me/+${digits}`,
    whatsapp: `https://wa.me/${digits}`,
    viber: `viber://chat?number=%2B${digits}`,
    signal: `https://signal.me/#p/+${digits}`,
    numbuster: `https://numbuster.com/en/phone/+${digits}`,
    truecaller: `https://www.truecaller.com/search/ru/${digits}`,
    getcontact: `https://getcontact.com/ru/search?q=%2B${digits}`,
    telesearch: `https://telesearch.bot/?phone=+${digits}`,
    leakcheck: DIRECTORY_LINKS.leakcheck(`+${digits}`),
  };
}

export const telecomModule: OsintModule = {
  id: MODULE_ID,
  name: 'Телеком-разведка (номер → оператор, регион, мессенджеры)',
  category: 'telecom',
  description:
    'Канонизирует номер в E.164, проверяет соответствие плану нумерации, определяет оператора и домашний регион по DEF-коду, помечает виртуальные/MVNO-диапазоны, строит карту мессенджеров и справочников для пробивки.',
  accepts: ['phone'],
  produces: ['location', 'messenger_account', 'person', 'social_profile'],
  requiresNetwork: false,
  cost: 0.2,
  priority: 95,
  tags: ['telecom', 'offline', 'routing'],
  dataSources: ['План нумерации РФ (DEF-коды, исторические данные)', 'ITU-T E.164', 'Справочники NumBuster / Truecaller'],
  run(input: ModuleInput): ModuleResult {
    const parsed = parsePhone(input.entity.label || input.entity.value, 'RU');
    const source = { name: 'Матрица DEF-кодов и план нумерации (локальный набор данных)', kind: 'dataset' as const };
    const out: ModuleResult = { evidence: [], entities: [], edges: [], riskFactors: [], pivots: [], notes: [] };

    if (!parsed.e164) {
      return { notes: [`Номер «${input.entity.value}» не удалось привести к формату E.164`] };
    }

    const digits = parsed.e164.replace(/\D/g, '');
    const isRussian = digits.startsWith('7') && digits.length === 11;
    const defCode = isRussian ? digits.slice(1, 4) : undefined;
    const matrixEntry = defCode ? identifyDefRange(defCode) : undefined;

    out.evidence?.push(
      evidence('phone.e164', `Канонический формат: ${parsed.e164}`, parsed.e164, source, { reliability: 0.99 }),
      evidence('phone.country', `Страна: ${parsed.country ?? 'не определена'}`, parsed.country ?? 'unknown', source, { reliability: 0.9, tags: ['geo'] }),
      evidence('phone.numbering-plan', `Соответствие плану нумерации: ${parsed.isValid ? 'да' : 'нет'}${parsed.error ? ` (${parsed.error})` : ''}`, parsed.isValid, source, { reliability: 0.9 }),
      evidence('phone.messengers', 'Карта прямой связи в мессенджерах и справочниках', messengerLinks(parsed.e164), { name: 'Генерация deep-link (локально)', kind: 'algorithm' }, { reliability: 0.95, tags: ['pivot-links'] }),
    );

    if (matrixEntry) {
      out.evidence?.push(
        evidence('phone.carrier', `Оператор по DEF-коду ${defCode}: ${matrixEntry.operator} (${matrixEntry.category})`, matrixEntry.operator, source, { reliability: 0.78, tags: ['mnp-caveat'] }),
        evidence('phone.home-region', `Домашний регион диапазона: ${matrixEntry.region}`, matrixEntry.region, source, { reliability: 0.75, tags: ['geo'] }),
        evidence('phone.mnp-warning', 'DEF-код отражает первоначального оператора диапазона; из-за MNP текущий оператор может отличаться (проверка — только у оператора связи)', true, source, { reliability: 0.99, tags: ['caveat'] }),
      );
      out.pivots?.push(pivot('location', matrixEntry.region, { relation: 'resides_at', confidence: 0.5, reason: `Исторический домашний регион DEF-диапазона ${defCode}`, from: input.entity.id }));
      out.entities?.push(entity('service', `Оператор: ${matrixEntry.operator}`, { label: matrixEntry.operator, tags: ['carrier'] }));
      out.edges?.push(edge(input.entity.id, { type: 'service', value: `Оператор: ${matrixEntry.operator}` }, 'uses', 0.7, 0.75));

      if (matrixEntry.category === 'MVNO') {
        out.riskFactors?.push(risk('reputation.scam-reports', 0.35, `Номер обслуживается виртуальным оператором (MVNO) — типично для «одноразовых» и массово закупаемых номеров`, [], { label: 'MVNO / виртуальный оператор' }));
      }
      if (/VoIP|виртуальн/i.test(matrixEntry.notes ?? '')) {
        out.riskFactors?.push(risk('cyber.anonymity-infrastructure', 0.4, 'Диапазон относится к VoIP/виртуальной нумерации — слабее верифицируется как персональный', []));
      }
    } else if (isRussian) {
      // 700-код: newest allocations, often MVNO/telecom aggregators
      out.evidence?.push(evidence('phone.carrier', `DEF-код ${defCode} отсутствует в матрице: вероятно новейшие или MVNO-диапазоны (700x, 999x)`, 'unknown', source, { reliability: 0.6 }));
      out.notes?.push('DEF-код не распознан — оператор определяется только через биллинг/оператора связи');
    }

    // Alternative notations as aliases improve dedup against other sources.
    const aliases = [parsed.e164, `+${digits}`, digits, `8${digits.slice(1)}`, `${digits.slice(1, 4)} ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`];
    out.entities?.push(entity('phone', parsed.e164, { label: input.entity.label, tags: ['canonical'], properties: { country: parsed.country, carrierHistorical: matrixEntry?.operator } }));
    for (const alias of [...new Set(aliases)]) {
      if (alias !== parsed.e164) out.notes?.push(`Вариант записи для дедупликации: ${alias}`);
    }

    // Pivot a person probe: directories frequently reveal the subscriber name.
    out.pivots?.push(pivot('person', `Абонент ${parsed.e164}`, { relation: 'owns', confidence: 0.3, reason: 'Справочники/утечки могут дать ФИО абонента', from: input.entity.id }));

    out.metrics = {
      defCode: defCode ?? 'n/a',
      matrixSize: Object.keys(RU_DEF_MATRIX).length,
      country: parsed.country ?? 'unknown',
      numberingPlanValid: parsed.isValid ? 1 : 0,
    };
    return out;
  },
};

export const telecomModules = [telecomModule];
export { COUNTRY_CALLING_CODES };
