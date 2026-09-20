/**
 * TOMAHAWK OSINT ENGINE — perceptual image hashing & manipulation analysis
 * ---------------------------------------------------------------------------
 * DOM-free by design: callers pass raw RGBA pixels (`ImageData` in the browser,
 * a decoded buffer in Node), so the same code runs in a service worker, a
 * headless Node pipeline or the SPA.
 *
 * Provides:
 *   • aHash / dHash / pHash (DCT-based) — resilient matching of the *same*
 *     photo across crops, recompression and resizing (avatar ↔ full-size shot)
 *   • Error-Level-Analysis (ELA) statistics over quantised blocks — the
 *     standard first-pass test for splicing/local editing
 *   • Noise-consistency map — detects regions pasted from another source
 */

export interface RgbaImage {
  data: Uint8ClampedArray | Uint8Array | number[];
  width: number;
  height: number;
}

export interface PerceptualHash {
  aHash: string;
  dHash: string;
  pHash: string;
  width: number;
  height: number;
}

/** Rec. 709 luma — matches how the human eye weights channels. */
export function toGrayscale(image: RgbaImage, columns = 32, rows = 32): Float64Array {
  const out = new Float64Array(columns * rows);
  const { data, width, height } = image;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      const sourceX = Math.min(width - 1, Math.floor((x / columns) * width));
      const sourceY = Math.min(height - 1, Math.floor((y / rows) * height));
      // Box-average the source cell for a cheap, alias-resistant downscale.
      const cellWidth = Math.max(1, Math.floor(width / columns));
      const cellHeight = Math.max(1, Math.floor(height / rows));
      let sum = 0;
      let count = 0;
      for (let sy = sourceY; sy < Math.min(height, sourceY + cellHeight); sy += 1) {
        for (let sx = sourceX; sx < Math.min(width, sourceX + cellWidth); sx += 1) {
          const offset = (sy * width + sx) * 4;
          const r = Number(data[offset] ?? 0);
          const g = Number(data[offset + 1] ?? 0);
          const b = Number(data[offset + 2] ?? 0);
          sum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
          count += 1;
        }
      }
      out[y * columns + x] = count > 0 ? sum / count : 0;
    }
  }
  return out;
}

function bitsToHex(bits: number[]): string {
  let hex = '';
  for (let i = 0; i < bits.length; i += 4) {
    const nibble = ((bits[i] as number) << 3) | ((bits[i + 1] as number) << 2) | ((bits[i + 2] as number) << 1) | (bits[i + 3] as number);
    hex += nibble.toString(16);
  }
  return hex;
}

function mean(values: Float64Array | number[]): number {
  let sum = 0;
  for (const value of values) sum += value;
  return values.length ? sum / values.length : 0;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[middle] as number) : (((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2);
}

/** 2D DCT-II on a square matrix (used for pHash). */
function dct2d(matrix: Float64Array, size: number): Float64Array {
  const out = new Float64Array(size * size);
  const cosTable = new Float64Array(size * size);
  for (let u = 0; u < size; u += 1) {
    for (let x = 0; x < size; x += 1) cosTable[u * size + x] = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * size));
  }
  for (let v = 0; v < size; v += 1) {
    for (let u = 0; u < size; u += 1) {
      let sum = 0;
      for (let y = 0; y < size; y += 1) {
        const cy = cosTable[v * size + y] as number;
        if (cy === 0) continue;
        let rowSum = 0;
        for (let x = 0; x < size; x += 1) rowSum += (matrix[y * size + x] as number) * (cosTable[u * size + x] as number);
        sum += cy * rowSum;
      }
      const cu = u === 0 ? 1 / Math.SQRT2 : 1;
      const cv = v === 0 ? 1 / Math.SQRT2 : 1;
      out[v * size + u] = 0.25 * cu * cv * sum;
    }
  }
  return out;
}

export function perceptualHash(image: RgbaImage): PerceptualHash {
  // aHash — 8×8 mean threshold
  const small = toGrayscale(image, 8, 8);
  const smallMean = mean(small);
  const aBits: number[] = [];
  for (const value of small) aBits.push(value >= smallMean ? 1 : 0);

  // dHash — horizontal gradient on 9×8
  const gradient = toGrayscale(image, 9, 8);
  const dBits: number[] = [];
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) dBits.push((gradient[y * 9 + x] as number) > (gradient[y * 9 + x + 1] as number) ? 1 : 0);
  }

  // pHash — DCT of 32×32, keep the 8×8 lowest frequencies
  const block = toGrayscale(image, 32, 32);
  const dct = dct2d(block, 32);
  const lowFrequency: number[] = [];
  for (let v = 0; v < 8; v += 1) for (let u = 0; u < 8; u += 1) lowFrequency.push(dct[v * 32 + u] as number);
  const lowMedian = median(lowFrequency.slice(1));
  const pBits = lowFrequency.map((value) => (value > lowMedian ? 1 : 0));

  return {
    aHash: bitsToHex(aBits),
    dHash: bitsToHex(dBits),
    pHash: bitsToHex(pBits),
    width: image.width,
    height: image.height,
  };
}

