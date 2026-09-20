/**
 * MODULE: certificates — Certificate Transparency reconnaissance
 * ---------------------------------------------------------------------------
 * CT logs are the most under-used free OSINT source: they are append-only,
 * public, and every issued certificate is recorded forever. From a single
 * domain we can recover:
 *   • subdomains that were never meant to be public (staging, vpn, mail, dev)
 *   • issuer fingerprinting (Let's Encrypt vs corporate CA vs Cloudflare)
 *   • issuance history — a spike of new certificates often precedes a phishing
 *     campaign or a migration; wildcard certs reveal corporate structure
 *   • shared-certificate pivots: unrelated domains on the same certificate
 *     belong to the same owner (a genuinely strong ownership signal)
 */

import type { ModuleInput, ModuleContext, ModuleResult, OsintModule } from '../types/module';
import { evidence, entity, edge, pivot, risk, truncate } from './common';
import { registrableDomain, normalizeDomain } from '../algo/normalize';

const MODULE_ID = 'infrastructure.certificates';

interface CrtEntry {
  issuer_ca_id: number;
  issuer_name: string;
  common_name: string;
  name_value: string;
  id: number;
  entry_timestamp?: string;
  not_before?: string;
  not_after?: string;
  serial_number?: string;
  result_count?: number;
}

const INTERESTING_SUBDOMAINS = /^(vpn|mail|smtp|imap|ftp|dev|staging|stage|test|admin|panel|portal|intranet|internal|git|gitlab|jenkins|ci|db|sql|backup|proxy|remote|jira|confluence|owa|exchange|rdp|cam|nvr|api|stg|uat)\./i;

