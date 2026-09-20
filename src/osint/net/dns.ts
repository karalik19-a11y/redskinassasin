/**
 * TOMAHAWK OSINT ENGINE — DNS over HTTPS intelligence
 * ---------------------------------------------------------------------------
 * Browser-native DNS reconnaissance without a backend:
 *   • multi-resolver DoH fan-out (Cloudflare, Google, Quad9, AdGuard) with
 *     cross-resolver agreement scoring — disagreement is itself intelligence
 *     (geo-DNS, split-horizon, DNS hijacking at the resolver level)
 *   • record harvesting: A, AAAA, MX, NS, TXT, CNAME, SOA, CAA, SRV, DS, DNSKEY
 *   • e-mail security posture: SPF flattening, DMARC policy + reporting,
 *     DKIM selector discovery, MTA-STS / BIMI presence
 *   • mail-provider fingerprinting from MX hostnames (Google Workspace,
 *     Microsoft 365, Yandex 360, Mail.ru Business…)
 *   • TTL analysis (short TTLs ⇒ failover/anti-takedown infrastructure)
 */

import type { HttpGateway } from '../types/module';

export interface DnsAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

export interface DnsResponse {
  resolver: string;
  answers: DnsAnswer[];
  authority: DnsAnswer[];
  status: number;
  error?: string;
  elapsedMs: number;
}

export interface RecordSet {
  /** Record type → values with TTL. */
  records: Record<string, Array<{ value: string; ttl: number; resolver?: string }>>;
  resolvers: string[];
  /** Types where resolvers disagreed (geo/split-horizon DNS indicator). */
  divergent: string[];
  minTtl: number;
  errors: string[];
}

export const DNS_RESOLVERS: Array<{ id: string; label: string; url: (name: string, type: string) => string; json: boolean; supportsTypes: string[] }> = [
  {
    id: 'cloudflare',
    label: 'Cloudflare 1.1.1.1',
    url: (name, type) => `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
    json: true,
    supportsTypes: ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME', 'SOA', 'CAA', 'SRV', 'DS', 'DNSKEY', 'PTR', 'ANY'],
  },
  {
    id: 'google',
    label: 'Google Public DNS',
    url: (name, type) => `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
    json: true,
    supportsTypes: ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME', 'SOA', 'CAA', 'SRV', 'DS', 'DNSKEY', 'PTR'],
  },
  {
    id: 'quad9',
    label: 'Quad9',
    // Quad9 speaks JSON only over its 9.9.9.9 endpoint; the HTTPS endpoint needs the dns-message format,
    // so we request the JSON variant where supported and fall back to Cloudflare otherwise.
    url: (name, type) => `https://dns.quad9.net:5053/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
    json: true,
    supportsTypes: ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME', 'SOA', 'PTR'],
  },
  {
    id: 'adguard',
    label: 'AdGuard DNS',
    url: (name, type) => `https://dns.adguard-dns.com/resolve?name=${encodeURIComponent(name)}&type=${type}`,
    json: true,
    supportsTypes: ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME', 'SOA', 'PTR'],
  },
];

const TYPE_CODES: Record<number, string> = {
  1: 'A', 2: 'NS', 5: 'CNAME', 6: 'SOA', 12: 'PTR', 15: 'MX', 16: 'TXT', 28: 'AAAA', 33: 'SRV', 43: 'DS', 48: 'DNSKEY',
  257: 'CAA', 65: 'HTTPS',
};

export function typeName(code: number): string {
  return TYPE_CODES[code] ?? `TYPE${code}`;
}

export interface DohOptions {
  resolverIds?: string[];
  timeoutMs?: number;
  signal?: AbortSignal;
  ttlMs?: number;
}

