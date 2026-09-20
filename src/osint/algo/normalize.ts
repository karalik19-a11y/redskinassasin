/**
 * TOMAHAWK OSINT ENGINE — normalisation & entity resolution helpers
 * ---------------------------------------------------------------------------
 * Canonicalisation is what makes the graph merge: `+7 (916) 402-91-88`,
 * `89164029188`, `8 916 402 91 88` and `+79164029188` must all resolve to one
 * node. Same for e-mail aliasing (Gmail dots/+tags), URL tracking noise,
 * Cyrillic homoglyph domains and numeric identifier formatting.
 */

import { skeletonize, stripDiacritics } from './stringdistance';

// ─────────────────────────────────────────────────────────────────────────────
// Phones
// ─────────────────────────────────────────────────────────────────────────────

/** Calling codes we resolve locally (offline-capable E.164 parsing). */
export const COUNTRY_CALLING_CODES: Record<string, { country: string; code: string; nsnLengths: number[]; trunk?: string }> = {
  RU: { country: 'Россия', code: '7', nsnLengths: [10], trunk: '8' },
  KZ: { country: 'Казахстан', code: '7', nsnLengths: [10], trunk: '8' },
  BY: { country: 'Беларусь', code: '375', nsnLengths: [9], trunk: '8' },
  UA: { country: 'Украина', code: '380', nsnLengths: [9], trunk: '0' },
  UZ: { country: 'Узбекистан', code: '998', nsnLengths: [9], trunk: '8' },
  KG: { country: 'Киргизия', code: '996', nsnLengths: [9], trunk: '0' },
  TJ: { country: 'Таджикистан', code: '992', nsnLengths: [9], trunk: '8' },
  AM: { country: 'Армения', code: '374', nsnLengths: [8], trunk: '0' },
  AZ: { country: 'Азербайджан', code: '994', nsnLengths: [9], trunk: '0' },
  GE: { country: 'Грузия', code: '995', nsnLengths: [9], trunk: '0' },
  MD: { country: 'Молдова', code: '373', nsnLengths: [8], trunk: '0' },
  US: { country: 'США', code: '1', nsnLengths: [10], trunk: '1' },
  CA: { country: 'Канада', code: '1', nsnLengths: [10], trunk: '1' },
  GB: { country: 'Великобритания', code: '44', nsnLengths: [10], trunk: '0' },
  DE: { country: 'Германия', code: '49', nsnLengths: [10, 11], trunk: '0' },
  FR: { country: 'Франция', code: '33', nsnLengths: [9], trunk: '0' },
  IT: { country: 'Италия', code: '39', nsnLengths: [9, 10] },
  ES: { country: 'Испания', code: '34', nsnLengths: [9] },
  NL: { country: 'Нидерланды', code: '31', nsnLengths: [9], trunk: '0' },
  PL: { country: 'Польша', code: '48', nsnLengths: [9] },
  TR: { country: 'Турция', code: '90', nsnLengths: [10], trunk: '0' },
  AE: { country: 'ОАЭ', code: '971', nsnLengths: [9], trunk: '0' },
  IL: { country: 'Израиль', code: '972', nsnLengths: [9], trunk: '0' },
  CN: { country: 'Китай', code: '86', nsnLengths: [11], trunk: '0' },
  IN: { country: 'Индия', code: '91', nsnLengths: [10], trunk: '0' },
  JP: { country: 'Япония', code: '81', nsnLengths: [10], trunk: '0' },
  KR: { country: 'Южная Корея', code: '82', nsnLengths: [10], trunk: '0' },
  SG: { country: 'Сингапур', code: '65', nsnLengths: [8] },
  HK: { country: 'Гонконг', code: '852', nsnLengths: [8] },
  TH: { country: 'Таиланд', code: '66', nsnLengths: [9], trunk: '0' },
  VN: { country: 'Вьетнам', code: '84', nsnLengths: [9], trunk: '0' },
  BR: { country: 'Бразилия', code: '55', nsnLengths: [10, 11], trunk: '0' },
  MX: { country: 'Мексика', code: '52', nsnLengths: [10] },
  AR: { country: 'Аргентина', code: '54', nsnLengths: [10], trunk: '0' },
  ZA: { country: 'ЮАР', code: '27', nsnLengths: [9], trunk: '0' },
  EG: { country: 'Египет', code: '20', nsnLengths: [10], trunk: '0' },
  NG: { country: 'Нигерия', code: '234', nsnLengths: [10], trunk: '0' },
  CH: { country: 'Швейцария', code: '41', nsnLengths: [9], trunk: '0' },
  AT: { country: 'Австрия', code: '43', nsnLengths: [10], trunk: '0' },
  SE: { country: 'Швеция', code: '46', nsnLengths: [9], trunk: '0' },
  NO: { country: 'Норвегия', code: '47', nsnLengths: [8] },
  FI: { country: 'Финляндия', code: '358', nsnLengths: [9], trunk: '0' },
  DK: { country: 'Дания', code: '45', nsnLengths: [8] },
  CZ: { country: 'Чехия', code: '420', nsnLengths: [9] },
  RO: { country: 'Румыния', code: '40', nsnLengths: [9], trunk: '0' },
  RS: { country: 'Сербия', code: '381', nsnLengths: [9], trunk: '0' },
  GR: { country: 'Греция', code: '30', nsnLengths: [10] },
  PT: { country: 'Португалия', code: '351', nsnLengths: [9] },
  IE: { country: 'Ирландия', code: '353', nsnLengths: [9], trunk: '0' },
  BE: { country: 'Бельгия', code: '32', nsnLengths: [9], trunk: '0' },
  LV: { country: 'Латвия', code: '371', nsnLengths: [8] },
  LT: { country: 'Литва', code: '370', nsnLengths: [8] },
  EE: { country: 'Эстония', code: '372', nsnLengths: [8] },
};

