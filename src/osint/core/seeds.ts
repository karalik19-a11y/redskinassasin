/**
 * TOMAHAWK OSINT ENGINE — input auto-triage
 * ---------------------------------------------------------------------------
 * Analysts paste whatever they have: a phone number, a paste-bin dump with
 * twenty observables, a court ruling with an ИНН, a screenshot URL, a pasted
 * dossier. This parser recognises every observable class the engine can pivot
 * on, validates identifiers with their *real* checksums so fabricated data is
 * flagged immediately, and explains what it did and did not understand.
 */

import type { EntityDraft, EntityType, Pivot } from '../types/entity';
import { parseEmail, parsePhone, isIpAddress, registrableDomain, normalizeDomain, canonicalUrl, extractHostname } from '../algo/normalize';
import { decodeVin, parseRuPlate, validateInn, validateOgrn, validateOgrnip, validateSnils, validateCadastralNumber, validateBik, validatePassportRf } from '../algo/ruIdentifiers';
import { validateIban } from '../algo/checksums';
import { decodeBase58Check, validateSolanaAddress } from '../algo/base58';
import { validateBech32Address } from '../algo/bech32';
import { verifyEip55 } from '../algo/keccak';
import { toEip55Address } from '../algo/keccak';
import { geohashDecode } from '../algo/geospatial';
import { parseFullName } from '../algo/stringdistance';
import { dgaScore } from '../algo/entropy';

export interface SeedParseResult {
  entities: EntityDraft[];
  /** Observables recognised as a class but rejected by validation. */
  rejected: Array<{ value: string; type: EntityType; reason: string }>;
  /** Human-readable triage notes surfaced in the UI and the report. */
  notes: string[];
  /** Free text that yielded no observable (kept for full-text pivots). */
  unrecognized: string[];
}

interface Detector {
  type: EntityType;
  test: (input: string) => boolean;
  build: (input: string) => EntityDraft | null;
  priority: number;
}

const URL_RE = /^(https?:\/\/|www\.)[^\s]+$/i;
const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+\.?$/i;
const PHONE_RE = /^(\+?\d[\d\s().-]{7,20}\d)$/;
const GEOHASH_RE = /^[0-9bcfghjkmnpqrstuvwxyz]{7,12}$/i;
const COORDS_RE = /^(-?\d{1,3}\.\d{1,8})\s*[,;]\s*(-?\d{1,3}\.\d{1,8})$/;
const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/i;
const IBAN_RE = /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/i;

/**
 * Ordered detectors. Priority resolves ambiguity (e.g. a 12-digit ИНН vs an
 * EAN-13 barcode vs an IMEI): the most specific *validated* interpretation wins.
 */
