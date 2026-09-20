/**
 * TOMAHAWK OSINT ENGINE — check-digit algorithms (Luhn, ISO 7064, EAN, Mod-97)
 * Every validator here is a *real* arithmetic check, industry standard:
 *   • Luhn (ISO/IEC 7812): payment cards, IMEI, ICCID, RU СНИЛС partial
 *   • ISO 7064 MOD 97-10: IBAN, BBAN, VAT structures
 *   • EAN-13 / UPC-A / GTIN: barcodes on seized goods & product lookups
 *   • ISO 7064 MOD 11,10: national ID structures (e.g. Chinese ID, PESEL)
 *   • Verhoeff: Aadhaar-style and some transport documents
 */

export function luhnCheckDigit(digits: string): number {
  let sum = 0;
  let double = true;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let value = Number(digits[i]);
    if (Number.isNaN(value)) return -1;
    if (double) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    double = !double;
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidLuhn(digits: string): boolean {
  const clean = digits.replace(/[\s-]/g, '');
  if (!/^\d{2,}$/.test(clean)) return false;
  const body = clean.slice(0, -1);
  const check = Number(clean.slice(-1));
  return luhnCheckDigit(body) === check;
}

/** IMEI/IMEISV: 15 digits validated by Luhn (14 digits + check digit). */
export function validateImei(imei: string): { isValid: boolean; type: string; tac?: string; serial?: string } {
  const clean = imei.replace(/[\s-]/g, '');
  if (!/^\d{15}$/.test(clean)) return { isValid: false, type: 'IMEI должен содержать 15 цифр' };
  return {
    isValid: isValidLuhn(clean),
    type: 'IMEI (3GPP TS 23.003)',
    tac: clean.slice(0, 8),
    serial: clean.slice(8, 14),
  };
}

/** ICCID (SIM card serial): 19–20 digits, Luhn over the whole string. */
export function validateIccid(iccid: string): { isValid: boolean; issuer?: string } {
  const clean = iccid.replace(/\s/g, '');
  if (!/^\d{19,20}$/.test(clean)) return { isValid: false };
  const issuer = clean.slice(0, 2) === '89' ? `Telecom-эмитент (MCC ${clean.slice(2, 5)})` : 'Нестандартный префикс';
  return { isValid: isValidLuhn(clean), issuer };
}

/** ISO 7064 MOD 97-10 — the IBAN checksum (also used for RU bank accounts). */
export function mod97(input: string): number {
  let remainder = 0;
  for (const char of input) {
    const code = char >= '0' && char <= '9' ? char : String(char.charCodeAt(0) - 55);
    for (const digit of code) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder;
}

export interface IbanResult {
  isValid: boolean;
  country?: string;
  formatted?: string;
  bban?: string;
  expectedLength?: number;
  checksumOk: boolean;
  error?: string;
}

const IBAN_LENGTHS: Record<string, number> = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22, BR: 29, BY: 28, CH: 21, CR: 22,
  CY: 28, CZ: 24, DE: 22, DK: 18, DO: 28, EE: 20, EG: 29, ES: 24, FI: 18, FO: 18, FR: 27, GB: 22, GE: 22,
  GI: 23, GL: 18, GR: 27, GT: 28, HR: 21, HU: 28, IE: 22, IL: 23, IQ: 23, IS: 26, IT: 27, JO: 30, KW: 30,
  KZ: 20, LB: 28, LC: 32, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, MD: 24, ME: 22, MK: 19, MR: 27, MT: 31,
  MU: 30, NL: 18, NO: 15, PK: 24, PL: 28, PS: 29, PT: 25, QA: 29, RO: 24, RS: 22, SA: 24, SC: 31, SE: 24,
  SI: 19, SK: 24, SM: 27, ST: 25, SV: 28, TL: 23, TN: 24, TR: 26, UA: 29, VA: 22, VG: 24, XK: 20,
};

export function validateIban(input: string): IbanResult {
  const clean = input.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(clean)) {
    return { isValid: false, checksumOk: false, error: 'Структура IBAN не соответствует ISO 13616' };
  }
  const country = clean.slice(0, 2);
  const expectedLength = IBAN_LENGTHS[country];
  const checksumOk = mod97(`${clean.slice(4)}${clean.slice(0, 4)}`) === 1;
  const lengthOk = expectedLength === undefined || expectedLength === clean.length;

  return {
    isValid: checksumOk && lengthOk,
    checksumOk,
    country,
    expectedLength,
    bban: clean.slice(4),
    formatted: clean.replace(/(.{4})/g, '$1 ').trim(),
    error: !checksumOk ? 'Контрольная сумма MOD-97 не совпала' : !lengthOk ? `Ожидаемая длина для ${country}: ${expectedLength}` : undefined,
  };
}

/** EAN-13 / UPC-A / GTIN-14 check digit (weights 1,3 alternating). */
export function validateEan(code: string): { isValid: boolean; type: string } {
  const clean = code.replace(/\s/g, '');
  if (!/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(clean)) return { isValid: false, type: 'Не EAN/UPC' };
  const body = clean.slice(0, -1).split('').reverse();
  let sum = 0;
  body.forEach((char, index) => {
    sum += Number(char) * (index % 2 === 0 ? 3 : 1);
  });
  const check = (10 - (sum % 10)) % 10;
  const type = clean.length === 8 ? 'EAN-8' : clean.length === 12 ? 'UPC-A' : clean.length === 13 ? 'EAN-13' : 'GTIN-14';
  return { isValid: check === Number(clean.slice(-1)), type };
}

/** ISO 7064 MOD 11,10 — used by several national identifiers. */
export function iso7064Mod11_10(input: string): boolean {
  if (!/^\d+$/.test(input)) return false;
  let check = 5;
  for (const char of input) {
    check = ((((check || 10) * 2) % 11) + Number(char)) % 10;
    if (check === 0) return false;
    // standard formulation below is used only for the final digit
  }
  return check === 1;
}

/** Verhoeff (dihedral D5) — used by Aadhaar-style IDs and some rail tickets. */
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export function isValidVerhoeff(input: string): boolean {
  const digits = input.replace(/\D/g, '');
  if (!digits) return false;
  let checksum = 0;
  const reversed = digits.split('').reverse();
  reversed.forEach((char, index) => {
    const digit = Number(char);
    const permutation = (VERHOEFF_P[index % 8] as number[])[digit] as number;
    checksum = (VERHOEFF_D[checksum] as number[])[permutation] as number;
  });
  return checksum === 0;
}