export interface ParsedPhone {
  raw: string;
  e164?: string;
  countryCode?: string;
  nationalNumber?: string;
  country?: string;
  region?: string;
  trunkPrefixUsed: boolean;
  isValid: boolean;
  error?: string;
}

/**
 * Offline E.164 parser. Understands national trunk prefixes (RU `8…`),
 * international `+`, `00` prefixes and bare national numbers via a default
 * country, then validates length against the numbering plan.
 */
export function parsePhone(input: string, defaultCountry = 'RU'): ParsedPhone {
  const raw = input;
  const digitsOnly = input.replace(/[^\d+]/g, '');
  let digits = digitsOnly.replace(/\D/g, '');
  let trunkPrefixUsed = false;

  if (!digits) return { raw, trunkPrefixUsed, isValid: false, error: 'Нет цифр в номере' };

  // International dialling prefix "00"
  if (!input.trim().startsWith('+') && digits.startsWith('00')) digits = digits.slice(2);

  let countryKey: string | undefined;
  const defaultMeta = COUNTRY_CALLING_CODES[defaultCountry.toUpperCase()];
  const hasPlus = input.trim().startsWith('+');

  const matchByCode = (): { key: string; meta: (typeof COUNTRY_CALLING_CODES)[string] } | undefined => {
    const candidates = Object.entries(COUNTRY_CALLING_CODES).sort((a, b) => b[1].code.length - a[1].code.length);
    for (const [key, meta] of candidates) {
      if (!digits.startsWith(meta.code)) continue;
      const rest = digits.slice(meta.code.length);
      if (meta.nsnLengths.includes(rest.length)) return { key, meta };
    }
    return undefined;
  };

  if (hasPlus) {
    const found = matchByCode();
    if (found) {
      countryKey = found.key;
      digits = digits.slice(found.meta.code.length);
    }
  } else if (digits.length === 10 && defaultMeta?.nsnLengths.includes(10)) {
    // Bare national number, e.g. 9164029188 in RU
    countryKey = defaultCountry.toUpperCase();
  } else if (digits.length === 11 && defaultMeta && digits.startsWith(defaultMeta.trunk ?? '')) {
    digits = digits.slice(1);
    trunkPrefixUsed = true;
    countryKey = defaultCountry.toUpperCase();
  } else {
    const found = matchByCode();
    if (found && digits.length > (defaultMeta?.nsnLengths[0] ?? 0)) {
      countryKey = found.key;
      digits = digits.slice(found.meta.code.length);
    } else if (defaultMeta?.nsnLengths.includes(digits.length)) {
      countryKey = defaultCountry.toUpperCase();
    }
  }

  const meta = countryKey ? COUNTRY_CALLING_CODES[countryKey] : undefined;
  if (!meta) {
    return { raw, nationalNumber: digits, trunkPrefixUsed, isValid: false, error: 'Не удалось сопоставить код страны / длину номера' };
  }

  const lengthOk = meta.nsnLengths.includes(digits.length);
  const e164 = `+${meta.code}${digits}`;
  return {
    raw,
    e164,
    countryCode: `+${meta.code}`,
    nationalNumber: digits,
    country: meta.country,
    trunkPrefixUsed,
    isValid: lengthOk,
    error: lengthOk ? undefined : `Длина национального номера ${digits.length} не соответствует плану нумерации ${meta.country} (${meta.nsnLengths.join('/')})`,
  };
}

