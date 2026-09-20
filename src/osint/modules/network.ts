/**
 * MODULE: infrastructure — DNS, IP, mail-security, hosting & tech fingerprint
 * ---------------------------------------------------------------------------
 * Network-bound (canonical, evidence-heavy collection):
 *   • multi-resolver DoH fan-out with cross-resolver divergence detection
 *   • full record set: A/AAAA/MX/TXT/NS/SOA/CAA + SPF/DMARC/DKIM/MTA-STS/BIMI
 *   • RDAP registration data (registrar, dates, status, abuse contact)
 *   • IP intelligence: ASN, netblock, country, hosting/proxy classification,
 *     reverse DNS — reverse DNS is the single best "who is this" signal for
 *     infrastructure attribution
 *   • HTTP fingerprint: security headers, server/tech stack, redirect chain
 *   • risk factors for spoofable mail, adversarial hosting, anonymity infra
 */

import type { ModuleInput, ModuleContext, ModuleResult, OsintModule } from '../types/module';
import { resolveRecords, assessMailSecurity, parseDkimRecord, reverseDns, isPrivateIp } from '../net/dns';
import { evidence, entity, edge, pivot, risk, truncate } from './common';
import { registrableDomain, isIpAddress } from '../algo/normalize';

const MODULE_ID = 'infrastructure.network';

const NETWORK_SOURCE = { name: 'DNS-over-HTTPS (Cloudflare / Google / Quad9)', kind: 'dns' as const, url: 'https://cloudflare-dns.com/dns-query' };
const RDAP_SOURCE = { name: 'RDAP (IANA bootstrap / регистраторы)', kind: 'registry' as const, url: 'https://rdap.org' };
const IP_SOURCE = { name: 'RDAP + геолокация IP (ipwho.is)', kind: 'api' as const, url: 'https://ipwho.is' };

interface IpInfo {
  ip: string;
  type?: string;
  country?: string;
  country_code?: string;
  region?: string;
  city?: string;
  connection?: { asn?: number; org?: string; isp?: string };
  security?: { proxy?: boolean; vpn?: boolean; tor?: boolean; hosting?: boolean; relay?: boolean };
  latitude?: number;
  longitude?: number;
  timezone?: { id?: string };
}

interface RdapResponse {
  handle?: string;
  ldhName?: string;
  status?: string[];
  events?: Array<{ eventAction: string; eventDate: string }>;
  entities?: Array<{ roles?: string[]; vcardArray?: unknown[]; handle?: string }>;
  nameservers?: Array<{ ldhName?: string }>;
  startAddress?: string;
  endAddress?: string;
  name?: string;
  country?: string;
}

function rdapVcardValue(entityEntry: RdapResponse['entities'] extends Array<infer E> ? E : never): { name?: string; emails: string[] } {
  const entry = entityEntry as { vcardArray?: [string, Array<[string, unknown, string, unknown]>]; handle?: string } | undefined;
  const out: { name?: string; emails: string[] } = { emails: [] };
  if (!entry?.vcardArray?.[1]) return out;
  for (const property of entry.vcardArray[1]) {
    const [key, , , value] = property;
    if (key === 'fn' && typeof value === 'string') out.name = value;
    if (key === 'email' && typeof value === 'string') out.emails.push(value);
  }
  return out;
}

