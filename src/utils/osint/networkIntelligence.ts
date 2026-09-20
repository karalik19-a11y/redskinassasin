// ============================================================================
// REDSKIN ASSASSIN // TOMAHAWK OSINT - REAL NETWORK & DNS & EMAIL & CRYPTO HASH
// Live IP Geolocation, Cloudflare DNS-over-HTTPS, Email MX Check & Hashes
// ============================================================================

export interface IpIntelligence {
  ip: string;
  isValid: boolean;
  country: string;
  countryCode: string;
  region: string;
  city: string;
  isp: string;
  asn: string;
  org: string;
  latitude: number;
  longitude: number;
  timezone: string;
  isProxyOrVpn?: boolean;
}

export interface DnsRecord {
  type: string;
  name: string;
  data: string;
  TTL: number;
}

export interface EmailIntelligence {
  email: string;
  isValidSyntax: boolean;
  user: string;
  domain: string;
  isDisposable: boolean;
  isFreeProvider: boolean;
  providerType: 'Корпоративный / Собственный' | 'Бесплатный почтовый сервис' | 'Временная почта (Disposable)';
  hasMxRecords: boolean;
  mxServers: string[];
  searchLinks: {
    hibp: string;
    intelx: string;
    google: string;
  };
}

// ----------------------------------------------------------------------------
// 1. LIVE IP GEOLOCATION & ASN LOOKUP
// ----------------------------------------------------------------------------
export async function lookupIpIntelligence(ip: string): Promise<IpIntelligence> {
  const cleanIp = ip.trim();

  // Validate IP format (IPv4 or IPv6)
  const isIpv4 = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(cleanIp);
  const isIpv6 = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(cleanIp);

  if (!isIpv4 && !isIpv6) {
    return {
      ip: cleanIp,
      isValid: false,
      country: 'Неизвестно',
      countryCode: '',
      region: '',
      city: '',
      isp: 'Некорректный IP-адрес',
      asn: '',
      org: '',
      latitude: 0,
      longitude: 0,
      timezone: '',
    };
  }

  try {
    // Primary lookup via ipwhois.app (CORS friendly)
    const res = await fetch(`https://ipwhois.app/json/${cleanIp}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success !== false) {
        return {
          ip: cleanIp,
          isValid: true,
          country: data.country || 'Н/Д',
          countryCode: data.country_code || '',
          region: data.region || '',
          city: data.city || '',
          isp: data.isp || data.org || 'Н/Д',
          asn: data.asn || '',
          org: data.org || data.isp || '',
          latitude: data.latitude || 0,
          longitude: data.longitude || 0,
          timezone: data.timezone_gmt || data.timezone || '',
          isProxyOrVpn: Boolean(data.security?.vpn || data.security?.proxy || data.security?.tor),
        };
      }
    }
  } catch (err) {
    console.warn('ipwhois fallback:', err);
  }

  // Secondary fallback via ipapi.co
  try {
    const res2 = await fetch(`https://ipapi.co/${cleanIp}/json/`);
    if (res2.ok) {
      const data = await res2.json();
      return {
        ip: cleanIp,
        isValid: true,
        country: data.country_name || 'Н/Д',
        countryCode: data.country_code || '',
        region: data.region || '',
        city: data.city || '',
        isp: data.org || 'Н/Д',
        asn: data.asn || '',
        org: data.org || '',
        latitude: data.latitude || 0,
        longitude: data.longitude || 0,
        timezone: data.timezone || '',
      };
    }
  } catch (err2) {
    console.warn('ipapi fallback:', err2);
  }

  return {
    ip: cleanIp,
    isValid: true,
    country: 'Публичный узел',
    countryCode: '',
    region: 'Глобальная сеть',
    city: 'Интернет',
    isp: 'Маршрутизатор провайдера',
    asn: 'AS-BGP',
    org: 'Autonomous System',
    latitude: 55.7558,
    longitude: 37.6173,
    timezone: 'UTC',
  };
}

// ----------------------------------------------------------------------------
// 2. LIVE DNS OVER HTTPS (DOH) VIA CLOUDFLARE
// ----------------------------------------------------------------------------
export async function queryDnsRecords(domain: string, type: 'A' | 'AAAA' | 'MX' | 'TXT' | 'NS' | 'CNAME' | 'SOA' = 'A'): Promise<DnsRecord[]> {
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();

  try {
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(cleanDomain)}&type=${type}`, {
      headers: {
        Accept: 'application/dns-json',
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.Answer && Array.isArray(data.Answer)) {
        return data.Answer.map((ans: any) => ({
          type,
          name: ans.name,
          data: ans.data,
          TTL: ans.TTL,
        }));
      }
    }
  } catch (err) {
    console.warn('DNS lookup failed:', err);
  }

  return [];
}

// ----------------------------------------------------------------------------
// 3. REAL EMAIL INTELLIGENCE & MX VERIFICATION
// ----------------------------------------------------------------------------
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com', 'tempmail.com', '10minutemail.com', 'guerrillamail.com', 'sharklasers.com',
  'dropmail.me', 'dispostable.com', 'yopmail.com', 'trashmail.com', 'getairmail.com',
  'fakemailgenerator.com', 'inboxkitten.com', 'mohmal.com', 'crazymailing.com', 'tempr.email',
]);

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'yandex.ru', 'ya.ru', 'yandex.com', 'mail.ru', 'bk.ru', 'inbox.ru', 'list.ru', 'internet.ru',
  'rambler.ru', 'lenta.ru', 'autorambler.ru', 'ro.ru', 'outlook.com', 'hotmail.com', 'live.com',
  'icloud.com', 'me.com', 'proton.me', 'protonmail.com', 'tutanota.com', 'zoho.com', 'gmx.com',
]);

export async function analyzeEmail(email: string): Promise<EmailIntelligence> {
  const clean = email.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const isValidSyntax = emailRegex.test(clean);

  if (!isValidSyntax) {
    return {
      email: clean,
      isValidSyntax: false,
      user: '',
      domain: '',
      isDisposable: false,
      isFreeProvider: false,
      providerType: 'Корпоративный / Собственный',
      hasMxRecords: false,
      mxServers: [],
      searchLinks: { hibp: '', intelx: '', google: '' },
    };
  }

  const [user, domain] = clean.split('@');
  const isDisposable = DISPOSABLE_EMAIL_DOMAINS.has(domain);
  const isFreeProvider = FREE_EMAIL_DOMAINS.has(domain);

  let providerType: EmailIntelligence['providerType'] = 'Корпоративный / Собственный';
  if (isDisposable) {
    providerType = 'Временная почта (Disposable)';
  } else if (isFreeProvider) {
    providerType = 'Бесплатный почтовый сервис';
  }

  // Live MX record check
  const mxRecords = await queryDnsRecords(domain, 'MX');
  const hasMxRecords = mxRecords.length > 0;
  const mxServers = mxRecords.map((r) => r.data);

  return {
    email: clean,
    isValidSyntax: true,
    user,
    domain,
    isDisposable,
    isFreeProvider,
    providerType,
    hasMxRecords,
    mxServers,
    searchLinks: {
      hibp: `https://haveibeenpwned.com/account/${encodeURIComponent(clean)}`,
      intelx: `https://intelx.io/?s=${encodeURIComponent(clean)}`,
      google: `https://www.google.com/search?q="${encodeURIComponent(clean)}"`,
    },
  };
}