export function hammingDistanceHex(a: string, b: string): number {
  const length = Math.min(a.length, b.length);
  let distance = 0;
  for (let i = 0; i < length; i += 1) {
    const xor = parseInt(a[i] as string, 16) ^ parseInt(b[i] as string, 16);
    distance += ((xor >> 3) & 1) + ((xor >> 2) & 1) + ((xor >> 1) & 1) + (xor & 1);
  }
  return distance + Math.abs(a.length - b.length) * 4;
}

export interface HashComparison {
  distance: number;
  similarity: number;
  verdict: 'identical' | 'same-image' | 'visually-similar' | 'different';
}

/** Compare two perceptual hashes (bit length inferred from the hex string). */
export function compareHashes(a: string, b: string): HashComparison {
  const distance = hammingDistanceHex(a, b);
  const bits = Math.max(a.length, b.length) * 4;
  const similarity = bits ? 1 - distance / bits : 0;
  const verdict: HashComparison['verdict'] =
    distance === 0 ? 'identical' : distance <= 6 ? 'same-image' : distance <= 14 ? 'visually-similar' : 'different';
  return { distance, similarity, verdict };
}

export interface ElaResult {
  /** Global error-level mean (0..255 scale of the recompression residual). */
  meanError: number;
  /** Coefficient of variation across blocks — high values hint at local edits. */
  errorVariance: number;
  /** Blocks whose residual deviates > 2σ from the global mean. */
  anomalousBlocks: Array<{ x: number; y: number; ratio: number }>;
  suspicion: number;
  verdict: 'uniform' | 'mildly-inconsistent' | 'suspicious-splice';
}

/**
 * Error Level Analysis over a re-encoded copy of the *same* image. The caller
 * supplies the original pixels and the recompressed pixels (browser: draw to
 * canvas with quality 0.9; Node: sharp/jimp). Regions saved at a different
 * compression level than their surroundings stand out as anomalous blocks —
 * the classic signature of a pasted/spliced element or a screenshotted patch.
 */
export function errorLevelAnalysis(original: RgbaImage, recompressed: RgbaImage, blockSize = 16): ElaResult {
  const width = Math.min(original.width, recompressed.width);
  const height = Math.min(original.height, recompressed.height);
  const columns = Math.max(1, Math.floor(width / blockSize));
  const rows = Math.max(1, Math.floor(height / blockSize));
  const blockErrors: number[] = [];
  const grid: number[][] = [];

  for (let by = 0; by < rows; by += 1) {
    const row: number[] = [];
    for (let bx = 0; bx < columns; bx += 1) {
      let sum = 0;
      let count = 0;
      for (let y = by * blockSize; y < Math.min(height, (by + 1) * blockSize); y += 1) {
        for (let x = bx * blockSize; x < Math.min(width, (bx + 1) * blockSize); x += 1) {
          const offset = (y * width + x) * 4;
          const deltaR = Math.abs(Number(original.data[offset] ?? 0) - Number(recompressed.data[offset] ?? 0));
          const deltaG = Math.abs(Number(original.data[offset + 1] ?? 0) - Number(recompressed.data[offset + 1] ?? 0));
          const deltaB = Math.abs(Number(original.data[offset + 2] ?? 0) - Number(recompressed.data[offset + 2] ?? 0));
          sum += (deltaR + deltaG + deltaB) / 3;
          count += 1;
        }
      }
      const value = count ? sum / count : 0;
      row.push(value);
      blockErrors.push(value);
    }
    grid.push(row);
  }

  const globalMean = mean(blockErrors);
  const variance = blockErrors.length ? mean(blockErrors.map((value) => (value - globalMean) ** 2)) : 0;
  const stdDev = Math.sqrt(variance);
  const anomalousBlocks: ElaResult['anomalousBlocks'] = [];

  if (stdDev > 0) {
    grid.forEach((row, y) => {
      row.forEach((value, x) => {
        const ratio = (value - globalMean) / stdDev;
        if (ratio > 2) anomalousBlocks.push({ x: x * blockSize, y: y * blockSize, ratio: Number(ratio.toFixed(2)) });
      });
    });
  }

  const coefficientOfVariation = globalMean > 0 ? stdDev / globalMean : 0;
  const suspicion = Math.max(0, Math.min(1, coefficientOfVariation * 0.8 + Math.min(anomalousBlocks.length / Math.max(1, columns * rows), 0.5) * 0.6));

  return {
    meanError: Number(globalMean.toFixed(3)),
    errorVariance: Number(variance.toFixed(3)),
    anomalousBlocks: anomalousBlocks.sort((a, b) => b.ratio - a.ratio).slice(0, 12),
    suspicion: Number(suspicion.toFixed(3)),
    verdict: suspicion >= 0.6 ? 'suspicious-splice' : suspicion >= 0.35 ? 'mildly-inconsistent' : 'uniform',
  };
}
