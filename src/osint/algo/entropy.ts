/**
 * TOMAHAWK OSINT ENGINE — information-theoretic analysis
 * ---------------------------------------------------------------------------
 * Applied to infrastructure and leaked data:
 *   • Shannon entropy / chi-square → random-looking labels, encoded payloads,
 *     base64 blobs, high-entropy DNS labels
 *   • DGA score → algorithmically generated (malware) domain detection using
 *     character-class distribution, consonant runs, digit structure and n-gram
 *     plausibility
 *   • lexical diversity of a message corpus (credential-stuffing text reuse)
 */

const ENGLISH_BIGRAMS = new Set([
  'th', 'he', 'in', 'er', 'an', 're', 'on', 'at', 'en', 'nd', 'ti', 'es', 'or', 'te', 'of', 'ed', 'is', 'it', 'al', 'ar',
  'st', 'to', 'nt', 'ng', 'se', 'ha', 'as', 'ou', 'io', 'le', 've', 'co', 'me', 'de', 'hi', 'ri', 'ro', 'ic', 'ne', 'ea',
  'ra', 'ce', 'li', 'ch', 'll', 'be', 'ma', 'si', 'om', 'ur', 'ca', 'el', 'ta', 'la', 'ns', 'di', 'fo', 'ho', 'pe', 'ec',
  'pr', 'no', 'ct', 'us', 'ac', 'ot', 'il', 'tr', 'ly', 'nc', 'et', 'ut', 'ss', 'so', 'rs', 'un', 'lo', 'wa', 'ge', 'ie',
  'wh', 'ee', 'wi', 'em', 'ad', 'ol', 'rt', 'po', 'we', 'na', 'ul', 'ni', 'ts', 'mo', 'ow', 'pa', 'im', 'mi', 'ai', 'sh',
]);

export function shannonEntropy(input: string): number {
  if (!input) return 0;
  const counts = new Map<string, number>();
  for (const char of input) counts.set(char, (counts.get(char) ?? 0) + 1);
  let entropy = 0;
  for (const count of counts.values()) {
    const probability = count / input.length;
    entropy -= probability * Math.log2(probability);
  }
  return entropy;
}

/** Entropy normalised by the theoretical maximum for the alphabet actually used. */
export function normalizedEntropy(input: string): number {
  if (input.length < 2) return 0;
  const alphabet = new Set(input).size;
  const max = Math.log2(Math.min(alphabet, input.length));
  return max === 0 ? 0 : shannonEntropy(input) / max;
}

export function chiSquareUniform(input: string): number {
  if (!input) return 0;
  const counts = new Map<string, number>();
  for (const char of input) counts.set(char, (counts.get(char) ?? 0) + 1);
  const expected = input.length / counts.size;
  let chi = 0;
  for (const count of counts.values()) chi += (count - expected) ** 2 / expected;
  return chi;
}

export function looksBase64(input: string): boolean {
  const clean = input.trim();
  if (clean.length < 16 || clean.length % 4 !== 0) return false;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(clean)) return false;
  return /[A-Z]/.test(clean) && /[a-z]/.test(clean) && /[0-9+/]/.test(clean);
}

export function looksHex(input: string): boolean {
  const clean = input.trim().replace(/^0x/i, '');
  return clean.length >= 16 && clean.length % 2 === 0 && /^[0-9a-f]+$/i.test(clean);
}

export interface DgaScore {
  score: number;
  verdict: 'human-readable' | 'suspicious' | 'likely-generated';
  signals: Record<string, number | string>;
}

/**
 * Domain Generation Algorithm heuristic. Malware families (Conficker, Necurs,
 * Emotet, Dyre…) emit domains with a characteristic signature: high consonant
 * density, few dictionary bigrams, unusual length and digit placement.
 */
