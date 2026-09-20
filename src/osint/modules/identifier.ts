/**
 * MODULE: identifier — algorithmic validation of identifiers (no network)
 * ---------------------------------------------------------------------------
 * The foundation of pivoting: before an identifier enters the graph it is
 * verified arithmetically. A fabricated ИНН, a mistyped VIN or an invalid
 * IBAN is either dropped or explicitly flagged — which prevents fabricated
 * data from propagating through the whole investigation.
 */

import type { ModuleInput, ModuleContext, ModuleResult, OsintModule } from '../types/module';
import { validateInn, validateSnils, validateOgrn, validateOgrnip, validateBik, validatePassportRf, parseRuPlate, decodeVin, validateCadastralNumber, regionByCode } from '../algo/ruIdentifiers';
import { validateIban, validateEan, validateImei, validateIccid, isValidVerhoeff } from '../algo/checksums';
import { normalizeDomain, registrableDomain } from '../algo/normalize';
import { dgaScore, looksBase64, looksHex, shannonEntropy } from '../algo/entropy';
import { evidence, entity, edge, pivot, risk, DIRECTORY_LINKS } from './common';

const MODULE_ID = 'identity.identifiers';

export const identifierModule: OsintModule = {
  id: MODULE_ID,
  name: 'Алгоритмическая валидация идентификаторов',
  category: 'identity',
  description:
    'Проверяет контрольные суммы ИНН, СНИЛС, ОГРН/ОГРНИП, БИК, КПП, паспорта РФ, ВУ, ГРЗ, VIN, IBAN, IMEI, ICCID, EAN. Дополнительно: гео-атрибуция по коду региона, разбор структуры, оценка «алгоритмической» генерации доменов.',
  accepts: ['tax_id', 'document', 'organization', 'bank_account', 'vehicle', 'real_estate', 'domain', 'subdomain', 'ip', 'username', 'url'],
  produces: ['location', 'organization', 'person', 'domain', 'vehicle', 'bank_account', 'document'],
  requiresNetwork: false,
  cost: 0.1,
  priority: 100,
  tags: ['checksums', 'offline', 'quality-gate'],
  dataSources: ['ФНС (алгоритмы ИНН/ОГРН/КПП)', 'ПФР (СНИЛС)', 'ЦБ РФ (БИК)', 'Росреестр (кадастр)', 'ISO 3779 (VIN)', 'ISO 13616 (IBAN)', '3GPP TS 23.003 (IMEI)'],
  run(input: ModuleInput, _ctx: ModuleContext): ModuleResult {
    const value = input.entity.value;
    const out: ModuleResult = { evidence: [], riskFactors: [], pivots: [], notes: [] };
    const source = { name: 'Алгоритмическая проверка (локально)', kind: 'algorithm' as const };

    switch (input.entity.type) {
      case 'tax_id': {
        const check = validateInn(value);
        out.evidence?.push(
          evidence('tax_id.checksum', `Контрольная сумма ИНН ${check.isValid ? 'подтверждена' : 'не подтверждена'} (ФНС)`, check.isValid ? 'valid' : 'invalid', source, {
            reliability: 0.98,
            tags: ['fns', 'checksum'],
          }),
          evidence('tax_id.kind', check.type, check.type, source, { reliability: 0.99 }),
          evidence('tax_id.region', String(check.region ?? 'не определён'), check.region ?? 'не определён', source, { reliability: 0.9, tags: ['geo'] }),
          evidence('tax_id.verify-url', 'Официальная проверка в ЕГРЮЛ/ЕГРИП', String(check.details.verifyUrl ?? DIRECTORY_LINKS.egrul(value)), source, { reliability: 0.8 }),
        );
        if (!check.isValid) {
          out.riskFactors?.push(risk('identity.pii-in-breaches', 0.2, `ИНН ${value} не проходит проверку контрольной цифры ФНС — возможна фабрикация или опечатка`, [], { label: 'Недостоверный идентификатор' }));
        }
        const regionCode = value.slice(0, 2);
        const region = regionByCode(regionCode);
        if (region) {
          out.pivots?.push(pivot('location', `${region.name}`, { relation: 'registered_at', confidence: 0.6, reason: `Код региона ${regionCode} в ИНН` }));
        }
        break;
      }

      case 'document': {
        const digits = value.replace(/\D/g, '');
        if (digits.length === 11) {
          const snils = validateSnils(digits);
          out.evidence?.push(
            evidence('document.snils-checksum', `СНИЛС ${snils.isValid ? 'валиден' : 'невалиден'} по алгоритму ПФР`, snils.isValid ? 'valid' : 'invalid', source, { reliability: 0.98, tags: ['pfr', 'pii'] }),
            evidence('document.snils-archive', `Архивный диапазон: ${snils.details.archive ? 'да' : 'нет'}`, Boolean(snils.details.archive), source, { reliability: 0.95 }),
          );
        } else if (digits.length === 10) {
          const passport = validatePassportRf(digits.slice(0, 4), digits.slice(4));
          out.evidence?.push(
            evidence('document.passport-region', `Регион выдачи паспорта: ${passport.region ?? 'не определён'}`, passport.region ?? 'unknown', source, { reliability: 0.85, tags: ['mvd', 'pii'] }),
            evidence('document.passport-year', `Год выдачи бланка: ${passport.details.issueYear}`, String(passport.details.issueYear), source, { reliability: 0.8 }),
          );
          out.riskFactors?.push(risk('identity.documents-exposed', 0.7, 'В расследовании присутствует номер паспорта РФ — критичный объём ПДн для мошенничества', [], { label: 'Номер паспорта РФ в обороте' }));
        }
        break;
      }

      case 'organization': {
        const digits = value.replace(/\D/g, '');
        const check = digits.length === 13 ? validateOgrn(digits) : validateOgrnip(digits);
        out.evidence?.push(
          evidence('organization.ogrn-checksum', `${check.type}: контрольная цифра ${check.isValid ? 'верна' : 'неверна'}`, check.isValid ? 'valid' : 'invalid', source, { reliability: 0.98, tags: ['fns'] }),
          evidence('organization.registration-year', `Год регистрации: ${check.details.registrationYear}`, String(check.details.registrationYear), source, { reliability: 0.85 }),
          evidence('organization.registry-link', 'Выписка ЕГРЮЛ/ЕГРИП', DIRECTORY_LINKS.egrul(digits), source, { reliability: 0.7 }),
        );
        if (digits.length === 13) {
          const innGuess = digits.slice(3, 5);
          out.pivots?.push(pivot('location', String(check.region ?? `Регион ${innGuess}`), { relation: 'registered_at', confidence: 0.55, reason: 'Код субъекта РФ в ОГРН' }));
        }
        break;
      }

      case 'bank_account': {
        const digits = value.replace(/\D/g, '');
        if (digits.length === 9 && digits.startsWith('04')) {
          const bik = validateBik(digits);
          out.evidence?.push(
            evidence('bank.bik', `БИК ${bik.isValid ? 'структурно корректен' : 'некорректен'}; ${bik.region}`, digits, source, { reliability: 0.9, tags: ['cbr'] }),
            evidence('bank.bik-lookup', 'Официальный справочник БИК ЦБ РФ', 'https://www.cbr.ru/scripts/XML_bic.asp', source, { reliability: 0.7 }),
          );
        } else {
          const iban = validateIban(value);
          out.evidence?.push(
            evidence('bank.iban-checksum', `Контрольная сумма IBAN (MOD-97): ${iban.checksumOk ? 'верна' : 'неверна'}`, iban.checksumOk, source, { reliability: 0.99, tags: ['iso13616'] }),
            evidence('bank.iban-country', `Страна IBAN: ${iban.country ?? 'неизвестна'}`, iban.country ?? 'unknown', source, { reliability: 0.95 }),
          );
          if (!iban.isValid) out.riskFactors?.push(risk('reputation.scam-reports', 0.3, `IBAN ${value} не проходит MOD-97 — вероятна опечатка или поддельный реквизит`, []));
        }
        break;
      }

      case 'vehicle': {
        const isVin = /^[A-HJ-NPR-Z0-9]{17}$/i.test(value);
        if (isVin) {
          const vin = decodeVin(value);
          out.evidence?.push(
            evidence('vehicle.wmi', `Производитель по WMI: ${vin.details.manufacturer}`, String(vin.details.manufacturer), source, { reliability: 0.85, tags: ['iso3779'] }),
            evidence('vehicle.origin', `Регион сборки/регистрации WMI: ${vin.details.wmiCountry}`, String(vin.details.wmiCountry), source, { reliability: 0.8, tags: ['geo'] }),
            evidence('vehicle.model-year', `Модельный год: ${vin.modelYear ?? 'не определён'}`, vin.modelYear ?? 'unknown', source, { reliability: 0.75 }),
            evidence('vehicle.check-digit', `Контрольный знак VIN: ${vin.checkDigitValid === null ? 'не применяется (не NA-рынок)' : vin.checkDigitValid ? 'совпал' : 'не совпал'}`, String(vin.checkDigitValid), source, { reliability: 0.9, tags: ['checksum'] }),
          );
          out.pivots?.push(pivot('vehicle', value.toUpperCase(), { relation: 'owned_by', confidence: 0.5, reason: 'VIN как ключ поиска в реестрах ГИБДД/залогов' }));
        } else {
          const plate = parseRuPlate(value);
          out.evidence?.push(
            evidence('vehicle.plate-format', `Формат ГРЗ: ${plate.plateType}`, plate.plateType, source, { reliability: 0.9, tags: ['gost50577'] }),
            evidence('vehicle.region', `Регион регистрации: ${plate.region ?? 'не определён'}`, plate.region ?? 'unknown', source, { reliability: 0.85, tags: ['geo'] }),
          );
          if (plate.seriesType) {
            out.evidence?.push(evidence('vehicle.special-series', `Спецсерия: ${plate.seriesType}`, plate.seriesType, source, { reliability: 0.8, tags: ['special'] }));
            out.riskFactors?.push(risk('identity.full-profile-triangulated', 0.35, `ГРЗ относится к спецсерии (${plate.seriesType}) — вероятна принадлежность к государственной структуре`, [], { label: 'Спецсерия ГРЗ' }));
          }
          out.notes?.push('Проверка залогов/ограничений ГИБДД выполняется вручную через официальный сервис');
        }
        break;
      }

      case 'real_estate': {
        const cadastral = validateCadastralNumber(value);
        out.evidence?.push(
          evidence('realty.cadastral', `Кадастровый номер ${cadastral.isValid ? 'корректен' : 'некорректен'}: ${cadastral.region ?? 'регион не определён'}`, value, source, { reliability: 0.9, tags: ['rosreestr'] }),
          evidence('realty.registry-link', 'Публичная кадастровая карта Росреестра', String(cadastral.details.verifyUrl ?? ''), source, { reliability: 0.7 }),
        );
        break;
      }

      case 'domain':
      case 'subdomain': {
        const host = normalizeDomain(value);
        const dga = dgaScore(host);
        out.evidence?.push(
          evidence('domain.registrable', `Registrable domain: ${registrableDomain(host)}`, registrableDomain(host), source, { reliability: 0.95 }),
          evidence('domain.dga-score', `Оценка алгоритмической генерации: ${(dga.score * 100).toFixed(0)}% (${dga.verdict})`, dga.score, source, { reliability: 0.6, tags: ['dga', 'heuristic'] }),
          evidence('domain.entropy', `Энтропия Шеннона метки: ${shannonEntropy(host.split('.')[0] ?? host).toFixed(2)} бит`, Number(shannonEntropy(host.split('.')[0] ?? host).toFixed(2)), source, { reliability: 0.9 }),
        );
        if (dga.verdict === 'likely-generated') {
          out.riskFactors?.push(risk('cyber.dga-domain', 0.7, `Домен «${host}» выглядит алгоритмически сгенерированным (score ${(dga.score * 100).toFixed(0)}%) — возможен C2-узел`, [], { tags: ['cyber'] }));
        }
        break;
      }

      case 'ip':
      case 'username':
      case 'url': {
        const entropy = shannonEntropy(value);
        out.evidence?.push(
          evidence('indicator.entropy', `Энтропия индикатора: ${entropy.toFixed(2)} бит`, Number(entropy.toFixed(2)), source, { reliability: 0.9 }),
          evidence('indicator.encoding', `Похоже на Base64: ${looksBase64(value) ? 'да' : 'нет'}, hex: ${looksHex(value) ? 'да' : 'нет'}`, { base64: looksBase64(value), hex: looksHex(value) }, source, { reliability: 0.8, tags: ['encoding'] }),
        );
        break;
      }

      default:
        return { notes: ['Тип сущности не поддерживается модулем идентификаторов'] };
    }

    return out;
  },
};