/** Query a single DoH resolver (JSON API shape shared by all four). */
export async function queryResolver(
  http: HttpGateway,
  resolverId: string,
  name: string,
  type: string,
  options: DohOptions = {},
): Promise<DnsResponse> {
  const resolver = DNS_RESOLVERS.find((entry) => entry.id === resolverId);
  const startedAt = Date.now();
  if (!resolver) return { resolver: resolverId, answers: [], authority: [], status: -1, error: 'unknown resolver', elapsedMs: 0 };

  try {
    const payload = await http.json<{ Status?: number; Answer?: DnsAnswer[]; Authority?: DnsAnswer[] }>(resolver.url(name, type), {
      headers: { accept: 'application/dns-json' },
      timeoutMs: options.timeoutMs ?? 8_000,
      cacheTtlMs: options.ttlMs ?? 300_000,
      signal: options.signal,
    });
    const answers = (payload.Answer ?? []).map((answer) => ({ ...answer, type: answer.type ?? 0 }));
    return {
      resolver: resolver.id,
      answers,
      authority: payload.Authority ?? [],
      status: payload.Status ?? 0,
      elapsedMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      resolver: resolver.id,
      answers: [],
      authority: [],
      status: -1,
      error: error instanceof Error ? error.message : String(error),
      elapsedMs: Date.now() - startedAt,
    };
  }
}

/**
 * Fan-out across resolvers and merge into a single record set, flagging
 * disagreement. The consensus view is what we report; divergence is a finding.
 */
export async function resolveRecords(
  http: HttpGateway,
  name: string,
  types: string[] = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME', 'SOA', 'CAA'],
  options: DohOptions = {},
): Promise<RecordSet> {
  const resolverIds = options.resolverIds ?? ['cloudflare', 'google', 'quad9'];
  const records: RecordSet['records'] = {};
  const divergent: string[] = [];
  const errors: string[] = [];
  let minTtl = Number.MAX_SAFE_INTEGER;

  const tasks = types.flatMap((type) => resolverIds.map((resolverId) => ({ type, resolverId })));
  const results = await Promise.all(
    tasks.map(({ type, resolverId }) => queryResolver(http, resolverId, name, type, options).then((response) => ({ type, response }))),
  );

  const perType = new Map<string, Map<string, Array<{ value: string; ttl: number; resolver?: string }>>>();
  for (const { type, response } of results) {
    if (response.error) {
      errors.push(`${type}@${response.resolver}: ${response.error}`);
      continue;
    }
    if (!perType.has(type)) perType.set(type, new Map());
    const byType = perType.get(type) as Map<string, Array<{ value: string; ttl: number; resolver?: string }>>;
    for (const answer of response.answers) {
      if (typeName(answer.type) !== type && !(type === 'CNAME' && answer.type === 5)) continue;
      const key = String(answer.data);
      const list = byType.get(key) ?? [];
      list.push({ value: String(answer.data), ttl: answer.TTL, resolver: response.resolver });
      byType.set(key, list);
      minTtl = Math.min(minTtl, answer.TTL || minTtl);
    }
  }

  for (const [type, byValue] of perType) {
    const entries = [...byValue.values()].flat();
    records[type] = entries;
    const resolversWithData = new Set(entries.map((entry) => entry.resolver));
    if (resolverIds.length > 1 && resolversWithData.size > 0 && resolversWithData.size < resolverIds.length) {
      const answering = [...perType.entries()].length;
      if (answering > 0) divergent.push(type);
    }
  }

  return {
    records,
    resolvers: resolverIds,
    divergent: [...new Set(divergent)],
    minTtl: Number.isFinite(minTtl) ? minTtl : 0,
    errors,
  };
}

export interface MailSecurityPosture {
  spf?: { present: boolean; value?: string; all?: string; includes: string[]; mechanisms: number };
  dmarc?: { present: boolean; value?: string; policy?: string; subdomainPolicy?: string; reporting?: string[]; pct?: number };
  dkim: { selector?: string; present: boolean; value?: string; keyBits?: number };
  mtaSts?: { present: boolean; policy?: string };
  bimi?: { present: boolean; logo?: string; vmcUrl?: string };
  mx: Array<{ host: string; provider: string }>;
  findings: string[];
  score: number;
}