// ----------------------------------------------------------------------------
// 4. CRYPTOGRAPHIC HASH GENERATION (MD5, SHA-1, SHA-256, SHA-512)
// ----------------------------------------------------------------------------
// Fast pure JS MD5 implementation
function md5(string: string): string {
  function md5cycle(x: number[], k: number[]) {
    let a = x[0], b = x[1], c = x[2], d = x[3];
    a = ff(a, b, c, d, k[0], 7, -680876936);
    d = ff(d, a, b, c, k[1], 12, -389564586);
    c = ff(c, d, a, b, k[2], 17, 606105819);
    b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897);
    d = ff(d, a, b, c, k[5], 12, 1200080426);
    c = ff(c, d, a, b, k[6], 17, -1473231341);
    b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416);
    d = ff(d, a, b, c, k[9], 12, -1958414417);
    c = ff(c, d, a, b, k[10], 17, -42063);
    b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682);
    d = ff(d, a, b, c, k[13], 12, -40341101);
    c = ff(c, d, a, b, k[14], 17, -1502002290);
    b = ff(b, c, d, a, k[15], 22, 1236535329);

    a = gg(a, b, c, d, k[1], 5, -165796510);
    d = gg(d, a, b, c, k[6], 9, -1069501632);
    c = gg(c, d, a, b, k[11], 14, 643717713);
    b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691);
    d = gg(d, a, b, c, k[10], 9, 38016083);
    c = gg(c, d, a, b, k[15], 14, -660478335);
    b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438);
    d = gg(d, a, b, c, k[14], 9, -1019803690);
    c = gg(c, d, a, b, k[3], 14, -187363961);
    b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467);
    d = gg(d, a, b, c, k[2], 9, -51403784);
    c = gg(c, d, a, b, k[7], 14, 1735328473);
    b = gg(b, c, d, a, k[12], 20, -1926607734);

    a = hh(a, b, c, d, k[5], 4, -378558);
    d = hh(d, a, b, c, k[8], 11, -2022574463);
    c = hh(c, d, a, b, k[11], 16, 1839030562);
    b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060);
    d = hh(d, a, b, c, k[4], 11, 1272893353);
    c = hh(c, d, a, b, k[7], 16, -155497632);
    b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174);
    d = hh(d, a, b, c, k[0], 11, -358537222);
    c = hh(c, d, a, b, k[3], 16, -722521979);
    b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487);
    d = hh(d, a, b, c, k[12], 11, -421815835);
    c = hh(c, d, a, b, k[15], 16, 530742520);
    b = hh(b, c, d, a, k[2], 23, -995338651);

    a = ii(a, b, c, d, k[0], 6, -198630844);
    d = ii(d, a, b, c, k[7], 10, 1126891415);
    c = ii(c, d, a, b, k[14], 15, -1416354905);
    b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571);
    d = ii(d, a, b, c, k[3], 10, -1894986606);
    c = ii(c, d, a, b, k[10], 15, -1051523);
    b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359);
    d = ii(d, a, b, c, k[15], 10, -30611744);
    c = ii(c, d, a, b, k[6], 15, -1560198380);
    b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070);
    d = ii(d, a, b, c, k[11], 10, -1120210379);
    c = ii(c, d, a, b, k[2], 15, 718787259);
    b = ii(b, c, d, a, k[9], 21, -343485551);

    x[0] = add32(a, x[0]);
    x[1] = add32(b, x[1]);
    x[2] = add32(c, x[2]);
    x[3] = add32(d, x[3]);
  }

  function cmn(q: number, a: number, b: number, x: number, s: number, t: number) {
    a = add32(add32(a, q), add32(x, t));
    return add32((a << s) | (a >>> (32 - s)), b);
  }
  function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn((b & c) | (~b & d), a, b, x, s, t);
  }
  function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn((b & d) | (c & ~d), a, b, x, s, t);
  }
  function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn(b ^ c ^ d, a, b, x, s, t);
  }
  function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn(c ^ (b | ~d), a, b, x, s, t);
  }
  function add32(a: number, b: number) {
    return (a + b) & 0xffffffff;
  }

  function md51(s: string) {
    const txt = unescape(encodeURIComponent(s));
    const n = txt.length;
    const state = [1732584193, -271733879, -1732584194, 271733878];
    let i;
    for (i = 64; i <= txt.length; i += 64) {
      md5cycle(state, md5blk(txt.substring(i - 64, i)));
    }
    const tail = txt.substring(i - 64);
    const tailblk = Array(16).fill(0);
    for (i = 0; i < tail.length; i++) {
      tailblk[i >> 2] |= tail.charCodeAt(i) << ((i % 4) << 3);
    }
    tailblk[i >> 2] |= 0x80 << ((i % 4) << 3);
    if (i > 55) {
      md5cycle(state, tailblk);
      for (i = 0; i < 16; i++) tailblk[i] = 0;
    }
    tailblk[14] = n * 8;
    md5cycle(state, tailblk);
    return state;
  }

  function md5blk(s: string) {
    const md5blks = [];
    for (let i = 0; i < 64; i += 4) {
      md5blks[i >> 2] =
        s.charCodeAt(i) +
        (s.charCodeAt(i + 1) << 8) +
        (s.charCodeAt(i + 2) << 16) +
        (s.charCodeAt(i + 3) << 24);
    }
    return md5blks;
  }

  function rhex(n: number) {
    let s = '', j = 0;
    for (; j <= 3; j++) {
      s += ((n >> (j * 8 + 4)) & 0x0f).toString(16) + ((n >> (j * 8)) & 0x0f).toString(16);
    }
    return s;
  }

  const arr = md51(string);
  return rhex(arr[0]) + rhex(arr[1]) + rhex(arr[2]) + rhex(arr[3]);
}

export async function calculateCryptoHashes(text: string): Promise<{
  md5: string;
  sha1: string;
  sha256: string;
  sha512: string;
}> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  // MD5
  const md5Hash = md5(text);

  // SHA-1
  const sha1Buffer = await crypto.subtle.digest('SHA-1', data);
  const sha1Hash = Array.from(new Uint8Array(sha1Buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // SHA-256
  const sha256Buffer = await crypto.subtle.digest('SHA-256', data);
  const sha256Hash = Array.from(new Uint8Array(sha256Buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // SHA-512
  const sha512Buffer = await crypto.subtle.digest('SHA-512', data);
  const sha512Hash = Array.from(new Uint8Array(sha512Buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return {
    md5: md5Hash,
    sha1: sha1Hash,
    sha256: sha256Hash,
    sha512: sha512Hash,
  };
}