export function dgaScore(domain: string): DgaScore {
  const label = domain.replace(/^www\./, '').split('.')[0]?.toLowerCase() ?? '';
  if (!label) return { score: 0, verdict: 'human-readable', signals: {} };

  const letters = label.replace(/[^a-z]/g, '');
  const digits = label.replace(/\D/g, '');
  const vowels = (letters.match(/[aeiouy]/g) ?? []).length;
  const vowelRatio = letters.length ? vowels / letters.length : 0;

  let longestConsonantRun = 0;
  let currentRun = 0;
  for (const char of letters) {
    if ('aeiouy'.includes(char)) currentRun = 0;
    else {
      currentRun += 1;
      longestConsonantRun = Math.max(longestConsonantRun, currentRun);
    }
  }

  let bigramHits = 0;
  for (let i = 0; i < letters.length - 1; i += 1) if (ENGLISH_BIGRAMS.has(letters.slice(i, i + 2))) bigramHits += 1;
  const bigramPlausibility = letters.length > 1 ? bigramHits / (letters.length - 1) : 0;

  const digitRatio = digits.length / label.length;
  const entropy = shannonEntropy(label);

  let score = 0;
  if (vowelRatio < 0.25) score += 0.28;
  else if (vowelRatio < 0.32) score += 0.14;
  if (longestConsonantRun >= 5) score += 0.3;
  else if (longestConsonantRun === 4) score += 0.15;
  if (bigramPlausibility < 0.25) score += 0.24;
  else if (bigramPlausibility < 0.4) score += 0.1;
  if (digitRatio > 0.3) score += 0.16;
  else if (digitRatio > 0.15) score += 0.08;
  if (entropy > 3.4) score += 0.12;
  if (label.length > 18) score += 0.1;
  if (/^[a-z]+\d+[a-z]+\d+$/.test(label)) score += 0.2;
  if (/(.)\1\1/.test(label)) score -= 0.1;

  score = Math.max(0, Math.min(1, score));
  return {
    score,
    verdict: score >= 0.62 ? 'likely-generated' : score >= 0.38 ? 'suspicious' : 'human-readable',
    signals: {
      vowelRatio: Number(vowelRatio.toFixed(3)),
      longestConsonantRun,
      bigramPlausibility: Number(bigramPlausibility.toFixed(3)),
      digitRatio: Number(digitRatio.toFixed(3)),
      entropy: Number(entropy.toFixed(3)),
      label,
    },
  };
}

/**
 * Credential quality analysis used by the exposure module: distinguishes a real
 * leaked password from a placeholder/redacted value and estimates how weak it
 * is (i.e. how much additional risk it implies for the subject).
 */
export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  entropyBits: number;
  isPlaceholder: boolean;
  notes: string[];
}

const PLACEHOLDERS = ['password', 'pass', 'hidden', 'redacted', 'n/a', 'null', 'none', 'unknown', '***', 'xxx', '<no password>'];

export function analyzePasswordStrength(password: string): PasswordStrength {
  const value = password ?? '';
  const notes: string[] = [];
  const lower = value.toLowerCase();
  const isPlaceholder = PLACEHOLDERS.some((token) => lower === token || lower.includes(token));

  const pool =
    (/[a-z]/.test(value) ? 26 : 0) + (/[A-Z]/.test(value) ? 26 : 0) + (/\d/.test(value) ? 10 : 0) + (/[^A-Za-z0-9]/.test(value) ? 33 : 0);
  const entropyBits = value.length * Math.log2(pool || 1);

  if (/^\d+$/.test(value)) notes.push('Только цифры — уязвим к перебору по словарю дат');
  if (/^\d{6}$/.test(value)) notes.push('6-значный PIN/дата — тривиально восстанавливается');
  if (/(qwerty|123456|qazwsx|пароль|йцукен)/i.test(value)) notes.push('Клавиатурная/словарная последовательность');
  if (value.length > 0 && value.length < 8) notes.push('Короче 8 символов');
  if (/(.)\1{2,}/.test(value)) notes.push('Повторяющиеся символы');

  const score: PasswordStrength['score'] = isPlaceholder ? 0 : entropyBits >= 90 ? 4 : entropyBits >= 60 ? 3 : entropyBits >= 40 ? 2 : entropyBits >= 25 ? 1 : 0;
  return {
    score,
    label: ['Не пароль / заглушка', 'Очень слабый', 'Слабый', 'Средний', 'Устойчивый'][score] as string,
    entropyBits: Number(entropyBits.toFixed(1)),
    isPlaceholder,
    notes,
  };
}
