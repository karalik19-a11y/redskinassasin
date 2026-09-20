/**
 * TOMAHAWK OSINT ENGINE — geospatial algorithms
 * Geohash (encode/decode/neighbours), Haversine distance, bounding boxes,
 * bearing and a coarse geo-anomaly check ("is this movement physically
 * possible?") used to flag fabricated or spoofed location trails.
 */

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
const BASE32_MAP = new Map<string, number>();
for (let i = 0; i < BASE32.length; i += 1) BASE32_MAP.set(BASE32[i] as string, i);

const NEIGHBOURS: Record<string, { n: string; s: string; e: string; w: string }> = {
  '0': { n: '2', s: 'p', e: '1', w: 'p' },
  '1': { n: '3', s: 'q', e: '4', w: '0' },
  '2': { n: '6', s: '0', e: '3', w: '1' },
  '3': { n: '7', s: '1', e: '5', w: '2' },
  '4': { n: '5', s: 'r', e: 'h', w: '1' },
  '5': { n: '4', s: 's', e: 'j', w: '3' },
  '6': { n: '9', s: '2', e: '7', w: '4' },
  '7': { n: 'd', s: '3', e: 'k', w: '5' },
  '8': { n: 'b', s: 'x', e: '9', w: '7' },
  '9': { n: 'c', s: '6', e: 'd', w: '8' },
  b: { n: 'e', s: '8', e: 'c', w: '9' },
  c: { n: 'f', s: '9', e: 'f', w: 'b' },
  d: { n: 'h', s: '7', e: 'k', w: 'c' },
  e: { n: 'k', s: 'b', e: 'f', w: 'd' },
  f: { n: 'j', s: 'c', e: 'g', w: 'e' },
  g: { n: 'm', s: 'f', e: 'u', w: 'e' },
  h: { n: 'k', s: '4', e: 'm', w: 'd' },
  j: { n: 'm', s: '5', e: 's', w: 'h' },
  k: { n: 'p', s: 'h', e: 't', w: 'j' },
  m: { n: 'q', s: 'g', e: 'u', w: 'k' },
  p: { n: '0', s: 'k', e: 't', w: 'm' },
  q: { n: '1', s: 'm', e: 'u', w: 'p' },
  r: { n: '4', s: 'u', e: 'v', w: 'q' },
  s: { n: '5', s: 'j', e: 'v', w: 'r' },
  t: { n: 'u', s: 'k', e: 'z', w: 's' },
  u: { n: 'v', s: 'q', e: 'z', w: 't' },
  v: { n: 'z', s: 'r', e: 'z', w: 'u' },
  x: { n: '8', s: 'w', e: 'b', w: 'z' },
  z: { n: 't', s: 'v', e: 'z', w: 'x' },
  w: { n: 'x', s: 'z', e: '8', w: 'v' },
};