export const infrastructureModule: OsintModule = {
  id: MODULE_ID,
  name: 'Сетевая разведка (DNS, RDAP, IP, почтовая защита)',
  category: 'infrastructure',
  description:
    'Опрашивает несколько DoH-резолверов и сравнивает ответы, собирает полный набор DNS-записей, оценивает почтовую защиту домена (SPF/DMARC/DKIM/MTA-STS/BIMI), получает регистрационные данные через RDAP, определяет ASN, хостинг и анонимизацию для IP, снимает HTTP-заголовки и стек технологий.',
  accepts: ['domain', 'subdomain', 'url', 'ip', 'asn', 'netblock'],
  produces: ['domain', 'subdomain', 'ip', 'asn', 'netblock', 'certificate', 'service', 'email'],
  requiresNetwork: true,
  cost: 3,
  priority: 85,
  cacheTtlMs: 10 * 60_000,
  tags: ['dns', 'infrastructure', 'whois'],
  dataSources: ['Cloudflare DoH', 'Google Public DNS', 'Quad9', 'RDAP.org', 'ipwho.is', 'crt.sh'],
  async run(input: ModuleInput, ctx: ModuleContext): Promise<ModuleResult> {
    const out: ModuleResult = { evidence: [], entities: [], edges: [], riskFactors: [], pivots: [], notes: [] };
    const host = input.entity.value.trim();

    if (isIpAddress(host)) return investigateIp(host, input, ctx, out);
    if (input.entity.type === 'asn' || input.entity.type === 'netblock') {
      out.notes?.push('ASN/сеть обрабатываются через RDAP при наличии IP; прямой ASN-обзор добавьте модулем хоста');
      return out;
    }

    // ── Domain / subdomain path ─────────────────────────────────────────────
    const domain = registrableDomain(host);
    if (!domain.includes('.')) return { notes: [`«${host}» не является доменным именем`] };

    const records = await resolveRecords(ctx.http, host, ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME', 'SOA', 'CAA'], {
      signal: ctx.signal,
      ttlMs: 10 * 60_000,
      resolverIds: ['cloudflare', 'google', 'quad9'],
    });

    const flatten = (type: string): string[] => (records.records[type] ?? []).map((entry) => String(entry.value));
    const unique = (values: string[]): string[] => [...new Set(values)];

    for (const [type, entries] of Object.entries(records.records)) {
      if (!entries.length) continue;
      out.evidence?.push(
        evidence(`dns.${type.toLowerCase()}`, `${type}-записи (${unique(entries.map((entry) => entry.value)).length}): ${truncate(unique(entries.map((entry) => entry.value)).slice(0, 4).join(' | '), 200)}`, unique(entries.map((entry) => entry.value)), NETWORK_SOURCE, {
          reliability: 0.92,
          tags: ['dns', type.toLowerCase()],
        }),
      );
    }

    // Harvest addresses as first-class graph nodes.
    for (const ip of unique(flatten('A').concat(flatten('AAAA')))) {
      out.entities?.push(entity('ip', ip, { label: ip, tags: ['resolved'], confidence: 0.9 }));
      out.edges?.push(edge(input.entity.id, { type: 'ip', value: ip }, 'resolves_to', 0.85, 0.92));
      out.pivots?.push(pivot('ip', ip, { relation: 'resolves_to', confidence: 0.85, reason: 'A/AAAA-запись домена', from: input.entity.id }));
    }

    // ── Mail security ───────────────────────────────────────────────────────
    const mail = assessMailSecurity(records);
    out.evidence?.push(
      evidence('mail.spf', `SPF: ${mail.spf?.present ? truncate(String(mail.spf.value), 200) : 'отсутствует'}`, mail.spf ?? null, NETWORK_SOURCE, { reliability: 0.9, tags: ['mail', 'spf'] }),
      evidence('mail.dmarc', `DMARC: ${mail.dmarc?.present ? truncate(String(mail.dmarc.value), 200) : 'отсутствует'}`, mail.dmarc ?? null, NETWORK_SOURCE, { reliability: 0.9, tags: ['mail', 'dmarc'] }),
      evidence('mail.mx-provider', `Почтовый провайдер: ${mail.mx.map((entry) => entry.provider).join(', ') || 'MX не найден'}`, mail.mx, NETWORK_SOURCE, { reliability: 0.85, tags: ['mail', 'mx'] }),
      evidence('mail.mta-sts', `MTA-STS: ${mail.mtaSts?.present ? 'настроен' : 'отсутствует'}`, Boolean(mail.mtaSts?.present), NETWORK_SOURCE, { reliability: 0.85 }),
      evidence('mail.bimi', `BIMI: ${mail.bimi?.present ? 'настроен' : 'отсутствует'}`, Boolean(mail.bimi?.present), NETWORK_SOURCE, { reliability: 0.85 }),
      evidence('mail.security-score', `Интегральная оценка почтовой защиты домена: ${mail.score}/100`, mail.score, { name: 'Модель оценки почтовой защиты TOMAHAWK', kind: 'heuristic' }, { reliability: 0.7, tags: ['score'] }),
    );
    for (const finding of mail.findings) {
      out.evidence?.push(evidence('mail.finding', finding, finding, { name: 'Анализ почтовой защиты домена', kind: 'heuristic' }, { reliability: 0.8, tags: ['mail', 'caveat'] }));
    }
    if (!mail.dmarc?.present || mail.dmarc.policy !== 'reject') {
      out.riskFactors?.push(risk('cyber.domain-spoofable', mail.dmarc?.present ? 0.6 : 0.85, `Домен ${domain}: DMARC ${mail.dmarc?.present ? `в режиме p=${mail.dmarc.policy}` : 'отсутствует'} — возможна подделка писем от имени организации`, [], { tags: ['mail'] }));
    }
    if (mail.score >= 70) {
      out.evidence?.push(evidence('mail.posture', 'Почтовая защита домена настроена на зрелом уровне', mail.score, NETWORK_SOURCE, { reliability: 0.8, tags: ['posture'] }));
    }

    // DKIM selector probing (common selectors only — bounded).
    for (const selector of ['default', 'google', 'selector1', 'selector2', 'mail', 'dkim', 's1', 'k1']) {
      if (ctx.signal?.aborted) break;
      const dkim = await resolveRecords(ctx.http, `${selector}._domainkey.${domain}`, ['TXT'], { signal: ctx.signal, ttlMs: 15 * 60_000, resolverIds: ['cloudflare'] });
      const value = dkim.records.TXT?.[0]?.value;
      if (!value) continue;
      const parsed = parseDkimRecord(value);
      if (!parsed) continue;
      out.evidence?.push(
        evidence('mail.dkim', `DKIM-ключ найден (селектор ${selector}, ${parsed.keyType}, ~${parsed.keyBits ?? '?'} бит${parsed.revoked ? ', ОТОЗВАН' : ''})`, { selector, ...parsed }, NETWORK_SOURCE, { reliability: 0.9, tags: ['mail', 'dkim'] }),
      );
      if (parsed.revoked) out.riskFactors?.push(risk('cyber.mail-security-weak', 0.4, `DKIM-селектор ${selector} отозван — почта может не подписываться`, []));
      break;
    }

    // ── Cross-resolver divergence ───────────────────────────────────────────
    if (records.divergent.length) {
      out.evidence?.push(
        evidence('dns.divergence', `Резолверы разошлись по типам: ${records.divergent.join(', ')} — возможен гео-DNS или split-horizon`, records.divergent, { name: 'Сравнение ответов DoH-резолверов', kind: 'heuristic' }, { reliability: 0.7, tags: ['anomaly'] }),
      );
      out.riskFactors?.push(risk('cyber.dns-divergence', 0.35, `Разные публичные резолверы возвращают разные записи для ${host} — проверьте гео-таргетинг и целостность DNS`, []));
    }

    // ── RDAP registration ───────────────────────────────────────────────────
    try {
      const rdap = await ctx.http.json<RdapResponse>(`https://rdap.org/domain/${encodeURIComponent(domain)}`, { timeoutMs: 10_000, cacheTtlMs: 30 * 60_000, signal: ctx.signal });
      const events = rdap.events ?? [];
      const registration = events.find((entry) => entry.eventAction === 'registration');
      const expiration = events.find((entry) => entry.eventAction === 'expiration');
      const lastChanged = events.find((entry) => entry.eventAction === 'last changed');
      const registrarEntity = (rdap.entities ?? []).find((entry) => entry.roles?.includes('registrar'));
      const registrar = rdapVcardValue(registrarEntity as never);
      const abuseEntity = (rdap.entities ?? []).find((entry) => entry.roles?.includes('abuse'));
      const abuse = rdapVcardValue(abuseEntity as never);

      const ageDays = registration ? Math.round((Date.now() - Date.parse(registration.eventDate)) / 86_400_000) : undefined;

      out.evidence?.push(
        evidence('domain.registrar', `Регистратор: ${registrar.name ?? registrarEntity?.handle ?? 'не раскрыт'}`, registrar.name ?? registrarEntity?.handle ?? 'hidden', RDAP_SOURCE, { reliability: 0.9, tags: ['rdap'] }),
        evidence('domain.registered', `Дата регистрации: ${registration?.eventDate ?? 'не раскрыта'}${ageDays !== undefined ? ` (возраст ${ageDays} дн.)` : ''}`, registration?.eventDate ?? 'unknown', RDAP_SOURCE, { reliability: 0.9, tags: ['rdap'] }),
        evidence('domain.expires', `Дата окончания регистрации: ${expiration?.eventDate ?? 'не раскрыта'}`, expiration?.eventDate ?? 'unknown', RDAP_SOURCE, { reliability: 0.85 }),
        evidence('domain.last-changed', `Последнее изменение: ${lastChanged?.eventDate ?? 'не раскрыто'}`, lastChanged?.eventDate ?? 'unknown', RDAP_SOURCE, { reliability: 0.85 }),
        evidence('domain.status', `Статусы EPP: ${(rdap.status ?? []).join(', ') || 'не раскрыты'}`, rdap.status ?? [], RDAP_SOURCE, { reliability: 0.9, tags: ['rdap'] }),
        evidence('domain.nameservers', `NS по данным реестра: ${(rdap.nameservers ?? []).map((entry) => entry.ldhName?.toLowerCase()).join(', ') || '—'}`, (rdap.nameservers ?? []).map((entry) => entry.ldhName), RDAP_SOURCE, { reliability: 0.9 }),
        evidence('domain.abuse-contact', `Контакт для abuse-жалоб: ${abuse.emails.join(', ') || 'не раскрыт'}`, abuse.emails, RDAP_SOURCE, { reliability: 0.85, tags: ['contact', 'pivot'] }),
      );

      const isPrivacy = /privacy|protect|whoisguard|withheld|redacted|domains by proxy|reg\.ru|私人/i.test(JSON.stringify(rdap.entities ?? []));
      if (isPrivacy) {
        out.evidence?.push(evidence('domain.whois-privacy', 'Регистрант скрыт сервисом приватности — прямая атрибуция владельца по WHOIS невозможна', true, RDAP_SOURCE, { reliability: 0.85, tags: ['caveat'] }));
      }
      if (ageDays !== undefined && ageDays < 90) {
        out.riskFactors?.push(risk('cyber.typosquat-or-homoglyph', 0.45, `Домен зарегистрирован ${ageDays} дн. назад — свежие домены часто используются в мошеннических кампаниях`, [], { label: 'Свежая регистрация домена' }));
      }
      if (abuse.emails.length) {
        for (const email of abuse.emails.slice(0, 3)) {
          out.entities?.push(entity('email', email.toLowerCase(), { label: email, tags: ['abuse-contact'], confidence: 0.8 }));
          out.edges?.push(edge(input.entity.id, { type: 'email', value: email.toLowerCase() }, 'registered_at', 0.4, 0.75));
        }
      }
    } catch (error) {
      out.notes?.push(`RDAP недоступен: ${(error as Error).message.slice(0, 160)}`);
    }

    // ── HTTP fingerprint ────────────────────────────────────────────────────
    if (input.entity.type === 'domain' || input.entity.type === 'subdomain' || input.entity.type === 'url') {
      const target = input.entity.type === 'url' ? input.entity.value : `https://${host}/`;
      try {
        const body = await ctx.http.html(target, { timeoutMs: 12_000, cacheTtlMs: 5 * 60_000, signal: ctx.signal });
        const tech = detectTechStack(body);
        const securityHeaders = detectSecurityHeaders(body);
        out.evidence?.push(
          evidence('web.tech-stack', `Технологический стек: ${tech.join(', ') || 'не определён'}`, tech, { name: 'HTTP-фингерпринт TOMAHAWK', kind: 'heuristic' }, { reliability: 0.65, tags: ['fingerprint'] }),
          evidence('web.security-headers', `Заголовки безопасности (по HTML-признакам): ${securityHeaders.join(', ') || 'не обнаружены'}`, securityHeaders, { name: 'HTTP-фингерпринт TOMAHAWK', kind: 'heuristic' }, { reliability: 0.6, tags: ['fingerprint'] }),
          evidence('web.title', `Заголовок страницы: ${truncate(extractTitle(body), 180)}`, extractTitle(body), { name: target, kind: 'web', url: target }, { reliability: 0.7, tags: ['page'] }),
        );
        if (body.length > 0 && !securityHeaders.length) {
          out.riskFactors?.push(risk('cyber.exposed-service', 0.25, `${host}: не обнаружены базовые заголовки безопасности (HSTS/CSP/X-Frame-Options)`, []));
        }
      } catch (error) {
        out.notes?.push(`HTTP-фингерпринт недоступен: ${(error as Error).message.slice(0, 120)}`);
      }
    }

    out.metrics = { records: Object.values(records.records).reduce((sum, entries) => sum + entries.length, 0), mailScore: mail.score, divergentTypes: records.divergent.length };
    return out;
  },
};

