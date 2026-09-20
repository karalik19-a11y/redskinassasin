/**
 * TOMAHAWK OSINT ENGINE — Keccak-256 (the *original* Keccak, not FIPS-202 SHA3)
 * ---------------------------------------------------------------------------
 * Ethereum uses Keccak-256 with 0x01 domain padding. Having it locally means we
 * can verify EIP-55 address checksums *offline and deterministically* — most
 * "OSINT" tools only regex-match `0x[0-9a-f]{40}` and therefore accept typos,
 * which produces false positives in investigations.
 *
 * Used for:
 *   • EIP-55 mixed-case checksum verification of Ethereum / EVM addresses
 *   • ERC-20 / 4-byte function-selector identification
 *   • address-poisoning detection (look-alike address generation)
 */

/** Canonical round constants for the Keccak-f[1600] permutation. */
/** Round constants of Keccak-f[1600] as little-endian (low, high) 32-bit word pairs. */
const KECCAK_ROUND_CONSTANTS = new Uint32Array([
  0x00000001, 0x00000000, 0x00008082, 0x00000000, 0x0000808a, 0x80000000, 0x80008000, 0x80000000, 0x0000808b, 0x00000000,
  0x80000001, 0x00000000, 0x80008081, 0x80000000, 0x00008009, 0x80000000, 0x0000008a, 0x00000000, 0x00000088, 0x00000000,
  0x80008009, 0x00000000, 0x8000000a, 0x00000000, 0x8000808b, 0x00000000, 0x0000008b, 0x80000000, 0x00008089, 0x80000000,
  0x00008003, 0x80000000, 0x00008002, 0x80000000, 0x00000080, 0x80000000, 0x0000800a, 0x00000000, 0x8000000a, 0x80000000,
  0x80008081, 0x80000000, 0x00008080, 0x80000000, 0x80000001, 0x00000000, 0x80008008, 0x80000000,
]);

import { bytesToHex, utf8ToBytes } from './hashes';

const ROTATION_OFFSETS = [
  [0, 36, 3, 41, 18],
  [1, 44, 10, 45, 2],
  [62, 6, 43, 15, 61],
  [28, 55, 25, 21, 56],
  [27, 20, 39, 8, 14],
];

/**
 * Keccak-f[1600] permutation over a 25×64-bit state stored as 50 uint32 halves.
 * Lane `(x, y)` lives at index `(x + 5y) * 2` (low word) / `+ 1` (high word).
 * Exported for test vectors and differential testing against reference impls.
 */
export function keccakF1600(state: Uint32Array, rounds = 24): void {
  const C = new Uint32Array(10);
  const D = new Uint32Array(10);
  const B = new Uint32Array(50);

  for (let round = 0; round < rounds; round += 1) {
    // θ
    for (let x = 0; x < 5; x += 1) {
      const index = x * 2;
      C[index] = (state[index] as number) ^ (state[index + 10] as number) ^ (state[index + 20] as number) ^ (state[index + 30] as number) ^ (state[index + 40] as number);
      C[index + 1] = (state[index + 1] as number) ^ (state[index + 11] as number) ^ (state[index + 21] as number) ^ (state[index + 31] as number) ^ (state[index + 41] as number);
    }
    for (let x = 0; x < 5; x += 1) {
      const index = x * 2;
      const prev = ((x + 4) % 5) * 2;
      const next = ((x + 1) % 5) * 2;
      const nextLow = C[next] as number;
      const nextHigh = C[next + 1] as number;
      // D[x] = C[x-1] xor rotl(C[x+1], 1) — 64-bit rotate across the lane halves
      D[index] = ((C[prev] as number) ^ ((nextLow << 1) | (nextHigh >>> 31))) >>> 0;
      D[index + 1] = ((C[prev + 1] as number) ^ ((nextHigh << 1) | (nextLow >>> 31))) >>> 0;
    }
    for (let x = 0; x < 5; x += 1) {
      for (let y = 0; y < 5; y += 1) {
        const index = (x + 5 * y) * 2;
        state[index] = (state[index] as number) ^ (D[x * 2] as number);
        state[index + 1] = (state[index + 1] as number) ^ (D[x * 2 + 1] as number);
      }
    }

    // ρ and π
    for (let x = 0; x < 5; x += 1) {
      for (let y = 0; y < 5; y += 1) {
        const target = (y + 5 * ((2 * x + 3 * y) % 5)) * 2;
        const offset = (ROTATION_OFFSETS[x] as number[])[y] as number;
        const low = state[(x + 5 * y) * 2] as number;
        const high = state[(x + 5 * y) * 2 + 1] as number;
        if (offset === 0) {
          B[target] = low;
          B[target + 1] = high;
        } else if (offset < 32) {
          B[target] = ((low << offset) | (high >>> (32 - offset))) >>> 0;
          B[target + 1] = ((high << offset) | (low >>> (32 - offset))) >>> 0;
        } else {
          const shift = offset - 32;
          B[target] = shift === 0 ? high >>> 0 : ((high << shift) | (low >>> (32 - shift))) >>> 0;
          B[target + 1] = shift === 0 ? low >>> 0 : ((low << shift) | (high >>> (32 - shift))) >>> 0;
        }
      }
    }

    // χ
    for (let x = 0; x < 5; x += 1) {
      for (let y = 0; y < 5; y += 1) {
        const a = ((x + 1) % 5 + 5 * y) * 2;
        const b = ((x + 2) % 5 + 5 * y) * 2;
        const current = (x + 5 * y) * 2;
        state[current] = (B[current] ^ (~B[a] & B[b])) >>> 0;
        state[current + 1] = (B[current + 1] ^ (~B[a + 1] & B[b + 1])) >>> 0;
      }
    }

    // ι
    state[0] = (state[0] as number) ^ (KECCAK_ROUND_CONSTANTS[round * 2] as number);
    state[1] = (state[1] as number) ^ (KECCAK_ROUND_CONSTANTS[round * 2 + 1] as number);
  }
}