export function formatPhoneE164(input: string, defaultCountry = 'RU'): string | undefined {
  return parsePhone(input, defaultCountry).e164;
}

// ─────────────────────────────────────────────────────────────────────────────
// E-mail
// ─────────────────────────────────────────────────────────────────────────────

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'yopmail.com', '10minutemail.com', 'guerrillamail.com', 'guerrillamail.net', 'sharklasers.com',
  'trashmail.com', 'temp-mail.org', 'tempmail.com', 'throwawaymail.com', 'getnada.com', 'dispostable.com',
  'maildrop.cc', 'fakeinbox.com', 'mytemp.email', 'tempinbox.com', 'spam4.me', 'grr.la', 'emailondeck.com',
  'mohmal.com', 'mailnesia.com', 'tempr.email', 'discard.email', 'mozmail.com', 'inboxkitten.com', 'mailcatch.com',
  '1secmail.com', '1secmail.net', '1secmail.org', 'dropmail.me', 'vomoto.com', 'burnermail.io', 'tempmailo.com',
]);

const ROLE_PREFIXES = new Set([
  'info', 'admin', 'administrator', 'support', 'sales', 'billing', 'abuse', 'postmaster', 'webmaster', 'noreply',
  'no-reply', 'help', 'contact', 'office', 'hr', 'jobs', 'marketing', 'press', 'security', 'root', 'mail', 'team',
]);

export interface ParsedEmail {
  raw: string;
  address?: string;
  local?: string;
  domain?: string;
  isValid: boolean;
  isDisposable: boolean;
  isRoleAccount: boolean;
  provider: string;
  /** Provider-normalised form where aliases collapse (Gmail dots, +tags). */
  canonical?: string;
  /** Gravatar avatar URL (MD5 of the trimmed, lower-cased address). */
  gravatarUrl?: string;
  error?: string;
}

export function parseEmail(input: string): ParsedEmail {
  const raw = input;
  const trimmed = input.trim().toLowerCase();
  const match = /^([a-z0-9._%+'-]+)@([a-z0-9.-]+\.[a-z]{2,})$/i.exec(trimmed) ?? /<(.*)>/.exec(trimmed)?.slice(1).map(String).map((v) => v)[0]?.match(/^([a-z0-9._%+'-]+)@([a-z0-9.-]+\.[a-z]{2,})$/);
  if (!match) {
    return { raw, isValid: false, isDisposable: false, isRoleAccount: false, provider: 'Неизвестно', error: 'Синтаксис RFC 5322 нарушен' };
  }
  const local = match[1] as string;
  const domain = match[2] as string;
  const bare = local.split('+')[0] as string;
  const gmailLike = ['gmail.com', 'googlemail.com'].includes(domain);
  const canonical = gmailLike ? `${bare.replace(/\./g, '')}@gmail.com` : `${bare}@${domain}`;

  const provider = detectEmailProvider(domain);
  return {
    raw,
    address: `${local}@${domain}`,
    local,
    domain,
    isValid: true,
    isDisposable: DISPOSABLE_DOMAINS.has(domain),
    isRoleAccount: ROLE_PREFIXES.has(bare),
    provider,
    canonical,
    gravatarUrl: undefined,
  };
}

