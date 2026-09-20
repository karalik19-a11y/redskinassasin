/**
 * TOMAHAWK OSINT ENGINE — string metrics & name matching
 * ---------------------------------------------------------------------------
 * Person matching across sources is *the* hard problem in OSINT: "Соколов М.А.",
 * "Sokolov Mikhail", "Михаил Андреевич Соколов" and "М. Соколов" are one human.
 * This module implements edit/ngram/phonetic metrics plus Russian-specific
 * transliteration and patronymic analysis, then composes them into an
 * explainable match score (each signal reports its own contribution).
 */

const CYRILLIC_TO_LATIN_ICAO: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i', к: 'k', л: 'l',
  м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'iu', я: 'ia',
};

const CYRILLIC_TO_LATIN_GOST: Record<string, string> = {
  ...CYRILLIC_TO_LATIN_ICAO,
  е: 'e', ё: 'yo', ж: 'zh', й: 'y', х: 'h', ц: 'c', щ: 'shh', ю: 'yu', я: 'ya', ы: 'y', э: 'e',
};

/** Latin look-alike folding for homoglyph attack detection (IDN spoofing). */
const HOMOGLYPHS: Record<string, string> = {
  а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', у: 'y', х: 'x', к: 'k', м: 'm', т: 't', в: 'b', н: 'h', і: 'i',
  ј: 'j', ѕ: 's', ԁ: 'd', ɡ: 'g', ⅰ: 'i', ο: 'o', ρ: 'p', ѵ: 'v', ь: 'b', б: 'b', з: '3', ч: '4',
  '0': 'o', '1': 'l', '3': 'e', '5': 's', '7': 't', '@': 'a', $: 's',
};

export function stripDiacritics(input: string): string {
  return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Fold a string into its "skeleton": ASCII-ish, no look-alike confusion.
 *
 * Two-stage fold, because collapsing alone is unsafe:
 *   1. confusable substitution (а→a, Н→h, з→3 …) so a homoglyph attack maps
 *      onto the brand it imitates;
 *   2. transliteration for everything still non-ASCII (л→l, ж→zh …) — without
 *      this step unmapped Cyrillic letters would be *deleted*, silently
 *      collapsing distinct names onto one skeleton.
 * `Соколов` and `Cokolob` therefore share the skeleton `cokolob`, while
 * `Соколов` and `Сокоов` stay distinct.
 */
export function skeletonize(input: string): string {
  return [...input.toLowerCase().normalize('NFKD')]
    .map((char) => HOMOGLYPHS[char] ?? CYRILLIC_TO_LATIN_ICAO[char] ?? char)
    .join('')
    .replace(/[^a-z0-9]/g, '');
}

export function isMixedScript(input: string): boolean {
  const hasCyrillic = /[\u0400-\u04FF]/.test(input);
  const hasLatin = /[a-zA-Z]/.test(input);
  return hasCyrillic && hasLatin;
}

export function transliterate(input: string, standard: 'icao' | 'gost' = 'icao'): string {
  const table = standard === 'icao' ? CYRILLIC_TO_LATIN_ICAO : CYRILLIC_TO_LATIN_GOST;
  return [...input.toLowerCase()]
    .map((char) => table[char] ?? char)
    .join('');
}

/** Every plausible Latin spelling of a Cyrillic name (for cross-language pivots). */
export function transliterationVariants(input: string): string[] {
  const icao = transliterate(input, 'icao');
  const gost = transliterate(input, 'gost');
  const compact = stripDiacritics(input).toLowerCase();
  const variants = new Set<string>([
    icao,
    gost,
    // Common German/French/Polish influenced spellings seen in passports
    icao.replace(/kh/g, 'ch').replace(/ia$/, 'ya').replace(/iu/g, 'yu'),
    icao.replace(/y/g, 'i'),
    icao.replace(/v/g, 'w'),
    compact,
  ]);
  return [...variants].filter((value) => value.trim().length > 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit / n-gram / phonetic metrics
// ─────────────────────────────────────────────────────────────────────────────

export function levenshtein(a: string, b: string, maxDistance = Number.MAX_SAFE_INTEGER): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = new Array<number>(b.length + 1);
  let current = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) previous[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min((current[j - 1] as number) + 1, (previous[j] as number) + 1, (previous[j - 1] as number) + cost);
      rowMin = Math.min(rowMin, current[j] as number);
    }
    if (rowMin > maxDistance) return maxDistance + 1;
    const swap = previous;
    previous = current;
    current = swap;
  }
  return previous[b.length] as number;
}

export function levenshteinRatio(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;
  return 1 - levenshtein(a, b) / longest;
}