export const certificatesModule: OsintModule = {
  id: MODULE_ID,
  name: 'Certificate Transparency (crt.sh): поддомены и история TLS',
  category: 'infrastructure',
  description:
    'Запрашивает публичные логи CT, извлекает все имена из выданных сертификатов, находит неочевидные поддомены (vpn, dev, admin, оwa), определяет удостоверяющие центры, даты выпуска и общие сертификаты (признак единого владельца инфраструктуры).',
  accepts: ['domain', 'subdomain'],
  produces: ['subdomain', 'certificate', 'domain', 'service'],
  requiresNetwork: true,
  cost: 2,
  priority: 80,
  cacheTtlMs: 30 * 60_000,
  tags: ['ct-logs', 'subdomains', 'attribution'],
  dataSources: ['crt.sh (Certificate Transparency)', 'CT logs (Google Argon, Cloudflare Nimbus)'],
  async run(input: ModuleInput, ctx: ModuleContext): Promise<ModuleResult> {
    const host = normalizeDomain(input.entity.value);
    const domain = registrableDomain(host);
    const source = { name: 'crt.sh — Certificate Transparency search', kind: 'registry' as const, url: `https://crt.sh/?q=%25.${domain}`, license: 'Public CT logs' };
    const out: ModuleResult = { evidence: [], entities: [], edges: [], riskFactors: [], pivots: [], notes: [] };

    let entries: CrtEntry[] = [];
    try {
      entries = await ctx.http.json<CrtEntry[]>(`https://crt.sh/?q=%25.${encodeURIComponent(domain)}&output=json`, {
        timeoutMs: 20_000,
        cacheTtlMs: 30 * 60_000,
        signal: ctx.signal,
      });
    } catch (error) {
      out.notes?.push(`crt.sh недоступен (частая проблема CORS/лимитов): ${(error as Error).message.slice(0, 160)}`);
      return out;
    }
    if (!Array.isArray(entries) || !entries.length) {
      out.notes?.push('В логах CT не найдено сертификатов для этого домена');
      return out;
    }

    // ── Name harvesting ─────────────────────────────────────────────────────
    const names = new Set<string>();
    for (const entry of entries) {
      for (const raw of String(entry.name_value ?? '').split('\n')) {
        const name = raw.trim().toLowerCase().replace(/^\*\./, '');
        if (!name || name.includes(' ') || name.length > 253) continue;
        if (!name.endsWith(domain)) continue;
        names.add(name);
      }
    }

    const interesting = [...names].filter((name) => INTERESTING_SUBDOMAINS.test(name));
    out.evidence?.push(
      evidence('ct.certificate-count', `Найдено сертификатов в CT: ${entries.length}, уникальных имён: ${names.size}`, { certificates: entries.length, names: names.size }, source, { reliability: 0.92, tags: ['ct'] }),
      evidence('ct.subdomains', `Обнаруженные имена: ${truncate([...names].slice(0, 25).join(', '), 400)}`, [...names].slice(0, 200), source, { reliability: 0.9, tags: ['subdomains'] }),
    );

    for (const name of interesting.slice(0, 20)) {
      out.entities?.push(entity('subdomain', name, { label: name, tags: ['ct', 'sensitive-name'], confidence: 0.85 }));
      out.edges?.push(edge(input.entity.id, { type: 'subdomain', value: name }, 'derived_from', 0.7, 0.85));
      out.pivots?.push(pivot('subdomain', name, { relation: 'derived_from', confidence: 0.7, reason: 'Имя из сертификата CT указывает на служебный сервис', from: input.entity.id }));
    }
    for (const name of [...names].filter((candidate) => !interesting.includes(candidate)).slice(0, 30)) {
      out.entities?.push(entity('subdomain', name, { label: name, tags: ['ct'], confidence: 0.8 }));
    }

    if (interesting.length) {
      out.evidence?.push(
        evidence('ct.exposed-services', `Служебные поддомены из сертификатов: ${interesting.slice(0, 10).join(', ')}`, interesting, { name: 'Эвристика служебных имён TOMAHAWK', kind: 'heuristic' }, { reliability: 0.7, tags: ['exposure'] }),
      );
      out.riskFactors?.push(risk('cyber.exposed-service', Math.min(1, 0.35 + interesting.length * 0.06), `В публичных логах CT раскрыты служебные поддомены (${interesting.slice(0, 4).join(', ')}) — потенциальные точки входа`, [], { tags: ['infrastructure'] }));
    }

    // ── Issuers & timeline ──────────────────────────────────────────────────
    const issuers = new Map<string, number>();
    const months = new Map<string, number>();
    for (const entry of entries) {
      const issuer = (entry.issuer_name ?? '').replace(/^C=.*?O=/, '').split(',')[0]?.slice(0, 60) ?? 'unknown';
      issuers.set(issuer, (issuers.get(issuer) ?? 0) + 1);
      if (entry.not_before) {
        const month = entry.not_before.slice(0, 7);
        months.set(month, (months.get(month) ?? 0) + 1);
      }
    }
    const issuerList = [...issuers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    out.evidence?.push(
      evidence('ct.issuers', `Удостоверяющие центры: ${issuerList.map(([issuer, count]) => `${issuer} (${count})`).join('; ')}`, Object.fromEntries(issuerList), source, { reliability: 0.85, tags: ['issuer'] }),
      evidence('ct.issuance-timeline', `Выпуски по месяцам: ${[...months.entries()].slice(-12).map(([month, count]) => `${month}:${count}`).join(', ')}`, Object.fromEntries(months), source, { reliability: 0.85, tags: ['timeline'] }),
    );

    const selfSigned = issuerList.filter(([issuer]) => /self|unknown/i.test(issuer));
    if (selfSigned.length > entries.length / 3) {
      out.riskFactors?.push(risk('cyber.expired-or-weak-tls', 0.3, 'Значительная часть сертификатов выпущена самоподписанными УЦ — типично для внутренней/теневой инфраструктуры', []));
    }

    // ── Shared-certificate pivot (co-ownership) ─────────────────────────────
    const serials = new Map<string, CrtEntry>();
    for (const entry of entries) {
      if (entry.serial_number && !serials.has(entry.serial_number)) serials.set(entry.serial_number, entry);
    }
    const sharedCandidates = [...serials.values()]
      .filter((entry) => String(entry.name_value ?? '').split('\n').length > 1)
      .slice(0, 5);
    for (const candidate of sharedCandidates) {
      const related = String(candidate.name_value)
        .split('\n')
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value && !value.endsWith(domain));
      for (const name of related.slice(0, 6)) {
        if (!name.includes('.')) continue;
        out.entities?.push(entity('domain', name.replace(/^\*\./, ''), { label: name, tags: ['shared-certificate'], confidence: 0.6 }));
      }
      if (related.length) {
        out.evidence?.push(
          evidence('ct.shared-certificate', `Сертификат с общими SAN (признак единого владельца): ${truncate(related.join(', '), 250)}`, related, source, { reliability: 0.7, tags: ['attribution'] }),
        );
        out.riskFactors?.push(risk('cyber.shared-infrastructure', 0.35, 'Обнаружены домены, делящие один TLS-сертификат с исследуемым — вероятен общий владелец или оператор инфраструктуры', []));
      }
      break;
    }

    out.metrics = { certificates: entries.length, names: names.size, issuers: issuers.size, sensitiveSubdomains: interesting.length };
    return out;
  },
};

export const certificateModules = [certificatesModule];