export function detectEmailProvider(domain: string): string {
  const map: Record<string, string> = {
    'gmail.com': 'Google Gmail', 'googlemail.com': 'Google Gmail', 'yandex.ru': 'Яндекс.Почта', 'ya.ru': 'Яндекс.Почта',
    'yandex.com': 'Яндекс.Почта (intl)', 'mail.ru': 'VK Mail.ru', 'inbox.ru': 'VK Inbox', 'list.ru': 'VK List', 'bk.ru': 'VK BK',
    'internet.ru': 'VK Internet', 'outlook.com': 'Microsoft Outlook', 'hotmail.com': 'Microsoft Hotmail', 'live.com': 'Microsoft Live',
    'icloud.com': 'Apple iCloud', 'me.com': 'Apple iCloud', 'proton.me': 'Proton Mail', 'protonmail.com': 'Proton Mail',
    'tutanota.com': 'Tutanota', 'zoho.com': 'Zoho', 'gmx.com': 'GMX', 'yahoo.com': 'Yahoo', 'rambler.ru': 'Rambler',
    'qq.com': 'Tencent QQ', '163.com': 'NetEase 163', 'foxmail.com': 'Tencent Foxmail',
  };
  if (map[domain]) return map[domain] as string;
  if (DISPOSABLE_DOMAINS.has(domain)) return 'Одноразовый сервис (Disposable)';
  return 'Корпоративный / собственный домен';
}

export function emailDomainSkeleton(address: string): string | undefined {
  const parsed = parseEmail(address);
  return parsed.domain ? skeletonize(parsed.domain) : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domains, URLs, usernames
// ─────────────────────────────────────────────────────────────────────────────

const MULTIPART_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk', 'net.uk', 'sch.uk', 'co.jp', 'or.jp', 'ne.jp', 'ac.jp', 'go.jp',
  'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au', 'co.nz', 'org.nz', 'net.nz', 'co.za', 'org.za', 'com.br',
  'com.cn', 'net.cn', 'org.cn', 'gov.cn', 'com.hk', 'com.sg', 'com.tw', 'co.kr', 'or.kr', 'com.mx', 'com.ar',
  'com.tr', 'com.ua', 'in.ua', 'co.il', 'com.pl', 'com.ru', 'net.ru', 'org.ru', 'msk.ru', 'spb.ru', 'gov.ru',
  'edu.ru', 'ac.ru', 'co.com', 'com.co', 'com.es', 'com.it', 'co.in', 'com.pk', 'com.sa', 'com.eg', 'co.ke',
  'com.ng', 'com.vn', 'com.my', 'com.ph', 'co.id', 'com.bd', 'com.np', 'com.ge', 'com.az', 'com.by', 'com.kz',
]);

export function registrableDomain(input: string): string {
  const host = normalizeDomain(input);
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  const lastTwo = parts.slice(-2).join('.');
  if (MULTIPART_SUFFIXES.has(lastTwo)) return parts.slice(-3).join('.');
  return lastTwo;
}

export function publicSuffix(input: string): string {
  const host = normalizeDomain(input);
  const parts = host.split('.');
  if (parts.length <= 1) return host;
  const lastTwo = parts.slice(-2).join('.');
  return MULTIPART_SUFFIXES.has(lastTwo) ? lastTwo : (parts.at(-1) as string);
}

export function normalizeDomain(input: string): string {
  let host = input.trim().toLowerCase();
  host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  host = host.split('/')[0] as string;
  host = host.split('?')[0] as string;
  host = host.split('@').pop() as string;
  host = host.replace(/:\d+$/, '');
  host = host.replace(/^www\./, '');
  host = host.replace(/\.$/, '');
  // IDN → punycode where the runtime supports it (URL is available everywhere
  // the engine is expected to run; fall back to the raw value otherwise).
  try {
    // The character class intentionally excludes ASCII control bytes.
    // oxlint-disable-next-line eslint/no-control-regex
    if (/[^\x00-\x7F]/.test(host)) host = new URL(`http://${host}`).hostname;
  } catch {
    /* keep raw */
  }
  return host;
}