export function geohashEncode(latitude: number, longitude: number, precision = 9): string {
  let latMin = -90;
  let latMax = 90;
  let lonMin = -180;
  let lonMax = 180;
  let hash = '';
  let bit = 0;
  let charIndex = 0;
  let even = true;

  while (hash.length < precision) {
    if (even) {
      const mid = (lonMin + lonMax) / 2;
      if (longitude >= mid) {
        charIndex = charIndex * 2 + 1;
        lonMin = mid;
      } else {
        charIndex *= 2;
        lonMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (latitude >= mid) {
        charIndex = charIndex * 2 + 1;
        latMin = mid;
      } else {
        charIndex *= 2;
        latMax = mid;
      }
    }
    even = !even;
    if (bit < 4) {
      bit += 1;
    } else {
      hash += BASE32[charIndex] as string;
      bit = 0;
      charIndex = 0;
    }
  }
  return hash;
}

export interface GeohashArea {
  latitude: number;
  longitude: number;
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
  /** Approximate cell size in metres. */
  errorMetres: { lat: number; lon: number };
}

export function geohashDecode(hash: string): GeohashArea | null {
  const clean = hash.trim().toLowerCase();
  if (!clean || [...clean].some((char) => !BASE32_MAP.has(char))) return null;
  let latMin = -90;
  let latMax = 90;
  let lonMin = -180;
  let lonMax = 180;
  let even = true;

  for (const char of clean) {
    const value = BASE32_MAP.get(char) as number;
    for (let bits = 4; bits >= 0; bits -= 1) {
      const bit = (value >> bits) & 1;
      if (even) {
        const mid = (lonMin + lonMax) / 2;
        if (bit === 1) lonMin = mid;
        else lonMax = mid;
      } else {
        const mid = (latMin + latMax) / 2;
        if (bit === 1) latMin = mid;
        else latMax = mid;
      }
      even = !even;
    }
  }

  return {
    latitude: (latMin + latMax) / 2,
    longitude: (lonMin + lonMax) / 2,
    latMin,
    latMax,
    lonMin,
    lonMax,
    errorMetres: { lat: ((latMax - latMin) / 2) * 111_320, lon: ((lonMax - lonMin) / 2) * 111_320 * Math.cos(((latMin + latMax) / 2) * (Math.PI / 180)) },
  };
}

export function geohashNeighbours(hash: string): string[] {
  const last = hash.slice(-1).toLowerCase();
  const prefix = hash.slice(0, -1);
  const table = NEIGHBOURS[last];
  if (!table) return [];
  return [table.n, table.s, table.e, table.w].map((char) => `${prefix}${char}`);
}

/** Great-circle distance in metres. */
export function haversineMetres(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const earthRadius = 6_371_000;
  const toRad = (degrees: number): number => (degrees * Math.PI) / 180;
  const deltaLat = toRad(b.latitude - a.latitude);
  const deltaLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearingDegrees(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const toRad = (degrees: number): number => (degrees * Math.PI) / 180;
  const toDeg = (radians: number): number => (radians * 180) / Math.PI;
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const deltaLon = toRad(b.longitude - a.longitude);
  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export interface MovementFeasibility {
  distanceMetres: number;
  hours: number;
  impliedSpeedKmh: number;
  feasible: boolean;
  vehicle: 'пешком' | 'авто' | 'поезд' | 'авиа' | 'невозможно';
  note: string;
}

/**
 * Physical-plausibility check between two timestamped locations. A movement no
 * vehicle can perform is a strong indicator of spoofed GPS, a shared account or
 * a data timestamp mismatch (timezone bugs are the usual cause).
 */
export function assessMovement(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
  fromTimestamp: number,
  toTimestamp: number,
): MovementFeasibility {
  const distanceMetres = haversineMetres(from, to);
  const hours = Math.abs(toTimestamp - fromTimestamp) / 3_600_000;
  const impliedSpeedKmh = hours > 0 ? distanceMetres / 1000 / hours : distanceMetres > 0 ? Number.POSITIVE_INFINITY : 0;

  const vehicle: MovementFeasibility['vehicle'] =
    impliedSpeedKmh <= 7 ? 'пешком' : impliedSpeedKmh <= 130 ? 'авто' : impliedSpeedKmh <= 350 ? 'поезд' : impliedSpeedKmh <= 950 ? 'авиа' : 'невозможно';

  return {
    distanceMetres,
    hours,
    impliedSpeedKmh,
    feasible: impliedSpeedKmh <= 950,
    vehicle,
    note:
      impliedSpeedKmh > 950
        ? `Имплицитная скорость ${impliedSpeedKmh.toFixed(0)} км/ч физически недостижима — вероятна подмена координат, общий аккаунт или рассинхрон времени`
        : `Перемещение ${(distanceMetres / 1000).toFixed(1)} км за ${hours.toFixed(1)} ч ⇒ ${vehicle} (${impliedSpeedKmh.toFixed(0)} км/ч)`,
  };
}

/** Decimal degrees → DMS string used by Russian registries and court filings. */
export function toDms(value: number, isLatitude: boolean): string {
  const hemisphere = isLatitude ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W';
  const absolute = Math.abs(value);
  const degrees = Math.floor(absolute);
  const minutesFloat = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = ((minutesFloat - minutes) * 60).toFixed(2);
  return `${degrees}°${minutes}'${seconds}"${hemisphere}`;
}
