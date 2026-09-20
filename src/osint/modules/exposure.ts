/**
 * MODULE: exposure — breach & credential exposure analysis
 * ---------------------------------------------------------------------------
 * Designed around a hard privacy rule: **secrets never leave the device**.
 *   • Pwned Passwords k-anonymity (HIBP range API): only the first 5 hex chars
 *     of the SHA-1 travel; the full hash and the password stay local. This is
 *     the industry-standard way to check a credential without disclosing it.
 *   • Local strength/placeholder analysis of dumped passwords (entropy, pattern
 *     classes) — tells the analyst whether a leaked secret is a reused weak one
 *     or a redacted placeholder.
 *   • Mailbox plausibility: disposable/role detection, MX presence, catch-all
 *     hints; plus API-key-gated HIBP account search when a key is configured.
 *   • Directory pivots (HIBP / DeHashed / IntelX / LeakCheck / Telegram dumps).
 */

import type { ModuleInput, ModuleContext, ModuleResult, OsintModule } from '../types/module';
import { md5, sha1 } from '../algo/hashes';
import { analyzePasswordStrength, shannonEntropy } from '../algo/entropy';
import { parseEmail, parsePhone } from '../algo/normalize';
import { resolveRecords } from '../net/dns';
import { evidence, entity, edge, pivot, risk, DIRECTORY_LINKS, truncate } from './common';

const MODULE_ID = 'exposure.breach';

export interface PwnedPasswordResult {
  prefix: string;
  found: boolean;
  /** Number of times the password appears in the corpus (0 when absent). */
  occurrences: number;
  checkedSuffixes: number;
}

/**
 * Check a password against the Pwned Passwords corpus using k-anonymity.
 * The password and its full hash never leave this function.
 */
export async function checkPwnedPassword(ctx: ModuleContext, password: string): Promise<PwnedPasswordResult> {
  const hash = sha1(password).toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const body = await ctx.http.text(`https://api.pwnedpasswords.com/range/${prefix}`, {
    timeoutMs: 10_000,
    cacheTtlMs: 6 * 60 * 60_000,
    signal: ctx.signal,
    headers: { 'add-padding': 'true' },
  });
  const lines = body.split('\n');
  for (const line of lines) {
    const [lineSuffix, count] = line.trim().split(':');
    if (!lineSuffix) continue;
    if (lineSuffix.trim().toUpperCase() === suffix) {
      return { prefix, found: true, occurrences: Number(count ?? 1), checkedSuffixes: lines.length };
    }
  }
  return { prefix, found: false, occurrences: 0, checkedSuffixes: lines.length };
}