const DETECTORS: Detector[] = [
  {
    type: 'url',
    priority: 100,
    test: (input) => URL_RE.test(input),
    build: (input) => {
      const canonical = canonicalUrl(input.startsWith('http') ? input : `https://${input}`);
      if (!canonical) return null;
      return { type: 'url', value: canonical, label: canonical, properties: { host: extractHostname(canonical) }, tags: ['seed'] };
    },
  },
  {
    type: 'email',
    priority: 95,
    test: (input) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(input),
    build: (input) => {
      const parsed = parseEmail(input);
      if (!parsed.isValid || !parsed.address) return null;
      return {
        type: 'email',
        value: parsed.address,
        label: parsed.address,
        properties: {
          domain: parsed.domain,
          provider: parsed.provider,
          disposable: parsed.isDisposable,
          roleAccount: parsed.isRoleAccount,
          canonical: parsed.canonical,
        },
        tags: parsed.isDisposable ? ['seed', 'disposable'] : ['seed'],
      };
    },
  },
  {
    type: 'crypto_address',
    priority: 90,
    test: (input) => /^(0x[0-9a-fA-F]{40}|bc1[a-z0-9]{8,87}|[13][1-9A-HJ-NP-Za-km-z]{25,34}|T[1-9A-HJ-NP-Za-km-z]{33}|[48][1-9A-HJ-NP-Za-km-z]{94,105}|[1-9A-HJ-NP-Za-km-z]{32,44})$/.test(input.trim()),
    build: (input) => {
      const value = input.trim();
      if (/^0x[0-9a-fA-F]{40}$/.test(value)) {
        const eip55 = verifyEip55(value);
        return {
          type: 'crypto_address',
          value: value.toLowerCase(),
          label: eip55 === 'checksum-invalid' ? value : toEip55Address(value),
          properties: { chain: 'EVM (Ethereum/BSC/Polygon/…)', checksum: eip55, evmCompatible: true },
          tags: eip55 === 'checksum-invalid' ? ['seed', 'checksum-invalid'] : ['seed'],
          confidence: eip55 === 'checksum-invalid' ? 0.5 : 0.95,
        };
      }
      if (/^bc1/i.test(value)) {
        const segwit = validateBech32Address(value);
        return {
          type: 'crypto_address',
          value: value.toLowerCase(),
          label: value,
          properties: { chain: 'Bitcoin', addressType: segwit.addressType, witnessVersion: segwit.witnessVersion, valid: segwit.isValid },
          tags: segwit.isValid ? ['seed', 'segwit'] : ['seed', 'invalid-checksum'],
        };
      }
      if (/^[13]/.test(value)) {
        const decoded = decodeBase58Check(value);
        if (!decoded) return null;
        return {
          type: 'crypto_address',
          value,
          label: value,
          properties: { chain: 'Bitcoin', addressType: decoded.addressType, checksumValid: decoded.checksumValid },
          tags: decoded.checksumValid ? ['seed'] : ['seed', 'invalid-checksum'],
        };
      }
      if (/^T/.test(value)) {
        return { type: 'crypto_address', value, label: value, properties: { chain: 'TRON (TRC-20)' }, tags: ['seed'] };
      }
      if (/^[48]/.test(value)) {
        return { type: 'crypto_address', value, label: value, properties: { chain: 'Monero (XMR)' }, tags: ['seed'] };
      }
      if (validateSolanaAddress(value)) {
        return { type: 'crypto_address', value, label: value, properties: { chain: 'Solana' }, tags: ['seed'] };
      }
      return null;
    },
  },
  {
    type: 'phone',
    priority: 85,
    test: (input) => PHONE_RE.test(input.trim()) && input.replace(/\D/g, '').length >= 10 && input.replace(/\D/g, '').length <= 15,
    build: (input) => {
      const parsed = parsePhone(input, 'RU');
      if (!parsed.e164 && !parsed.isValid) return null;
      return {
        type: 'phone',
        value: parsed.e164 ?? input.replace(/[^\d+]/g, ''),
        label: input.trim(),
        properties: {
          country: parsed.country,
          countryCode: parsed.countryCode,
          nationalNumber: parsed.nationalNumber,
          numberingPlanValid: parsed.isValid,
        },
        confidence: parsed.isValid ? 0.95 : 0.6,
        tags: parsed.isValid ? ['seed'] : ['seed', 'plan-mismatch'],
      };
    },
  },
  {
    type: 'tax_id',
    priority: 80,
    test: (input) => /^\d{10}$/.test(input.replace(/\D/g, '')) || /^\d{12}$/.test(input.replace(/\D/g, '')),
    build: (input) => {
      const check = validateInn(input);
      return {
        type: 'tax_id',
        value: input.replace(/\D/g, ''),
        label: `ИНН ${input.replace(/\D/g, '')}`,
        properties: { kind: check.type, region: check.region, checksumValid: check.isValid, verifyUrl: check.details.verifyUrl },
        confidence: check.isValid ? 0.95 : 0.4,
        tags: check.isValid ? ['seed', 'validated'] : ['seed', 'checksum-invalid'],
        notes: check.isValid ? [] : [`Контрольная цифра ИНН не совпала: ${check.error}`],
      };
    },
  },
  {
    type: 'vehicle',
    priority: 78,
    test: (input) => VIN_RE.test(input.trim()) || /\d{2,3}$/.test(input.trim()) && /[А-ЯA-Z]\s*\d{3}\s*[А-ЯA-Z]{2}/i.test(input.trim()),
    build: (input) => {
      const value = input.trim();
      if (VIN_RE.test(value)) {
        const vin = decodeVin(value);
        return {
          type: 'vehicle',
          value: value.toUpperCase(),
          label: `VIN ${value.toUpperCase()}`,
          properties: {
            manufacturer: vin.details.manufacturer,
            wmiCountry: vin.details.wmiCountry,
            modelYear: vin.modelYear,
            checkDigitValid: vin.checkDigitValid,
            vinValid: vin.isValid,
            kind: 'VIN',
          },
          confidence: vin.isValid ? 0.9 : 0.45,
          tags: vin.isValid ? ['seed', 'vin'] : ['seed', 'vin', 'checksum-invalid'],
        };
      }
      const plate = parseRuPlate(value);
      if (!plate.isValid && !plate.plateType.startsWith('Тип')) return null;
      return {
        type: 'vehicle',
        value: normalizePlate(value),
        label: value.toUpperCase(),
        properties: { plateType: plate.plateType, specialSeries: plate.seriesType, region: plate.region, kind: 'ГРЗ' },
        confidence: plate.isValid ? 0.9 : 0.5,
        tags: plate.seriesType ? ['seed', 'plate', 'special-series'] : ['seed', 'plate'],
      };
    },
  },
  {
    type: 'organization',
    priority: 76,
    test: (input) => /^\d{13}$/.test(input.replace(/\D/g, '')) || /^\d{15}$/.test(input.replace(/\D/g, '')),
    build: (input) => {
      const digits = input.replace(/\D/g, '');
      const check = digits.length === 13 ? validateOgrn(digits) : validateOgrnip(digits);
      return {
        type: 'organization',
        value: digits,
        label: `${digits.length === 13 ? 'ОГРН' : 'ОГРНИП'} ${digits}`,
        properties: { kind: check.type, region: typeof check.region === 'string' ? check.region : undefined, checksumValid: check.isValid, issueYear: check.details.registrationYear },
        confidence: check.isValid ? 0.92 : 0.35,
        tags: check.isValid ? ['seed', 'validated'] : ['seed', 'checksum-invalid'],
        notes: check.isValid ? [] : [`Контрольная цифра не совпала: ${check.error}`],
      };
    },
  },
  {
    type: 'document',
    priority: 74,
    // СНИЛС is only recognised in its canonical form (`123-456-789 00`) or as a
    // bare 11-digit string; a phone number (`+7 916 …` → 11 digits) must NOT be
    // reinterpreted as a pension ID, so the checksum decides for bare digits.
    test: (input) => {
      const trimmed = input.trim();
      if (/^\d{3}-\d{3}-\d{3}\s?\d{2}$/.test(trimmed)) return true;
      return /^[\d\s-]+$/.test(trimmed) && trimmed.replace(/\D/g, '').length === 11;
    },
    build: (input) => {
      const digits = input.replace(/\D/g, '');
      if (digits.length === 11) {
        const snils = validateSnils(digits);
        const canonical = /^\d{3}-\d{3}-\d{3}\s?\d{2}$/.test(input.trim());
        if (!snils.isValid && !canonical) return null;
        return {
          type: 'document',
          value: `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)} ${digits.slice(9)}`,
          label: `СНИЛС ${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)} ${digits.slice(9)}`,
          properties: { kind: 'СНИЛС', checksumValid: snils.isValid, archive: snils.details.archive, source: canonical ? 'формат с разделителями' : 'цифровая строка' },
          confidence: snils.isValid ? 0.9 : 0.4,
          tags: snils.isValid ? ['seed', 'snils', 'pii'] : ['seed', 'snils', 'checksum-invalid'],
        };
      }
      return null;
    },
  },
  {
    type: 'bank_account',
    priority: 72,
    test: (input) => IBAN_RE.test(input.replace(/\s+/g, '')),
    build: (input) => {
      const iban = validateIban(input);
      return {
        type: 'bank_account',
        value: iban.formatted ?? input.replace(/\s+/g, '').toUpperCase(),
        label: iban.formatted ?? input,
        properties: { kind: 'IBAN', country: iban.country, checksumValid: iban.checksumOk, bban: iban.bban },
        confidence: iban.isValid ? 0.93 : 0.35,
        tags: iban.isValid ? ['seed', 'iban', 'financial'] : ['seed', 'iban', 'checksum-invalid'],
      };
    },
  },
  {
    type: 'ip',
    priority: 70,
    test: (input) => isIpAddress(input.trim()),
    build: (input) => ({
      type: 'ip',
      value: input.trim(),
      label: input.trim(),
      properties: { version: input.includes(':') ? 'IPv6' : 'IPv4' },
      tags: ['seed'],
    }),
  },
  {
    type: 'location',
    priority: 68,
    test: (input) => COORDS_RE.test(input.trim()) || (GEOHASH_RE.test(input.trim()) && !DOMAIN_RE.test(input.trim())),
    build: (input) => {
      const value = input.trim();
      const coords = COORDS_RE.exec(value);
      if (coords) {
        const latitude = Number(coords[1]);
        const longitude = Number(coords[2]);
        if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
        return {
          type: 'location',
          value: `${latitude.toFixed(6)},${longitude.toFixed(6)}`,
          label: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
          properties: { latitude, longitude, source: 'decimal-coordinates', precisionMetres: 10 },
          tags: ['seed', 'geo'],
        };
      }
      const area = geohashDecode(value);
      if (!area) return null;
      return {
        type: 'location',
        value: value.toLowerCase(),
        label: `Геохэш ${value.toUpperCase()}`,
        properties: {
          latitude: Number(area.latitude.toFixed(6)),
          longitude: Number(area.longitude.toFixed(6)),
          cellLatSpan: Number((area.latMax - area.latMin).toFixed(6)),
          precisionMetres: Math.round(area.errorMetres.lat),
          source: 'geohash',
        },
        tags: ['seed', 'geo'],
      };
    },
  },
  {
    type: 'domain',
    priority: 60,
    test: (input) => DOMAIN_RE.test(input.trim()) && input.includes('.') && !input.includes(' '),
    build: (input) => {
      const host = normalizeDomain(input);
      const registrable = registrableDomain(host);
      const dga = dgaScore(host);
      return {
        type: 'domain',
        value: host,
        label: host,
        properties: {
          registrable,
          tld: host.split('.').pop(),
          dgaScore: dga.score,
          dgaVerdict: dga.verdict,
          suspiciousPattern: dga.verdict !== 'human-readable',
        },
        tags: dga.verdict === 'human-readable' ? ['seed'] : ['seed', 'suspicious-domain'],
      };
    },
  },
  {
    type: 'username',
    priority: 50,
    test: (input) => /^@[A-Za-z0-9_.-]{2,64}$/.test(input.trim()),
    build: (input) => ({
      type: 'username',
      value: input.trim().replace(/^@/, '').toLowerCase(),
      label: input.trim(),
      properties: { skeleton: input.trim().replace(/^@/, '').toLowerCase() },
      tags: ['seed'],
    }),
  },
  {
    type: 'person',
    priority: 40,
    test: (input) => {
      const words = input.trim().split(/\s+/);
      if (words.length < 2 || words.length > 4) return false;
      return words.every((word) => /^[А-ЯЁA-Z][а-яёa-z-]{1,24}$/.test(word));
    },
    build: (input) => {
      const parts = parseFullName(input.trim());
      return {
        type: 'person',
        value: input.trim().replace(/\s+/g, ' ').toLowerCase(),
        label: input.trim().replace(/\s+/g, ' '),
        properties: {
          lastName: parts.last,
          firstName: parts.first,
          middleName: parts.middle,
          gender: parts.gender,
          hasPatronymic: Boolean(parts.middle),
        },
        tags: ['seed', 'person'],
      };
    },
  },
];