export function jaro(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const matchWindow = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatches = new Array<boolean>(a.length).fill(false);
  const bMatches = new Array<boolean>(b.length).fill(false);
  let matches = 0;

  for (let i = 0; i < a.length; i += 1) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, b.length);
    for (let j = start; j < end; j += 1) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches += 1;
      break;
    }
  }
  if (matches === 0) return 0;

  let transpositions = 0;
  let cursor = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (!aMatches[i]) continue;
    while (!bMatches[cursor]) cursor += 1;
    if (a[i] !== b[cursor]) transpositions += 1;
    cursor += 1;
  }
  transpositions /= 2;

  return (matches / a.length + matches / b.length + (matches - transpositions) / matches) / 3;
}

export function jaroWinkler(a: string, b: string, scaling = 0.1): number {
  const base = jaro(a, b);
  if (base < 0.7) return base;
  let prefix = 0;
  for (let i = 0; i < Math.min(4, a.length, b.length); i += 1) {
    if (a[i] !== b[i]) break;
    prefix += 1;
  }
  return Math.min(1, base + prefix * scaling * (1 - base));
}

function bigrams(input: string): Map<string, number> {
  const grams = new Map<string, number>();
  for (let i = 0; i < input.length - 1; i += 1) {
    const gram = input.slice(i, i + 2);
    grams.set(gram, (grams.get(gram) ?? 0) + 1);
  }
  return grams;
}

export function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const left = bigrams(a);
  const right = bigrams(b);
  let intersection = 0;
  let leftTotal = 0;
  let rightTotal = 0;
  for (const [gram, count] of left) {
    leftTotal += count;
    intersection += Math.min(count, right.get(gram) ?? 0);
  }
  for (const count of right.values()) rightTotal += count;
  return (2 * intersection) / (leftTotal + rightTotal);
}

/** Token-set ratio: robust to word order and missing patronymics. */
export function tokenSetRatio(a: string, b: string): number {
  const left = a.split(/\s+/).filter(Boolean).sort();
  const right = b.split(/\s+/).filter(Boolean).sort();
  if (!left.length || !right.length) return 0;
  const intersection = left.filter((token) => right.includes(token));
  const onlyLeft = left.filter((token) => !right.includes(token));
  const onlyRight = right.filter((token) => !right.includes(token));
  const s1 = intersection.join(' ');
  const s2 = `${intersection.join(' ')} ${onlyLeft.join(' ')}`.trim();
  const s3 = `${intersection.join(' ')} ${onlyRight.join(' ')}`.trim();
  return Math.max(diceCoefficient(s1, s2), diceCoefficient(s1, s3), diceCoefficient(s2, s3));
}

/** Phonetic classes for Cyrillic (Russian sound-ex style). */
const RU_PHONETIC: Record<string, string> = {
  а: 'A', б: 'B', в: 'V', г: 'G', д: 'D', е: 'E', ё: 'E', ж: 'Z', з: 'Z', и: 'I', й: 'I', к: 'K', л: 'L', м: 'M',
  н: 'N', о: 'O', п: 'P', р: 'R', с: 'S', т: 'T', у: 'U', ф: 'F', х: 'H', ц: 'C', ч: 'C', ш: 'S', щ: 'S', ъ: '',
  ы: 'I', ь: '', э: 'E', ю: 'U', я: 'A',
};

export function phoneticRu(input: string): string {
  const clean = input.toLowerCase().replace(/[^а-яё]/g, '');
  if (!clean) return '';
  const mapped = [...clean].map((char) => RU_PHONETIC[char] ?? '').join('');
  // collapse doubles, drop vowels after the first (Soundex-like)
  let out = '';
  let previous = '';
  for (let i = 0; i < mapped.length; i += 1) {
    const char = mapped[i] as string;
    if (!char || char === previous) continue;
    const isVowel = 'AEIOU'.includes(char);
    if (isVowel && i > 0) continue;
    out += char;
    previous = char;
  }
  return (out + '0000').slice(0, 6);
}

export interface NameParts {
  last?: string;
  first?: string;
  middle?: string;
  gender?: 'male' | 'female' | 'unknown';
}

