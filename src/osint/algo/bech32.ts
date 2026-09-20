/**
 * TOMAHAWK OSINT ENGINE — Bech32 / Bech32m (BIP-173 & BIP-350)
 * ---------------------------------------------------------------------------
 * Implements the full Bech32 spec including the polymod checksum verification
 * and SegWit witness-program rules, so `bc1p...` (Taproot, bech32m) and
 * `bc1q...` (SegWit v0, bech32) addresses are *actually* validated — an
 * invalid checksum is a red flag (typo, poisoning attempt, or fabricated IoC).
 *
 * The same codec powers Cosmos, Terra, Osmosis, Litecoin, Zcash and countless
 * other chains, so one implementation covers a large slice of the crypto OSINT
 * surface.
 */

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const CHARSET_MAP = new Map<string, number>();
for (let i = 0; i < CHARSET.length; i += 1) CHARSET_MAP.set(CHARSET[i] as string, i);

const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
const BECH32_CONST = 1;
const BECH32M_CONST = 0x2bc830a3;

export type Bech32Encoding = 'bech32' | 'bech32m';

function polymod(values: number[]): number {
  let checksum = 1;
  for (const value of values) {
    const top = checksum >> 25;
    checksum = ((checksum & 0x1ffffff) << 5) ^ value;
    for (let i = 0; i < 5; i += 1) {
      if ((top >> i) & 1) checksum ^= GENERATOR[i] as number;
    }
  }
  return checksum;
}

function hrpExpand(hrp: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < hrp.length; i += 1) out.push(hrp.charCodeAt(i) >> 5);
  out.push(0);
  for (let i = 0; i < hrp.length; i += 1) out.push(hrp.charCodeAt(i) & 31);
  return out;
}

export interface Bech32Decoded {
  hrp: string;
  data: number[];
  encoding: Bech32Encoding;
}

export function bech32Decode(input: string): Bech32Decoded | null {
  if (typeof input !== 'string' || input.length < 8 || input.length > 90) return null;
  if (input !== input.toLowerCase() && input !== input.toUpperCase()) return null; // mixed case is invalid

  const address = input.toLowerCase();
  const separator = address.lastIndexOf('1');
  if (separator < 1 || separator + 7 > address.length) return null;

  const hrp = address.slice(0, separator);
  if (hrp.length === 0 || [...hrp].some((char) => char.charCodeAt(0) < 33 || char.charCodeAt(0) > 126)) return null;

  const data: number[] = [];
  for (const char of address.slice(separator + 1)) {
    const value = CHARSET_MAP.get(char);
    if (value === undefined) return null;
    data.push(value);
  }

  const checksum = polymod([...hrpExpand(hrp), ...data]);
  const encoding: Bech32Encoding | null = checksum === BECH32_CONST ? 'bech32' : checksum === BECH32M_CONST ? 'bech32m' : null;
  if (!encoding) return null;

  return { hrp, data: data.slice(0, data.length - 6), encoding };
}

export function bech32Encode(hrp: string, data: number[], encoding: Bech32Encoding = 'bech32'): string {
  const constant = encoding === 'bech32' ? BECH32_CONST : BECH32M_CONST;
  const values = [...hrpExpand(hrp), ...data];
  const checksum = polymod([...values, 0, 0, 0, 0, 0, 0]) ^ constant;
  const checksumChars: string[] = [];
  for (let i = 0; i < 6; i += 1) checksumChars.push(CHARSET[(checksum >> (5 * (5 - i))) & 31] as string);
  return `${hrp}1${data.map((value) => CHARSET[value] as string).join('')}${checksumChars.join('')}`;
}

function convertBits(data: number[], fromBits: number, toBits: number, pad: boolean): number[] | null {
  let accumulator = 0;
  let bits = 0;
  const out: number[] = [];
  const maxValue = (1 << toBits) - 1;
  for (const value of data) {
    if (value < 0 || value >> fromBits !== 0) return null;
    accumulator = (accumulator << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      out.push((accumulator >> bits) & maxValue);
    }
  }
  if (pad) {
    if (bits > 0) out.push((accumulator << (toBits - bits)) & maxValue);
  } else if (bits >= fromBits || ((accumulator << (toBits - bits)) & maxValue) !== 0) {
    return null;
  }
  return out;
}

export interface SegwitValidation {
  isValid: boolean;
  hrp?: string;
  encoding?: Bech32Encoding;
  witnessVersion?: number;
  programHex?: string;
  programLength?: number;
  error?: string;
  addressType?: string;
  chain?: string;
}

/** Human-readable-part → chain map for the most-seen networks in OSINT work. */
const HRP_CHAINS: Record<string, string> = {
  bc: 'Bitcoin',
  tb: 'Bitcoin Testnet',
  ltc: 'Litecoin',
  bch: 'Bitcoin Cash (cashaddr)',
  zec: 'Zcash',
  cosmos: 'Cosmos Hub',
  osmo: 'Osmosis',
  terra: 'Terra',
  celestia: 'Celestia',
  inj: 'Injective',
  thor: 'THORChain',
  kava: 'Kava',
};

/**
 * Full BIP-173/350 SegWit validation: checksum, witness version, program
 * length and bech32/bech32m selection.
 */
export function validateBech32Address(input: string): SegwitValidation {
  const decoded = bech32Decode(input);
  if (!decoded) return { isValid: false, error: 'Некорректная контрольная сумма / кодировка Bech32' };

  const { hrp, data, encoding } = decoded;
  if (data.length === 0) return { isValid: false, hrp, encoding, error: 'Пустые данные' };

  const witnessVersion = data[0] as number;
  const program = convertBits(data.slice(1), 5, 8, false);
  if (!program) return { isValid: false, hrp, encoding, error: 'Некорректное выравнивание битов' };

  const programHex = [...program].map((b) => b.toString(16).padStart(2, '0')).join('');

  if (witnessVersion === 0) {
    if (encoding !== 'bech32') return { isValid: false, hrp, error: 'Для witness v0 требуется bech32, найдено bech32m', encoding };
    if (program.length !== 20 && program.length !== 32) return { isValid: false, hrp, encoding, error: `Недопустимая длина программы: ${program.length}` };
  } else if (witnessVersion >= 1 && witnessVersion <= 16) {
    if (encoding !== 'bech32m') return { isValid: false, hrp, encoding, error: 'Для witness v1+ требуется bech32m' };
    if (program.length < 2 || program.length > 40) return { isValid: false, hrp, encoding, error: `Недопустимая длина программы: ${program.length}` };
  }

  const addressType =
    witnessVersion === 0 && program.length === 20
      ? 'P2WPKH (Native SegWit)'
      : witnessVersion === 0 && program.length === 32
        ? 'P2WSH (SegWit Script Hash)'
        : witnessVersion === 1 && program.length === 32
          ? 'P2TR (Taproot)'
          : `Witness v${witnessVersion} / ${program.length} байт`;

  return {
    isValid: true,
    hrp,
    encoding,
    witnessVersion,
    programHex,
    programLength: program.length,
    addressType,
    chain: HRP_CHAINS[hrp] ?? `Неизвестный HRP «${hrp}»`,
  };
}

/** Convert a SegWit witness program to the canonical scriptPubKey hex. */
export function witnessProgramToScriptPubKey(witnessVersion: number, programHex: string): string {
  const opcode = witnessVersion === 0 ? '00' : (0x50 + witnessVersion).toString(16);
  const lengthHex = (programHex.length / 2).toString(16).padStart(2, '0');
  return `${opcode}${lengthHex}${programHex}`;
}