/** Secondary module: validates raw numeric artifacts often found in dumps. */
export const artifactModule: OsintModule = {
  id: 'identity.artifacts',
  name: 'Проверка артефактов (IMEI/ICCID/EAN/Верхов)',
  category: 'identity',
  description: 'Распознаёт и валидирует номера IMEI, SIM-карт (ICCID), штрихкодов EAN/UPC и документов с контрольной суммой Верхов (Aadhaar-подобные).',
  accepts: ['document', 'service', 'vehicle'],
  produces: ['vehicle', 'phone'],
  requiresNetwork: false,
  cost: 0.1,
  priority: 60,
  run(input: ModuleInput): ModuleResult {
    const digits = input.entity.value.replace(/\D/g, '');
    const source = { name: 'Локальная валидация', kind: 'algorithm' as const };
    const out: ModuleResult = { evidence: [] };
    if (digits.length === 15) {
      const imei = validateImei(digits);
      out.evidence?.push(
        evidence('artifact.imei', `IMEI ${imei.isValid ? 'валиден' : 'невалиден'} по Luhn; TAC ${imei.tac}`, imei.isValid, source, { reliability: 0.95, tags: ['imei'] }),
      );
      if (imei.tac) {
        out.pivots?.push(pivot('vehicle', imei.tac, { relation: 'uses', confidence: 0.4, reason: 'TAC-код устройства (модель по базе GSMA)' }));
      }
    } else if (digits.length === 19 || digits.length === 20) {
      const iccid = validateIccid(digits);
      out.evidence?.push(evidence('artifact.iccid', `ICCID ${iccid.isValid ? 'валиден' : 'невалиден'} (${iccid.issuer ?? 'эмитент неизвестен'})`, iccid.isValid, source, { reliability: 0.9, tags: ['sim'] }));
    } else if (digits.length === 8 || digits.length === 12 || digits.length === 13 || digits.length === 14) {
      const ean = validateEan(digits);
      out.evidence?.push(evidence('artifact.gtin', `${ean.type}: контрольная цифра ${ean.isValid ? 'верна' : 'неверна'}`, ean.isValid, source, { reliability: 0.95 }));
      // A 12-digit code that fails the GTIN check may still be a Verhoeff-checked
      // document number (Aadhaar-like national IDs) — reported as a *secondary*
      // interpretation, never as a confirmed document.
      if (digits.length === 12 && !ean.isValid && isValidVerhoeff(digits)) {
        out.evidence?.push(evidence('artifact.verhoeff', '12-значный код не является GTIN, но проходит проверку Верхов — возможен документ с контрольным разрядом Верхов (Aadhaar-подобный ID)', true, source, { reliability: 0.6, tags: ['verhoeff', 'hypothesis'] }));
      }
    }
    return out;
  },
};

export const identifierModules = [identifierModule, artifactModule];
export { entity, edge };