/** Surname / patronymic shape test used to keep name harvesting precise. */
const SURNAME_SHAPE_RE = /(ов|ев|ёв|ин|ын|ский|цкий|цкая|ой|ая|енко|ук|юк|ич|ян|ко|дзе|швили|оглу)$/i;
const PATRONYMIC_SHAPE_RE = /(ович|евич|ьич|овна|евна|ична|инична)$/i;

export function looksLikePersonName(value: string): boolean {
  const words = value.trim().split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;
  if (!words.every((word) => /^[А-ЯЁ][а-яё-]{1,24}$/.test(word))) return false;
  const hasPatronymic = words.some((word) => PATRONYMIC_SHAPE_RE.test(word));
  const surnameShaped = SURNAME_SHAPE_RE.test(words[0] as string);
  return hasPatronymic || (surnameShaped && words.length === 2);
}

function normalizePlate(input: string): string {
  return input.toUpperCase().replace(/\s+/g, ' ').trim();
}

/** Parse a single pasted input string into one or more seed entities. */
export function parseSeeds(input: string): SeedParseResult {
  const raw = (input ?? '').trim();
  const result: SeedParseResult = { entities: [], rejected: [], notes: [], unrecognized: [] };
  if (!raw) return result;

  const lines = raw
    .split(/[\n;]+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const candidates = lines.length > 1 ? lines : [raw];

  for (const candidate of candidates) {
    // Direct match first — an exact identifier is the strongest interpretation.
    // Detectors are tried in priority order and we *cascade* on validation
    // failure: a value rejected by the СНИЛС detector is still allowed to be
    // recognised as a phone number by a lower-priority detector.
    let matched = false;
    for (const detector of DETECTORS.slice().sort((a, b) => b.priority - a.priority)) {
      if (!detector.test(candidate)) continue;
      const draft = detector.build(candidate);
      if (!draft) {
        result.rejected.push({ value: candidate, type: detector.type, reason: 'не прошёл валидацию детектора' });
        continue;
      }
      result.entities.push(draft);
      result.notes.push(`${detector.type}: распознан «${draft.label}»${draft.tags?.includes('checksum-invalid') ? ' — КОНТРОЛЬНАЯ СУММА НЕ СОШЛАСЬ' : ''}`);
      matched = true;
      break;
    }
    if (matched) continue;

    // Mixed text (a pasted dossier) → extract every observable inside it.
    const extracted = extractObservables(candidate);
    if (extracted.entities.length) {
      result.entities.push(...extracted.entities);
      result.notes.push(`Из текста извлечено наблюдений: ${extracted.entities.length}`);
      result.rejected.push(...extracted.rejected);
    } else {
      result.unrecognized.push(candidate);
    }
  }

  // A person seed with an explicit birth date in the same input enriches the node.
  const birthDate = candidates.map((candidate) => /(\d{2}[.\-/]\d{2}[.\-/]\d{4})/.exec(candidate)?.[1]).find(Boolean);
  if (birthDate) {
    for (const entity of result.entities) {
      if (entity.type === 'person') {
        entity.properties = { ...(entity.properties ?? {}), birthDate };
        result.notes.push(`Дата рождения привязана к персоне: ${birthDate}`);
      }
    }
  }

  return dedupeSeeds(result);
}

/**
 * Harvest every observable from free text (registries exports, court rulings,
 * leaked dumps, social bios). Bounded and order-preserving.
 */
export function extractObservables(text: string, limit = 120): SeedParseResult {
  const result: SeedParseResult = { entities: [], rejected: [], notes: [], unrecognized: [] };
  const seen = new Set<string>();

  const patterns: Array<{ type: EntityType; regex: RegExp; detector?: Detector }> = [
    { type: 'email', regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
    { type: 'phone', regex: /(?:\+7|\b8|\+[1-9]\d{0,3})[\s(-]*\d{3}[\s)-]*\d{3}[\s-]?\d{2}[\s-]?\d{2}\b/g },
    { type: 'url', regex: /https?:\/\/[^\s<>"')\],;]+/g },
    { type: 'crypto_address', regex: /\b(?:0x[0-9a-fA-F]{40}|bc1[a-z0-9]{25,87}|[13][1-9A-HJ-NP-Za-km-z]{25,34}|T[1-9A-HJ-NP-Za-km-z]{33})\b/g },
    { type: 'tax_id', regex: /\b(?:ИНН[:\s]*)?(\d{10}|\d{12})\b/g },
    { type: 'organization', regex: /\b(?:ОГРН(?:ИП)?[:\s]*)?(\d{13}|\d{15})\b/g },
    { type: 'document', regex: /\b\d{3}-\d{3}-\d{3}\s?\d{2}\b/g },
    { type: 'vehicle', regex: /\b[A-HJ-NPR-Z0-9]{17}\b/g },
    { type: 'bank_account', regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g },
    { type: 'ip', regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
    // Negative lookbehind keeps `m.sokolov@example.com` from yielding a second,
    // redundant `example.com` seed — the e-mail detector already owns it.
    { type: 'domain', regex: /(?<![@\w.-])(?:[a-z0-9-]+\.)+(?:ru|com|net|org|io|me|info|biz|su|рф|onion|xyz|top|site|online)\b/gi },
    { type: 'location', regex: /\b-?\d{1,3}\.\d{4,8}\s*,\s*-?\d{1,3}\.\d{4,8}\b/g },
  ];

  for (const { type, regex } of patterns) {
    const matches = text.match(regex) ?? [];
    for (const match of matches.slice(0, 24)) {
      const value = match.trim();
      const key = `${type}:${value.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const detector = DETECTORS.find((candidate) => candidate.type === type);
      const draft = detector?.build(value);
      if (draft) {
        result.entities.push({ ...draft, tags: [...new Set([...(draft.tags ?? []), 'harvested'])] });
      } else if (type === 'tax_id' || type === 'organization') {
        const stripped = value.replace(/[^\d]/g, '');
        result.rejected.push({ value, type, reason: stripped.length === 10 || stripped.length === 12 ? 'контрольная сумма ФНС не совпала' : 'не идентификатор' });
      }
      if (result.entities.length >= limit) return dedupeSeeds(result);
    }
  }

  // Persons in free text: 2–4 capitalised words that pass the person detector.
  // Precision guard — a Russian ФИО is recognised only when it carries a
  // patronymic or a surname-shaped first word, so «Банк России» / «Москва
  // Россия» are not harvested as people.
  const personDetector = DETECTORS.find((candidate) => candidate.type === 'person');
  if (personDetector) {
    for (const match of (text.match(/(?<![А-ЯЁа-яё])[А-ЯЁ][а-яё]{1,24}(?:\s+[А-ЯЁ][а-яё]{1,24}){1,3}(?![А-ЯЁа-яё])/g) ?? []).slice(0, 10)) {
      const value = match.trim().replace(/\s+/g, ' ');
      const key = `person:${value.toLowerCase()}`;
      if (seen.has(key) || !looksLikePersonName(value)) continue;
      seen.add(key);
      const draft = personDetector.build(value);
      if (!draft) continue;
      result.entities.push({ ...draft, tags: [...new Set([...(draft.tags ?? []), 'harvested'])] });
      if (result.entities.length >= limit) return dedupeSeeds(result);
    }
  }

  // Cadastral numbers and ИНН with explicit labels need dedicated passes.
  for (const match of (text.match(/\b\d{2}:\d{2}:\d{6,7}:\d{1,4}\b/g) ?? []).slice(0, 12)) {
    const check = validateCadastralNumber(match);
    if (check.isValid) {
      result.entities.push({
        type: 'real_estate',
        value: match,
        label: `Кадастровый номер ${match}`,
        properties: { region: check.region, ...check.details },
        tags: ['harvested', 'realty'],
      });
    }
  }
  for (const match of (text.match(/\b04\d{7}\b/g) ?? []).slice(0, 8)) {
    const check = validateBik(match);
    if (check.isValid) {
      result.entities.push({ type: 'bank_account', value: match, label: `БИК ${match}`, properties: { kind: 'БИК', region: check.region, ...check.details }, tags: ['harvested', 'bank'] });
    }
  }
  // Passport recognition is deliberately conservative: a bare 10-digit number
  // is far more often an ИНН, so either the document is written with a
  // separator (4509 123456) or the text names it explicitly.
  const passportCandidates: string[] = [
    ...(text.match(/\b\d{4}\s\d{6}\b|\b\d{4}-\d{6}\b/g) ?? []),
    ...(text.match(/(?:паспорт\w*|серия|выдан\w*)[^\d]{0,40}\d{4}\s?\d{6}/gi) ?? []).map((match) => {
      const tail = /(\d{4})\s?(\d{6})/.exec(match);
      return tail ? `${tail[1]} ${tail[2]}` : match;
    }),
  ];
  for (const match of passportCandidates.slice(0, 8)) {
    const digits = match.replace(/\D/g, '');
    const passport = validatePassportRf(digits.slice(0, 4), digits.slice(4));
    if (passport.isValid) {
      result.entities.push({
        type: 'document',
        value: `${digits.slice(0, 4)} ${digits.slice(4)}`,
        label: `Паспорт РФ ${digits.slice(0, 4)} ${digits.slice(4)}`,
        properties: { kind: 'Паспорт РФ', region: passport.region, issueYear: passport.details.issueYear },
        tags: ['harvested', 'pii', 'document'],
      });
    }
  }

  return dedupeSeeds(result);
}

function dedupeSeeds(result: SeedParseResult): SeedParseResult {
  const byKey = new Map<string, EntityDraft>();
  for (const entity of result.entities) {
    const key = `${entity.type}:${entity.value.toLowerCase()}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, entity);
      continue;
    }
    existing.properties = { ...(existing.properties ?? {}), ...(entity.properties ?? {}) };
    existing.tags = [...new Set([...(existing.tags ?? []), ...(entity.tags ?? [])])];
    existing.confidence = Math.max(existing.confidence ?? 0.7, entity.confidence ?? 0.7);
  }
  return { ...result, entities: [...byKey.values()].slice(0, 200) };
}

/** Convert seeds into graph pivots for the planner. */
export function seedsToPivots(seeds: EntityDraft[]): Pivot[] {
  return seeds.map((seed) => ({
    type: seed.type,
    value: seed.value,
    reason: 'Входной индикатор (аналитик)',
    confidence: seed.confidence ?? 0.8,
    label: seed.label,
  }));
}

/** Extract a human display name from any seed set (used for report headlines). */
export function seedHeadline(seeds: EntityDraft[], fallbackQuery: string): string {
  const person = seeds.find((seed) => seed.type === 'person');
  if (person) return person.label ?? person.value;
  const organisation = seeds.find((seed) => seed.type === 'organization');
  if (organisation) return organisation.label ?? organisation.value;
  const priority: EntityType[] = ['phone', 'email', 'domain', 'crypto_address', 'username', 'tax_id', 'vehicle', 'ip'];
  for (const type of priority) {
    const match = seeds.find((seed) => seed.type === type);
    if (match) return match.label ?? match.value;
  }
  return fallbackQuery.trim() || 'Объект исследования';
}
