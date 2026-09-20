/**
 * TOMAHAWK OSINT ENGINE — Base58 / Base58Check (Bitcoin, TRON, WIF)
 * ---------------------------------------------------------------------------
 * Real payload + double-SHA-256 checksum verification instead of a regex guess.
 * A regex accepts `1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA` as a "Bitcoin address";
 * this decoder rejects it, which is exactly the difference between a toy and a
 * tool you can put in a report.
 */

import { concatBytes, doubleSha256Bytes, utf8ToBytes } from './hashes';

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const ALPHABET_MAP = new Map<string, number>();
for (let i = 0; i < ALPHABET.length; i += 1) ALPHABET_MAP.set(ALPHABET[i] as string, i);

export function base58Encode(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  const digits: number[] = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i += 1) {
      carry += (digits[i] as number) << 8;
      digits[i] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let out = '';
  for (const byte of bytes) {
    if (byte !== 0) break;
    out += '1';
  }
  for (let i = digits.length - 1; i >= 0; i -= 1) out += ALPHABET[digits[i] as number];
  return out;
}

export function base58Decode(input: string): Uint8Array | null {
  if (!input) return null;
  // Reject ambiguous characters outright — they never appear in valid Base58.
  for (const char of input) if (!ALPHABET_MAP.has(char)) return null;

  const bytes: number[] = [0];
  for (const char of input) {
    let carry = ALPHABET_MAP.get(char) as number;
    for (let i = 0; i < bytes.length; i += 1) {
      carry += (bytes[i] as number) * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const char of input) {
    if (char !== '1') break;
    bytes.push(0);
  }
  return Uint8Array.from(bytes.reverse());
}

export interface Base58CheckResult {
  /** Version byte(s) decoded from the payload prefix. */
  version: number;
  payload: Uint8Array;
  checksum: string;
  checksumValid: boolean;
  addressType: string;
  chain: string;
}

/**
 * Chain/type table keyed by version byte. TRON reuses 0x41; WIF keys (0x80) and
 * Zcash/Bitcoin-Cash legacy prefixes are included because they show up in
 * credential and wallet dumps routinely.
 */
const VERSION_TABLE: Record<string, { type: string; chain: string; leading: string }> = {
  '0x00': { type: 'P2PKH (Legacy)', chain: 'Bitcoin', leading: '1' },
  '0x05': { type: 'P2SH (Script Hash)', chain: 'Bitcoin', leading: '3' },
  '0x41': { type: 'Account (Base58Check)', chain: 'TRON / TRC-20', leading: 'T' },
  '0x80': { type: 'WIF Private Key', chain: 'Bitcoin', leading: '5/K/L' },
  '0x1e': { type: 'P2PKH', chain: 'DigiByte', leading: 'D' },
  '0x30': { type: 'P2PKH', chain: 'Litecoin (legacy)', leading: 'L' },
  '0x32': { type: 'P2SH', chain: 'Litecoin (legacy)', leading: 'M' },
  '0x23': { type: 'P2PKH', chain: 'Bitcoin Cash (legacy)', leading: '1' },
  '0x0a': { type: 'P2PKH', chain: 'Dash', leading: 'X' },
  '0x2a': { type: 'P2PKH', chain: 'Zcash (t-addr)', leading: 't' },
};

export function decodeBase58Check(input: string): Base58CheckResult | null {
  const raw = base58Decode(input);
  if (!raw || raw.length < 5) return null;
  const payloadWithVersion = raw.slice(0, raw.length - 4);
  const embedded = raw.slice(raw.length - 4);
  const expected = doubleSha256Bytes(payloadWithVersion).slice(0, 4);
  const checksumValid = embedded.every((byte, index) => byte === (expected[index] as number));
  const version = payloadWithVersion[0] as number;
  const key = `0x${version.toString(16).padStart(2, '0')}`;
  const meta = VERSION_TABLE[key] ?? { type: 'Неизвестный префикс', chain: 'Unknown', leading: '?' };
  return {
    version,
    payload: payloadWithVersion.slice(1),
    checksum: [...embedded].map((b) => b.toString(16).padStart(2, '0')).join(''),
    checksumValid,
    addressType: meta.type,
    chain: meta.chain,
  };
}

export function encodeBase58Check(payload: Uint8Array, version = 0): string {
  const withVersion = concatBytes(Uint8Array.from([version]), payload);
  const checksum = doubleSha256Bytes(withVersion).slice(0, 4);
  return base58Encode(concatBytes(withVersion, checksum));
}

/** Bitcoin P2PKH / P2SH validation with real checksum verification. */
export function validateBitcoinBase58(address: string): { isValid: boolean; type: string; checksumValid: boolean } {
  const decoded = decodeBase58Check(address);
  if (!decoded) return { isValid: false, type: 'Некорректный Base58', checksumValid: false };
  const isP2pkh = decoded.version === 0x00 && decoded.payload.length === 20;
  const isP2sh = decoded.version === 0x05 && decoded.payload.length === 20;
  return {
    isValid: decoded.checksumValid && (isP2pkh || isP2sh),
    type: isP2pkh ? 'Bitcoin P2PKH (Legacy)' : isP2sh ? 'Bitcoin P2SH' : `Нестандартный префикс (0x${decoded.version.toString(16)})`,
    checksumValid: decoded.checksumValid,
  };
}

/** TRON addresses are Base58Check with version 0x41 and a 20-byte payload. */
export function validateTronAddress(address: string): { isValid: boolean; checksumValid: boolean; hex?: string } {
  const decoded = decodeBase58Check(address);
  if (!decoded) return { isValid: false, checksumValid: false };
  const hex = `41${[...decoded.payload].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
  return { isValid: decoded.version === 0x41 && decoded.payload.length === 20 && decoded.checksumValid, checksumValid: decoded.checksumValid, hex };
}

/** Solana addresses are bare 32-byte Ed25519 public keys in Base58 (no checksum). */
export function validateSolanaAddress(address: string): boolean {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return false;
  const decoded = base58Decode(address);
  return decoded !== null && decoded.length === 32;
}

/** Monero standard (95) / integrated (106) addresses use a custom Keccak checksum. */
export function validateMoneroAddressFormat(address: string): { isValid: boolean; kind: string } {
  if (!/^[48][1-9A-HJ-NP-Za-km-z]{94}$/.test(address)) {
    if (/^[48][1-9A-HJ-NP-Za-km-z]{105}$/.test(address)) return { isValid: true, kind: 'Monero Integrated (106 симв.)' };
    return { isValid: false, kind: 'Некорректный формат' };
  }
  return { isValid: true, kind: 'Monero Standard (95 симв.)' };
}

export { utf8ToBytes };