/** Keccak-256 digest of arbitrary bytes. */
export function keccak256Bytes(input: Uint8Array): Uint8Array {
  const rate = 136; // 1088 bits
  const state = new Uint32Array(50);

  const paddedLength = Math.ceil((input.length + 1) / rate) * rate;
  const padded = new Uint8Array(paddedLength);
  padded.set(input);
  padded[input.length] = 0x01; // Keccak padding (SHA-3 would be 0x06)
  padded[paddedLength - 1] |= 0x80;

  for (let offset = 0; offset < padded.length; offset += rate) {
    // Absorb the rate block lane by lane: each 64-bit lane is stored
    // little-endian as (low 32 bits, high 32 bits).
    for (let lane = 0; lane < rate / 8; lane += 1) {
      const position = offset + lane * 8;
      const low = ((padded[position] as number) | ((padded[position + 1] as number) << 8) | ((padded[position + 2] as number) << 16) | ((padded[position + 3] as number) << 24)) >>> 0;
      const high = ((padded[position + 4] as number) | ((padded[position + 5] as number) << 8) | ((padded[position + 6] as number) << 16) | ((padded[position + 7] as number) << 24)) >>> 0;
      state[lane * 2] = ((state[lane * 2] as number) ^ low) >>> 0;
      state[lane * 2 + 1] = ((state[lane * 2 + 1] as number) ^ high) >>> 0;
    }
    keccakF1600(state);
  }

  // Squeeze 256 bits = the first four 64-bit lanes, little-endian per lane.
  const out = new Uint8Array(32);
  for (let lane = 0; lane < 4; lane += 1) {
    const low = state[lane * 2] as number;
    const high = state[lane * 2 + 1] as number;
    out[lane * 8] = low & 0xff;
    out[lane * 8 + 1] = (low >>> 8) & 0xff;
    out[lane * 8 + 2] = (low >>> 16) & 0xff;
    out[lane * 8 + 3] = (low >>> 24) & 0xff;
    out[lane * 8 + 4] = high & 0xff;
    out[lane * 8 + 5] = (high >>> 8) & 0xff;
    out[lane * 8 + 6] = (high >>> 16) & 0xff;
    out[lane * 8 + 7] = (high >>> 24) & 0xff;
  }
  return out;
}

export function keccak256(input: string | Uint8Array): string {
  return bytesToHex(keccak256Bytes(typeof input === 'string' ? utf8ToBytes(input) : input));
}

/** EIP-55: mixed-case checksum encoding of a 40-hex-char address body. */
export function toEip55Address(address: string): string {
  const body = address.replace(/^0x/i, '').toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(body)) throw new Error('not a 20-byte hex address');
  const hash = keccak256(utf8ToBytes(body));
  let out = '0x';
  for (let i = 0; i < body.length; i += 1) {
    const char = body[i] as string;
    out += parseInt(hash[i] as string, 16) >= 8 ? char.toUpperCase() : char;
  }
  return out;
}

/**
 * Verify an address against EIP-55.
 * Returns `'checksum-valid'` for mixed-case addresses whose casing matches,
 * `'all-lowercase'` / `'all-uppercase'` for unchecksummed input (valid address,
 * no integrity signal) and `'checksum-invalid'` for a genuine typo/corruption.
 */
export function verifyEip55(address: string): 'checksum-valid' | 'checksum-invalid' | 'unchecksummed' {
  const body = address.replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{40}$/.test(body)) return 'checksum-invalid';
  const hasLower = /[a-f]/.test(body);
  const hasUpper = /[A-F]/.test(body);
  if (!hasUpper || !hasLower) return 'unchecksummed';
  return toEip55Address(body) === `0x${body}` ? 'checksum-valid' : 'checksum-invalid';
}

/** 4-byte selector for an EVM function signature, e.g. `transfer(address,uint256)`. */
export function evmFunctionSelector(signature: string): string {
  return `0x${keccak256(utf8ToBytes(signature)).slice(0, 8)}`;
}

/** Well-known selectors used to fingerprint contract interaction traffic. */
export const KNOWN_SELECTORS: Record<string, string> = {
  '0xa9059cbb': 'transfer(address,uint256) — ERC-20 перевод',
  '0x095ea7b3': 'approve(address,uint256) — ERC-20 одобрение',
  '0x23b872dd': 'transferFrom(address,address,uint256)',
  '0x70a08231': 'balanceOf(address)',
  '0x39509351': 'increaseAllowance(address,uint256)',
  '0x2e1a7d4d': 'withdraw(uint256) — WETH unwrap',
  '0xd0e30db0': 'deposit() — WETH wrap',
  '0xa22cb465': 'setApprovalForAll(address,bool)',
  '0x42842e0e': 'safeTransferFrom(address,address,uint256) — NFT',
  '0x6a761202': 'execTransaction(...) — Gnosis Safe',
  '0x8da5cb5b': 'owner()',
};