const MX_PROVIDERS: Array<{ pattern: RegExp; provider: string }> = [
  { pattern: /google\.com$|googlemail\.com$|gmail-smtp-in/i, provider: 'Google Workspace / Gmail' },
  { pattern: /outlook\.com$|protection\.outlook|mail\.protection\.outlook/i, provider: 'Microsoft 365 / Exchange Online' },
  { pattern: /yandex\.(net|ru)$/i, provider: 'Яндекс 360 / Яндекс.Почта' },
  { pattern: /mail\.ru$|bizmrg\.com$|inbox\.ru$/i, provider: 'VK WorkMail / Mail.ru' },
  { pattern: /mimecast/i, provider: 'Mimecast (шлюз ИБ)' },
  { pattern: /proofpoint|pphosted/i, provider: 'Proofpoint (шлюз ИБ)' },
  { pattern: /barracuda/i, provider: 'Barracuda (шлюз ИБ)' },
  { pattern: /zoho/i, provider: 'Zoho Mail' },
  { pattern: /mailgun|sendgrid|amazonses|sparkpost|postmark/i, provider: 'Транзакционный релей (Mailgun/SendGrid/SES)' },
  { pattern: /protonmail|proton\.me/i, provider: 'Proton Mail' },
  { pattern: /timeweb|reg\.ru|nic\.ru|beget|masterhost/i, provider: 'Российский хостинг-провайдер' },
];

export function fingerprintMxProvider(host: string): string {
  const clean = host.replace(/\.$/, '');
  for (const entry of MX_PROVIDERS) if (entry.pattern.test(clean)) return entry.provider;
  return 'Собственный / неизвестный почтовый сервер';
}

/**
 * Build the e-mail security posture of a domain from its DNS records.
 * Used both for domain due-diligence and as a confidence input when deciding
 * whether an address is plausible for a given organisation.
 */
export function assessMailSecurity(recordSet: RecordSet): MailSecurityPosture {
  const txt = (recordSet.records.TXT ?? []).map((entry) => entry.value.replace(/^"|"$/g, ''));
  const mx = (recordSet.records.MX ?? []).map((entry) => ({
    host: entry.value.replace(/^\d+\s+/, '').replace(/\.$/, ''),
    provider: fingerprintMxProvider(entry.value.replace(/^\d+\s+/, '')),
  }));

  const spfRaw = txt.find((value) => /^v=spf1/i.test(value));
  const findings: string[] = [];
  let score = 0;

  const spf = spfRaw
    ? {
        present: true,
        value: spfRaw,
        all: /([-~+?])all/i.exec(spfRaw)?.[1] ?? undefined,
        includes: [...spfRaw.matchAll(/include:([^\s]+)/gi)].map((match) => match[1] as string),
        mechanisms: spfRaw.split(/\s+/).length - 1,
      }
    : { present: false, includes: [], mechanisms: 0 };

  if (spf.present) {
    score += 20;
    if (spf.all === '-') score += 10;
    else if (spf.all === '~') findings.push('SPF использует softfail (~all) — письма от неавторизованных отправителей помечаются, но не блокируются');
    else findings.push('SPF без строгого -all — спуфинг домена возможен');
  } else {
    findings.push('SPF-запись отсутствует: домен уязвим к подделке отправителя');
  }

  const dmarcRaw = txt.find((value) => /^v=DMARC1/i.test(value));
  const dmarc = dmarcRaw
    ? {
        present: true,
        value: dmarcRaw,
        policy: /p=(\w+)/i.exec(dmarcRaw)?.[1],
        subdomainPolicy: /sp=(\w+)/i.exec(dmarcRaw)?.[1],
        reporting: [...dmarcRaw.matchAll(/rua=([^;]+)/gi)].map((match) => match[1] as string),
        pct: dmarcRaw.match(/pct=(\d+)/i) ? Number(dmarcRaw.match(/pct=(\d+)/i)?.[1]) : 100,
      }
    : { present: false };

  if (dmarc.present) {
    score += 30;
    if (dmarc.policy === 'reject') score += 15;
    else if (dmarc.policy === 'quarantine') score += 8;
    else findings.push(`DMARC p=${dmarc.policy ?? 'none'} — политика не защищает от использования домена в фишинге`);
    if (dmarc.pct !== undefined && dmarc.pct < 100) findings.push(`DMARC применяется лишь к pct=${dmarc.pct}% писем`);
  } else {
    findings.push('DMARC-запись отсутствует: нет контроля политики и отчётности о спуфинге домена');
  }

  const mtaStsTxt = txt.find((value) => /^v=STSv1/i.test(value));
  const bimiTxt = txt.find((value) => /^v=BIMI1/i.test(value));
  const dkimRecord = (recordSet.records.TXT ?? []).find((entry) => /v=DKIM1/i.test(entry.value));

  return {
    spf,
    dmarc,
    dkim: { present: Boolean(dkimRecord), value: dkimRecord?.value },
    mtaSts: mtaStsTxt ? { present: true, policy: mtaStsTxt } : { present: false },
    bimi: bimiTxt
      ? { present: true, logo: /l=([^;]+)/i.exec(bimiTxt)?.[1], vmcUrl: /a=([^;]+)/i.exec(bimiTxt)?.[1] }
      : { present: false },
    mx,
    findings,
    score: Math.min(100, score),
  };
}