async function investigateIp(ip: string, input: ModuleInput, ctx: ModuleContext, out: ModuleResult): Promise<ModuleResult> {
  if (isPrivateIp(ip)) {
    out.notes?.push(`IP ${ip} находится в частном диапазоне (RFC 1918) — внешняя атрибуция невозможна`);
    out.evidence?.push(evidence('ip.private', `${ip} — частный адрес, не маршрутизируется в интернете`, true, { name: 'Классификация RFC 1918 (локально)', kind: 'algorithm' }, { reliability: 0.99 }));
    return out;
  }

  try {
    const info = await ctx.http.json<IpInfo>(`https://ipwho.is/${encodeURIComponent(ip)}`, { cacheTtlMs: 30 * 60_000, timeoutMs: 10_000, signal: ctx.signal });
    const asn = info.connection?.asn ? `AS${info.connection.asn}` : undefined;
    out.evidence?.push(
      evidence('ip.country', `Страна: ${info.country ?? 'не определена'} (${info.country_code ?? '?'})`, info.country ?? 'unknown', IP_SOURCE, { reliability: 0.85, tags: ['geo'] }),
      evidence('ip.region-city', `Регион/город: ${info.region ?? '—'} / ${info.city ?? '—'}`, { region: info.region, city: info.city }, IP_SOURCE, { reliability: 0.8, tags: ['geo'] }),
      evidence('ip.asn', `Автономная система: ${asn ?? 'не определена'} (${info.connection?.org ?? info.connection?.isp ?? '—'})`, { asn: info.connection?.asn, org: info.connection?.org, isp: info.connection?.isp }, IP_SOURCE, { reliability: 0.85, tags: ['asn'] }),
      evidence('ip.anonymity', `Признаки анонимизации: VPN=${info.security?.vpn ? 'да' : 'нет'}, proxy=${info.security?.proxy ? 'да' : 'нет'}, Tor=${info.security?.tor ? 'да' : 'нет'}, hosting=${info.security?.hosting ? 'да' : 'нет'}`, info.security ?? {}, { name: 'Классификатор ipwho.is', kind: 'api' }, { reliability: 0.75, tags: ['anonymity'] }),
    );

    if (asn) {
      out.entities?.push(entity('asn', asn, { label: `${asn} — ${info.connection?.org ?? ''}`.trim(), tags: ['infrastructure'], confidence: 0.85 }));
      out.edges?.push(edge(input.entity.id, { type: 'asn', value: asn }, 'hosted_on', 0.8, 0.85));
      out.pivots?.push(pivot('asn', asn, { relation: 'hosted_on', confidence: 0.85, reason: 'ASN-принадлежность IP раскрывает инфраструктуру', from: input.entity.id }));
    }
    if (info.city) {
      out.entities?.push(entity('location', `${info.city}, ${info.country}`, { label: `${info.city}, ${info.country ?? ''}`, properties: { latitude: info.latitude, longitude: info.longitude }, tags: ['geo-ip'], confidence: 0.7 }));
      out.edges?.push(edge(input.entity.id, { type: 'location', value: `${info.city}, ${info.country}` }, 'located_at', 0.5, 0.7));
    }
    if (info.security?.vpn || info.security?.tor || info.security?.proxy) {
      out.riskFactors?.push(risk('cyber.anonymity-infrastructure', info.security?.tor ? 0.8 : 0.5, `IP ${ip} определён как ${info.security?.tor ? 'Tor-узел' : info.security?.vpn ? 'VPN-выход' : 'прокси'} — источник маскировал реальный адрес`, []));
    }
    if (info.security?.hosting) {
      out.evidence?.push(evidence('ip.hosting', 'Адрес принадлежит хостинг-провайдеру/ЦОД (не абонентский доступ)', true, IP_SOURCE, { reliability: 0.8, tags: ['infrastructure'] }));
    }
    if (info.timezone?.id) {
      out.evidence?.push(evidence('ip.timezone', `Часовой пояс: ${info.timezone.id}`, info.timezone.id, IP_SOURCE, { reliability: 0.85, tags: ['timezone'] }));
    }
  } catch (error) {
    out.notes?.push(`IP-геолокация недоступна: ${(error as Error).message.slice(0, 140)}`);
  }

  const ptr = await reverseDns(ctx.http, ip, { signal: ctx.signal, ttlMs: 30 * 60_000 });
  if (ptr.length) {
    out.evidence?.push(evidence('ip.ptr', `Обратная запись (PTR): ${ptr.join(', ')}`, ptr, { name: 'DoH PTR (in-addr.arpa)', kind: 'dns' }, { reliability: 0.9, tags: ['attribution', 'best-pivot'] }));
    for (const name of ptr.slice(0, 3)) {
      const host = name.replace(/\.$/, '');
      out.entities?.push(entity('subdomain', host, { label: host, tags: ['ptr'], confidence: 0.85 }));
      out.edges?.push(edge(input.entity.id, { type: 'subdomain', value: host }, 'same_as', 0.7, 0.85));
      out.pivots?.push(pivot('domain', registrableDomain(host), { relation: 'same_as', confidence: 0.8, reason: 'PTR указывает на домен владельца сети', from: input.entity.id }));
    }
  }

  try {
    const rdap = await ctx.http.json<RdapResponse>(`https://rdap.org/ip/${encodeURIComponent(ip)}`, { cacheTtlMs: 60 * 60_000, timeoutMs: 10_000, signal: ctx.signal, transit: ['direct', 'allorigins', 'codetabs', 'jina'] });
    const netblock = rdap.startAddress && rdap.endAddress ? `${rdap.startAddress} — ${rdap.endAddress}` : rdap.handle;
    out.evidence?.push(
      evidence('ip.rdap-network', `Сеть (RDAP): ${netblock ?? 'не определена'}, владелец: ${rdap.name ?? 'не раскрыт'}, страна регистрации: ${rdap.country ?? '—'}`, { handle: rdap.handle, start: rdap.startAddress, end: rdap.endAddress, name: rdap.name, country: rdap.country }, RDAP_SOURCE, { reliability: 0.9, tags: ['rdap'] }),
    );
    if (rdap.startAddress && rdap.endAddress) {
      const cidr = `${rdap.startAddress}/${cidrFromRange(rdap.startAddress, rdap.endAddress)}`;
      out.entities?.push(entity('netblock', cidr, { label: cidr, tags: ['netblock'], confidence: 0.8 }));
      out.edges?.push(edge(input.entity.id, { type: 'netblock', value: cidr }, 'member_of', 0.8, 0.85));
      out.pivots?.push(pivot('netblock', cidr, { relation: 'member_of', confidence: 0.75, reason: 'Вся подсеть принадлежит одному владельцу — источник соседних активов', from: input.entity.id }));
    }
    for (const entityEntry of rdap.entities ?? []) {
      const vcard = rdapVcardValue(entityEntry as never);
      if (!vcard.name) continue;
      out.evidence?.push(evidence('ip.rdap-owner', `Владелец сети по RDAP: ${vcard.name}${vcard.emails.length ? ` (${vcard.emails.join(', ')})` : ''}`, { name: vcard.name, emails: vcard.emails }, RDAP_SOURCE, { reliability: 0.85, tags: ['attribution'] }));
      out.entities?.push(entity('organization', vcard.name, { label: vcard.name, tags: ['net-owner'], confidence: 0.75 }));
      out.edges?.push(edge(input.entity.id, { type: 'organization', value: vcard.name }, 'owned_by', 0.6, 0.75));
      break;
    }
  } catch (error) {
    out.notes?.push(`RDAP для IP недоступен: ${(error as Error).message.slice(0, 140)}`);
  }

  return out;
}

