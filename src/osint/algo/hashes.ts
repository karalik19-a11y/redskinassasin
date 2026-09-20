/**
 * TOMAHAWK OSINT ENGINE — synchronous hash primitives (MD5 / SHA-1 / SHA-256)
 * ---------------------------------------------------------------------------
 * Implemented in pure ECMAScript so the engine works identically in the
 * browser, Node, Deno, Bun, React Native and edge runtimes — no `node:crypto`,
 * no `SubtleCrypto`, no WASM. Real use-cases inside the engine:
 *   • Gravatar avatar resolution (MD5 of the lower-cased e-mail)
 *   • Bitcoin / TRON Base58Check & Bech32 payload checksums (double SHA-256)
 *   • Pwned-Passwords k-anonymity queries (SHA-1 prefix search)
 *   • Evidence integrity digests (SHA-256) for chain-of-custody reports
 *   • file/artifact fingerprinting for media provenance
 */

const HEX = '0123456789abcdef';

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    const byte = bytes[i] as number;
    out += HEX[(byte >> 4) & 0x0f] as string;
    out += HEX[byte & 0x0f] as string;
  }
  return out;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/i, '').replace(/[^0-9a-fA-F]/g, '');
  const out = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

export function utf8ToBytes(input: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(input);
  const escaped = unescape(encodeURIComponent(input));
  const out = new Uint8Array(escaped.length);
  for (let i = 0; i < escaped.length; i += 1) out[i] = escaped.charCodeAt(i);
  return out;
}

export function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// MD5 (RFC 1321)
// ─────────────────────────────────────────────────────────────────────────────

const MD5_S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16,
  23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

const MD5_K = new Uint32Array(64);
for (let i = 0; i < 64; i += 1) MD5_K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296);

export function md5Bytes(input: Uint8Array): Uint8Array {
  const originalLength = input.length;
  const withPadding = ((originalLength + 8) >> 6) + 1;
  const buffer = new Uint8Array(withPadding * 64);
  buffer.set(input);
  buffer[originalLength] = 0x80;
  const bitLength = originalLength * 8;
  const view = new DataView(buffer.buffer);
  view.setUint32(buffer.length - 8, bitLength >>> 0, true);
  view.setUint32(buffer.length - 4, Math.floor(bitLength / 4294967296), true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const M = new Uint32Array(16);
  for (let chunk = 0; chunk < buffer.length; chunk += 64) {
    for (let i = 0; i < 16; i += 1) M[i] = view.getUint32(chunk + i * 4, true);
    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;
    for (let i = 0; i < 64; i += 1) {
      let F: number;
      let g: number;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      F = (F + A + (MD5_K[i] as number) + (M[g] as number)) >>> 0;
      A = D;
      D = C;
      C = B;
      const shift = MD5_S[i] as number;
      B = (B + ((F << shift) | (F >>> (32 - shift)))) >>> 0;
    }
    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const out = new Uint8Array(16);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, a0, true);
  outView.setUint32(4, b0, true);
  outView.setUint32(8, c0, true);
  outView.setUint32(12, d0, true);
  return out;
}

export function md5(input: string | Uint8Array): string {
  return bytesToHex(md5Bytes(typeof input === 'string' ? utf8ToBytes(input) : input));
}

// ─────────────────────────────────────────────────────────────────────────────
// SHA-1 (RFC 3174) — required by the Pwned-Passwords k-anonymity protocol
// ─────────────────────────────────────────────────────────────────────────────

export function sha1Bytes(input: Uint8Array): Uint8Array {
  const originalLength = input.length;
  const padded = ((originalLength + 8) >> 6) + 1;
  const buffer = new Uint8Array(padded * 64);
  buffer.set(input);
  buffer[originalLength] = 0x80;
  const bitLength = originalLength * 8;
  const view = new DataView(buffer.buffer);
  view.setUint32(buffer.length - 8, Math.floor(bitLength / 4294967296));
  view.setUint32(buffer.length - 4, bitLength >>> 0);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);

  for (let chunk = 0; chunk < buffer.length; chunk += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(chunk + i * 4);
    for (let i = 16; i < 80; i += 1) {
      const value = (w[i - 3] as number) ^ (w[i - 8] as number) ^ (w[i - 14] as number) ^ (w[i - 16] as number);
      w[i] = ((value << 1) | (value >>> 31)) >>> 0;
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let i = 0; i < 80; i += 1) {
      let f: number;
      let k: number;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const temp = (((a << 5) | (a >>> 27)) + f + e + k + (w[i] as number)) >>> 0;
      e = d;
      d = c;
      c = ((b << 30) | (b >>> 2)) >>> 0;
      b = a;
      a = temp;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  const out = new Uint8Array(20);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, h0);
  outView.setUint32(4, h1);
  outView.setUint32(8, h2);
  outView.setUint32(12, h3);
  outView.setUint32(16, h4);
  return out;
}

export function sha1(input: string | Uint8Array): string {
  return bytesToHex(sha1Bytes(typeof input === 'string' ? utf8ToBytes(input) : input));
}

// ─────────────────────────────────────────────────────────────────────────────
// SHA-256 (FIPS 180-4)
// ─────────────────────────────────────────────────────────────────────────────

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
  0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
  0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export function sha256Bytes(input: Uint8Array): Uint8Array {
  const originalLength = input.length;
  const padded = ((originalLength + 8) >> 6) + 1;
  const buffer = new Uint8Array(padded * 64);
  buffer.set(input);
  buffer[originalLength] = 0x80;
  const bitLength = originalLength * 8;
  const view = new DataView(buffer.buffer);
  view.setUint32(buffer.length - 8, Math.floor(bitLength / 4294967296));
  view.setUint32(buffer.length - 4, bitLength >>> 0);

  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);

  for (let chunk = 0; chunk < buffer.length; chunk += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(chunk + i * 4);
    for (let i = 16; i < 64; i += 1) {
      const w15 = w[i - 15] as number;
      const w2 = w[i - 2] as number;
      const s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
      const s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
      w[i] = ((w[i - 16] as number) + s0 + (w[i - 7] as number) + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = [h[0] as number, h[1] as number, h[2] as number, h[3] as number, h[4] as number, h[5] as number, h[6] as number, h[7] as number];
    for (let i = 0; i < 64; i += 1) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + S1 + ch + (SHA256_K[i] as number) + (w[i] as number)) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h[0] = (h[0] as number) + a;
    h[1] = (h[1] as number) + b;
    h[2] = (h[2] as number) + c;
    h[3] = (h[3] as number) + d;
    h[4] = (h[4] as number) + e;
    h[5] = (h[5] as number) + f;
    h[6] = (h[6] as number) + g;
    h[7] = (h[7] as number) + hh;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 8; i += 1) outView.setUint32(i * 4, h[i] as number);
  return out;
}

export function sha256(input: string | Uint8Array): string {
  return bytesToHex(sha256Bytes(typeof input === 'string' ? utf8ToBytes(input) : input));
}

export function doubleSha256Bytes(input: Uint8Array): Uint8Array {
  return sha256Bytes(sha256Bytes(input));
}

/** WebCrypto-backed SHA-256 when available (hardware accelerated). */
export async function sha256Async(input: string | Uint8Array): Promise<string> {
  const data = typeof input === 'string' ? utf8ToBytes(input) : input;
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    try {
      const digest = await subtle.digest('SHA-256', data as unknown as ArrayBuffer);
      return bytesToHex(new Uint8Array(digest));
    } catch {
      /* fall through */
    }
  }
  return bytesToHex(sha256Bytes(data));
}