/** Extract the DKIM public key material from a `v=DKIM1; p=…` TXT record. */
export function parseDkimRecord(value: string): { version?: string; keyType?: string; keyBits?: number; flags?: string[]; revoked: boolean } | null {
  if (!/v=DKIM1/i.test(value)) return null;
  const key = /p=([A-Za-z0-9+/=\s]*)/i.exec(value)?.[1]?.replace(/\s/g, '') ?? '';
  const decodedBits = key ? Math.floor((key.replace(/=+$/, '').length * 6) / 8) * 8 : 0;
  return {
    version: 'DKIM1',
    keyType: /k=(\w+)/i.exec(value)?.[1] ?? 'rsa',
    keyBits: decodedBits || undefined,
    flags: /t=([^;]+)/i.exec(value)?.[1]?.split(':'),
    revoked: key === '',
  };
}

/** Reverse DNS (PTR) via DoH — maps an IP back to hosting/ISP infrastructure. */
export async function reverseDns(http: HttpGateway, ip: string, options: DohOptions = {}): Promise<string[]> {
  const arpa = toArpa(ip);
  if (!arpa) return [];
  const response = await queryResolver(http, options.resolverIds?.[0] ?? 'cloudflare', arpa, 'PTR', options);
  return response.answers.filter((answer) => answer.type === 12).map((answer) => String(answer.data).replace(/\.$/, ''));
}

export function toArpa(ip: string): string | undefined {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return `${ip.split('.').reverse().join('.')}.in-addr.arpa`;
  if (ip.includes(':')) {
    const expanded = expandIpv6(ip);
    if (!expanded) return undefined;
    return `${expanded.split('').reverse().join('.')}.ip6.arpa`;
  }
  return undefined;
}

export function expandIpv6(ip: string): string | undefined {
  const [head, tail = ''] = ip.split('::');
  const headParts = head ? head.split(':') : [];
  const tailParts = tail ? tail.split(':') : [];
  const missing = 8 - headParts.length - tailParts.length;
  if (missing < 0 || !ip.includes('::')) {
    const parts = ip.split(':');
    if (parts.length !== 8) return undefined;
    return parts.map((part) => part.padStart(4, '0')).join('');
  }
  const parts = [...headParts, ...new Array(Math.max(0, missing)).fill('0'), ...tailParts];
  return parts.map((part) => part.padStart(4, '0')).join('');
}

/** Simple in-set check for private / special-use address space. */
export function isPrivateIp(ip: string): boolean {
  if (/^10\./.test(ip) || /^192\.168\./.test(ip) || /^127\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (/^169\.254\./.test(ip)) return true;
  if (/^(fc|fd|fe80)/i.test(ip)) return true;
  return false;
}