/**
 * Smallest CIDR prefix that *covers* [start, end]: the range must be
 * representable by a single block, so we shrink the prefix until the aligned
 * network contains the whole range.
 */
function cidrFromRange(start: string, end: string): number {
  const toInt = (ip: string): number => ip.split('.').reduce((acc, part) => ((acc << 8) | (Number(part) & 0xff)) >>> 0, 0);
  const startInt = toInt(start);
  const endInt = toInt(end);
  if (!(endInt >= startInt)) return 32;
  for (let prefix = 32; prefix >= 0; prefix -= 1) {
    const blockSize = 2 ** (32 - prefix);
    const blockStart = Math.floor(startInt / blockSize) * blockSize;
    if (blockStart + blockSize - 1 >= endInt) return prefix;
  }
  return 0;
}

function extractTitle(html: string): string {
  const match = /<title[^>]*>([\s\S]{0,200}?)<\/title>/i.exec(html);
  return match?.[1]?.replace(/\s+/g, ' ').trim() ?? '(без заголовка)';
}

const TECH_SIGNATURES: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /wp-content|wp-includes/i, label: 'WordPress' },
  { pattern: /bitrix|1c-bitrix/i, label: '1C-Bitrix' },
  { pattern: /drupal/i, label: 'Drupal' },
  { pattern: /joomla/i, label: 'Joomla' },
  { pattern: /tilda/i, label: 'Tilda' },
  { pattern: /wix\.com/i, label: 'Wix' },
  { pattern: /shopify/i, label: 'Shopify' },
  { pattern: /react|__next|_next\/static/i, label: 'React / Next.js' },
  { pattern: /vue\.js|__vue__/i, label: 'Vue.js' },
  { pattern: /angular/i, label: 'Angular' },
  { pattern: /jquery/i, label: 'jQuery' },
  { pattern: /cloudflare/i, label: 'Cloudflare (CDN/WAF)' },
  { pattern: /nginx/i, label: 'Nginx' },
  { pattern: /apache/i, label: 'Apache' },
  { pattern: /google-analytics|gtag\(/i, label: 'Google Analytics' },
  { pattern: /mc\.yandex|metrika/i, label: 'Яндекс.Метрика' },
  { pattern: /vk\.com\/js|openapi\.js/i, label: 'VK API' },
  { pattern: /recaptcha/i, label: 'Google reCAPTCHA' },
  { pattern: /cloudflare-turnstile|challenges\.cloudflare/i, label: 'Cloudflare Turnstile' },
];

export function detectTechStack(html: string): string[] {
  const found = new Set<string>();
  for (const signature of TECH_SIGNATURES) if (signature.pattern.test(html)) found.add(signature.label);
  return [...found];
}

export function detectSecurityHeaders(html: string): string[] {
  const found: string[] = [];
  if (/content-security-policy/i.test(html)) found.push('CSP');
  if (/strict-transport-security/i.test(html)) found.push('HSTS');
  if (/x-frame-options|frame-ancestors/i.test(html)) found.push('X-Frame-Options');
  if (/x-content-type-options/i.test(html)) found.push('X-Content-Type-Options');
  if (/permissions-policy/i.test(html)) found.push('Permissions-Policy');
  return found;
}

export const networkModules = [infrastructureModule];