/** Parse a Russian / international full name into parts (order-agnostic). */
export function parseFullName(input: string): NameParts {
  const tokens = input
    .replace(/[.,]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
  if (!tokens.length) return {};

  const [first = '', second = '', third = ''] = tokens.map(capitalize);
  const looksPatronymic = (token: string): boolean => /(ович|евич|ьич|овна|евна|ична|инична)$/i.test(token);

  let parts: NameParts;
  if (looksPatronymic(second)) parts = { last: first, middle: second, first: third || undefined };
  else if (looksPatronymic(third)) parts = { last: first, first: second, middle: third };
  else parts = { last: first, first: second, middle: third || undefined };

  return { ...parts, gender: genderFromPatronymic(parts.middle ?? '') };
}

export function genderFromPatronymic(patronymic: string): 'male' | 'female' | 'unknown' {
  if (/(ович|евич|ьич|ич)$/i.test(patronymic)) return 'male';
  if (/(овна|евна|ична|инична|овна)$/i.test(patronymic)) return 'female';
  return 'unknown';
}

export function capitalize(input: string): string {
  if (!input) return input;
  return input[0]!.toUpperCase() + input.slice(1).toLowerCase();
}

export interface NameMatchSignal {
  name: string;
  score: number;
  detail: string;
}

export interface NameMatchResult {
  score: number;
  signals: NameMatchSignal[];
  verdict: 'same-person' | 'probable' | 'possible' | 'unlikely';
}

/**
 * Explainable person matching. Combines token-set similarity, Jaro-Winkler on
 * the surname, phonetic equality, transliteration equivalence and patronymic
 * agreement. Each signal is reported with its contribution so an analyst can
 * challenge the verdict.
 */
export function matchPersons(left: string, right: string): NameMatchResult {
  const a = normalizeNameText(left);
  const b = normalizeNameText(right);
  const signals: NameMatchSignal[] = [];

  const tokenScore = tokenSetRatio(a.sorted, b.sorted);
  signals.push({ name: 'token-set', score: tokenScore, detail: `Совпадение токенов: ${(tokenScore * 100).toFixed(0)}%` });

  const surnameA = a.parts.last ?? '';
  const surnameB = b.parts.last ?? '';
  if (surnameA && surnameB) {
    const surnameScore = jaroWinkler(surnameA, surnameB);
    signals.push({ name: 'surname', score: surnameScore, detail: `Фамилия ${surnameA} ↔ ${surnameB}: ${(surnameScore * 100).toFixed(0)}%` });
  }

  const firstA = a.parts.first ?? '';
  const firstB = b.parts.first ?? '';
  if (firstA && firstB) {
    const initialMatch = firstA[0] === firstB[0];
    const firstScore = initialMatch ? Math.max(0.75, jaroWinkler(firstA, firstB)) : jaroWinkler(firstA, firstB) * 0.5;
    signals.push({ name: 'given-name', score: firstScore, detail: `Имя ${firstA} ↔ ${firstB}: ${(firstScore * 100).toFixed(0)}%${initialMatch ? ' (инициал совпал)' : ''}` });
  }

  const phoneticA = phoneticRu(surnameA);
  const phoneticB = phoneticRu(surnameB);
  const phoneticScore = phoneticA && phoneticB && phoneticA === phoneticB ? 0.95 : 0.2;
  signals.push({ name: 'phonetic', score: phoneticScore, detail: `Фонетический код ${phoneticA || '—'} ↔ ${phoneticB || '—'}` });

  const latinA = transliterate(a.plain, 'icao').replace(/\s+/g, '');
  const latinB = transliterate(b.plain, 'icao').replace(/\s+/g, '');
  const translitScore = latinA && latinB ? diceCoefficient(latinA, latinB) : 0.5;
  signals.push({ name: 'translit', score: translitScore, detail: 'Сравнение через ICAO-транслитерацию' });

  if (a.parts.middle && b.parts.middle) {
    const sameGender = a.parts.gender === b.parts.gender;
    const middleScore = jaroWinkler(a.parts.middle, b.parts.middle) * (sameGender ? 1 : 0.6);
    signals.push({ name: 'patronymic', score: middleScore, detail: `Отчество ${a.parts.middle} ↔ ${b.parts.middle}${sameGender ? '' : ' (пол не совпадает!)'}` });
  }

  const weights: Record<string, number> = { 'token-set': 0.32, surname: 0.28, 'given-name': 0.16, phonetic: 0.1, translit: 0.08, patronymic: 0.06 };
  let total = 0;
  let weightSum = 0;
  for (const signal of signals) {
    const weight = weights[signal.name] ?? 0.1;
    total += signal.score * weight;
    weightSum += weight;
  }
  const score = weightSum > 0 ? total / weightSum : 0;

  return {
    score,
    signals,
    verdict: score >= 0.92 ? 'same-person' : score >= 0.78 ? 'probable' : score >= 0.6 ? 'possible' : 'unlikely',
  };
}

function normalizeNameText(input: string): { sorted: string; plain: string; parts: NameParts } {
  const plain = input
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { plain, sorted: plain.split(' ').sort().join(' '), parts: parseFullName(input) };
}