export const exposureModule: OsintModule = {
  id: MODULE_ID,
  name: 'Компрометация: утечки и учётные данные',
  category: 'exposure',
  description:
    'Проверяет пароли по базе Pwned Passwords по схеме k-anonymity (на сервер уходят только 5 символов SHA-1), анализирует силу и тип утёкших паролей, оценивает правдоподобность почтового ящика (одноразовые, ролевые, MX), формирует план проверок по HIBP/DeHashed/IntelX и выставляет факторы риска компрометации.',
  accepts: ['email', 'phone', 'credential', 'username', 'breach', 'domain'],
  produces: ['breach', 'credential', 'domain', 'email'],
  requiresNetwork: true,
  cost: 2,
  priority: 78,
  cacheTtlMs: 30 * 60_000,
  tags: ['breach', 'credentials', 'privacy-preserving'],
  dataSources: ['Pwned Passwords (HIBP range API, k-anonymity)', 'HIBP account API (требуется ключ)', 'Справочники DeHashed/IntelX/LeakCheck'],
  async run(input: ModuleInput, ctx: ModuleContext): Promise<ModuleResult> {
    const out: ModuleResult = { evidence: [], entities: [], edges: [], riskFactors: [], pivots: [], notes: [] };

    // ── Credential payload (from a dump or analyst input) ───────────────────
    const credentialPayload = typeof input.entity.properties.password === 'string' ? (input.entity.properties.password as string) : undefined;
    if (credentialPayload) {
      const strength = analyzePasswordStrength(credentialPayload);
      out.evidence?.push(
        evidence('credential.strength', `Оценка утёкшего пароля: ${strength.label} (${strength.entropyBits} бит энтропии)${strength.isPlaceholder ? ' — значение является заглушкой/редакцией' : ''}`, { score: strength.score, entropyBits: strength.entropyBits, isPlaceholder: strength.isPlaceholder, notes: strength.notes }, { name: 'Анализ стойкости пароля (локально)', kind: 'algorithm' }, { reliability: 0.85, tags: ['credentials'] }),
      );

      if (!strength.isPlaceholder && ctx.settings.offline === false) {
        try {
          const pwned = await checkPwnedPassword(ctx, credentialPayload);
          out.evidence?.push(
            evidence(
              'credential.pwned',
              pwned.found
                ? `Пароль присутствует в базе Pwned Passwords (${pwned.occurrences.toLocaleString('ru-RU')} совпадений в корпусе утечек). Проверено без передачи пароля: только префикс SHA-1 ${pwned.prefix}…`
                : 'Пароль не найден в базе Pwned Passwords (в пределах префикса SHA-1)',
              { found: pwned.found, occurrences: pwned.occurrences },
              { name: 'Pwned Passwords (k-anonymity range API)', kind: 'api', url: 'https://haveibeenpwned.com/Passwords' },
              { reliability: 0.95, tags: ['breach', 'credential', 'privacy-preserving'] },
            ),
          );
          if (pwned.found) {
            out.riskFactors?.push(
              risk('cyber.plaintext-credentials', Math.min(0.95, 0.6 + Math.log10(Math.max(1, pwned.occurrences)) * 0.08), `Пароль найден в публичных дампах ${pwned.occurrences.toLocaleString('ru-RU')} раз — он гарантированно используется в credential-stuffing атаках`, []),
            );
            out.riskFactors?.push(risk('cyber.reused-credentials', 0.55, 'Скомпрометированный пароль с высокой вероятностью переиспользован на других сервисах субъекта', []));
          } else if (strength.score <= 1) {
            out.riskFactors?.push(risk('cyber.password-hash-exposed', 0.4, 'Пароль слабый и не найден в корпусе — тем не менее он тривиально подбирается', []));
          }
        } catch (error) {
          out.notes?.push(`Pwned Passwords недоступен: ${(error as Error).message.slice(0, 140)}`);
        }
      }
    }

    // ── E-mail exposure ────────────────────────────────────────────────────
    if (input.entity.type === 'email') {
      const email = parseEmail(input.entity.value);
      if (!email.isValid || !email.address || !email.domain) return out;

      out.evidence?.push(
        evidence('email.provider', `Провайдер: ${email.provider}`, email.provider, { name: 'Классификация почтовых доменов (локальный набор)', kind: 'dataset' }, { reliability: 0.9 }),
        evidence('email.canonical', `Каноническая форма (для дедупликации алиасов): ${email.canonical}`, email.canonical ?? email.address, { name: 'Нормализация адресов (локально)', kind: 'algorithm' }, { reliability: 0.95 }),
        evidence('email.gravatar', `Аватар Gravatar: ${DIRECTORY_LINKS.gravatar(md5(email.address.trim().toLowerCase()))} — если адрес зарегистрирован, раскрывается публичный профиль и аватар`, { url: DIRECTORY_LINKS.gravatar(md5(email.address.trim().toLowerCase())), hash: md5(email.address.trim().toLowerCase()) }, { name: 'Gravatar (MD5 нормализованного адреса)', kind: 'algorithm', url: 'https://gravatar.com' }, { reliability: 0.6, tags: ['osint-technique'] }),
      );

      if (email.isDisposable) {
        out.evidence?.push(evidence('email.disposable', 'Адрес принадлежит сервису одноразовой почты — вероятна попытка скрыть основную личность', true, { name: 'Список одноразовых доменов (локальный)', kind: 'dataset' }, { reliability: 0.85, tags: ['disposable'] }));
        out.riskFactors?.push(risk('reputation.scam-reports', 0.4, `Почтовый адрес ${email.address} относится к сервису временной почты — типично для мошеннических регистраций`, []));
      }
      if (email.isRoleAccount) {
        out.evidence?.push(evidence('email.role-account', 'Адрес является ролевым (info@, admin@, support@) — обычно не персональный, а организационный', true, { name: 'Эвристика ролевых адресов', kind: 'heuristic' }, { reliability: 0.8 }));
      }

      // MX presence — is this mailbox even plausible?
      try {
        const records = await resolveRecords(ctx.http, email.domain, ['MX', 'TXT'], { signal: ctx.signal, resolverIds: ['cloudflare', 'google'], ttlMs: 30 * 60_000 });
        const mx = (records.records.MX ?? []).map((entry) => entry.value.replace(/^\d+\s+/, ''));
        out.evidence?.push(
          evidence('email.mx', mx.length ? `Почтовые серверы домена: ${truncate(mx.join(', '), 200)}` : 'MX-записи отсутствуют — домен не принимает почту', mx, { name: 'DoH MX-запрос', kind: 'dns' }, { reliability: 0.92, tags: ['mail'] }),
        );
        if (!mx.length) {
          out.riskFactors?.push(risk('reputation.scam-reports', 0.35, `Домен ${email.domain} не имеет MX-записей: адрес не может принимать почту — вероятна подделка или нерабочий контакт`, []));
        }
        const spf = (records.records.TXT ?? []).map((entry) => entry.value).find((value) => /^v=spf1/i.test(value));
        if (spf) {
          const includes = [...spf.matchAll(/include:([^\s]+)/gi)].map((match) => match[1] as string);
          out.evidence?.push(evidence('email.spf-providers', `Отправка почты домена делегирована: ${truncate(includes.join(', '), 200) || 'собственные серверы'}`, includes, { name: 'Разбор SPF (локально)', kind: 'algorithm' }, { reliability: 0.85, tags: ['mail'] }));
        }
      } catch (error) {
        out.notes?.push(`MX-проверка недоступна: ${(error as Error).message.slice(0, 120)}`);
      }

      // HIBP account API — requires a key; state that honestly.
      const hibpKey = ctx.settings.apiKeys.hibp;
      if (hibpKey) {
        try {
          const breaches = await ctx.http.json<Array<{ Name: string; Title: string; BreachDate: string; PwnCount: number; DataClasses: string[]; IsSensitive: boolean }>>(
            `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email.address)}?truncateResponse=false`,
            { timeoutMs: 12_000, cacheTtlMs: 30 * 60_000, signal: ctx.signal, headers: { 'hibp-api-key': hibpKey, 'user-agent': ctx.settings.userAgent }, allowErrorStatus: true },
          );
          if (Array.isArray(breaches) && breaches.length) {
            for (const breach of breaches.slice(0, 20)) {
              out.entities?.push(
                entity('breach', breach.Name, {
                  label: `${breach.Title} (${breach.BreachDate})`,
                  tags: ['breach'],
                  confidence: 0.95,
                  properties: { date: breach.BreachDate, accounts: breach.PwnCount, dataClasses: breach.DataClasses, sensitive: breach.IsSensitive },
                }),
              );
              out.edges?.push(edge(input.entity.id, { type: 'breach', value: breach.Name }, 'leaked_in', 0.9, 0.95));
            }
            const classes = [...new Set(breaches.flatMap((breach) => breach.DataClasses))];
            out.evidence?.push(
              evidence('email.breaches', `Адрес обнаружен в ${breaches.length} утечках. Категории данных: ${classes.join(', ')}`, breaches.map((breach) => breach.Name), { name: 'Have I Been Pwned (API v3)', kind: 'api', url: 'https://haveibeenpwned.com' }, { reliability: 0.97, tags: ['breach'] }),
            );
            if (classes.some((value) => /password|passwords/i.test(value))) {
              out.riskFactors?.push(risk('cyber.password-hash-exposed', 0.65, `Пароли субъекта присутствуют минимум в ${breaches.filter((breach) => breach.DataClasses.some((value) => /password/i.test(value))).length} утечках`, []));
            }
            if (classes.some((value) => /passport|national id|credit card|bank/i.test(value))) {
              out.riskFactors?.push(risk('identity.documents-exposed', 0.85, `В утечках присутствуют документы/финансовые данные субъекта: ${classes.join(', ')}`, []));
            }
            out.riskFactors?.push(risk('identity.pii-in-breaches', Math.min(0.9, 0.4 + breaches.length * 0.05), `Персональные данные встречаются в ${breaches.length} публичных утечках`, []));
          } else {
            out.evidence?.push(evidence('email.breaches', 'Адрес не найден в базе HIBP (по данным API)', [], { name: 'Have I Been Pwned (API v3)', kind: 'api' }, { reliability: 0.9, tags: ['breach'] }));
          }
        } catch (error) {
          out.notes?.push(`HIBP API: ${(error as Error).message.slice(0, 140)}`);
        }
      } else {
        out.evidence?.push(
          evidence('email.breach-plan', 'План проверки утечек: HIBP (нужен API-ключ), DeHashed, IntelX, LeakCheck', { hibp: DIRECTORY_LINKS.hibp(email.address), dehashed: DIRECTORY_LINKS.dehashed(email.address), intelx: DIRECTORY_LINKS.intelx(email.address), leakcheck: DIRECTORY_LINKS.leakcheck(email.address) }, { name: 'Генерация плана проверок (локально)', kind: 'algorithm' }, { reliability: 0.9, tags: ['plan'] }),
        );
        out.notes?.push('Для автоматической проверки утечек укажите API-ключ HIBP в settings.apiKeys.hibp');
      }

      out.pivots?.push(pivot('domain', email.domain, { relation: 'uses', confidence: 0.8, reason: 'Домен почты — инфраструктурный след', from: input.entity.id }));
      out.entities?.push(entity('domain', email.domain, { label: email.domain, tags: ['email-domain'], confidence: 0.9 }));
    }

    // ── Phone exposure ─────────────────────────────────────────────────────
    if (input.entity.type === 'phone') {
      const parsed = parsePhone(input.entity.value, 'RU');
      if (parsed.e164) {
        out.evidence?.push(
          evidence('phone.leak-plan', 'План проверки утечек по номеру телефона', { leakcheck: DIRECTORY_LINKS.leakcheck(parsed.e164), dehashed: DIRECTORY_LINKS.dehashed(parsed.e164), numbuster: `https://numbuster.com/en/phone/+${parsed.e164.replace(/\D/g, '')}` }, { name: 'Генерация плана проверок (локально)', kind: 'algorithm' }, { reliability: 0.9, tags: ['plan'] }),
        );
        out.pivots?.push(pivot('person', `Абонент ${parsed.e164}`, { relation: 'owns', confidence: 0.35, reason: 'Проверка привязки номера к ФИО через справочники', from: input.entity.id }));
      }
    }

    // ── Raw dump text handling ─────────────────────────────────────────────
    if (input.entity.type === 'breach') {
      const raw = input.entity.value;
      const entropy = shannonEntropy(raw);
      out.evidence?.push(
        evidence('breach.entropy', `Энтропия записи утечки: ${entropy.toFixed(2)} бит — ${entropy > 4 ? 'похоже на реальные скомпрометированные данные' : 'низкая, вероятно структурированный/маскированный дамп'}`, Number(entropy.toFixed(2)), { name: 'Информационный анализ (локально)', kind: 'algorithm' }, { reliability: 0.7, tags: ['triage'] }),
      );
    }

    return out;
  },
};

export const exposureModules = [exposureModule];