export function isIpAddress(input: string): boolean {
  const value = input.trim();
  if (/^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/.test(value)) return true;
  return /^([0-9a-f]{1,4}:){2,7}[0-9a-f]{0,4}$/i.test(value) && value.includes(':');
}

const TRACKING_PARAMS = /^(utm_|fbclid|gclid|yclid|mc_|_openstat|igshid|si|ref_src|spm|scm|from|share|sk|t=)/i;

/** Canonical URL: strip fragments, tracking params, default ports, sort params. */
export function canonicalUrl(input: string, base?: string): string | undefined {
  try {
    const url = new URL(input.trim(), base);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase();
    if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = '';
    const keep: Array<[string, string]> = [];
    url.searchParams.forEach((value, key) => {
      if (!TRACKING_PARAMS.test(key)) keep.push([key, value]);
    });
    keep.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    url.search = '';
    for (const [key, value] of keep) url.searchParams.append(key, value);
    if (url.pathname !== '/' && url.pathname.endsWith('/')) url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString();
  } catch {
    return undefined;
  }
}

export function extractHostname(input: string): string | undefined {
  try {
    return new URL(input.trim()).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

export function normalizeUsername(input: string): string {
  return input.trim().replace(/^@+/, '').replace(/[^\w.-]/g, '').toLowerCase();
}

/** Universal text cleaner for Cyrillic/typographic noise in pasted evidence. */
export function normalizeText(input: string): string {
  return stripDiacritics(
    input
      .replace(/[\u00a0\u2007\u202f]/g, ' ')
      .replace(/[«»""„“”]/g, '"')
      .replace(/[–—−]/g, '-')
      .replace(/ё/g, 'е')
      .replace(/Ё/g, 'Е')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

/** Keep only digits — used for identifier normalisation (ИНН, СНИЛС, VIN…). */
export function digitsOnly(input: string): string {
  return input.replace(/\D/g, '');
}

export function compactAlnum(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Detect the mixed-script (Cyrillic + Latin) pattern typical of phishing. */
export function detectMixedScriptDomain(domain: string): { suspicious: boolean; reason?: string; skeleton: string } {
  const raw = domain.trim().toLowerCase();
  const host = normalizeDomain(domain);
  const skeleton = skeletonize(raw);
  // Punycode conversion (xn--…) erases the original script, so the script test
  // runs on the *raw* input — this is the whole point of the check.
  const cyrillicInRaw = /[\u0400-\u04FF]/.test(raw);
  const latinInRaw = /[a-z]/.test(raw);
  if (cyrillicInRaw && latinInRaw) {
    return { suspicious: true, reason: 'Домен смешивает кириллицу и латиницу (гомоглифная атака на бренд)', skeleton };
  }
  if (cyrillicInRaw) {
    return { suspicious: true, reason: 'Кириллический домен в зоне не-кириллического бренда — типично для IDN-фишинга', skeleton };
  }
  const hasCyrillic = /[\u0400-\u04FF]/.test(host);
  const hasLatin = /[a-z]/.test(host);
  if (hasCyrillic && hasLatin) {
    return { suspicious: true, reason: 'Домен смешивает кириллицу и латиницу (гомоглифная атака)', skeleton };
  }
  if (hasCyrillic) {
    return { suspicious: true, reason: 'Кириллический домен — типично для IDN-фишинга', skeleton };
  }
  if (/[0-9]/.test(host) && /(g00gle|yandex|sber|tinkoff|alfabank|gosuslugi|mail|vtb)/i.test(skeleton)) {
    return { suspicious: true, reason: 'Цифро-буквенная подмена бренда (typosquatting)', skeleton };
  }
  return { suspicious: false, skeleton };
}
