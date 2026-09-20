/**
 * MODULE: geo — geospatial intelligence
 * ---------------------------------------------------------------------------
 *   • reverse geocoding via OpenStreetMap Nominatim (structured address, admin
 *     hierarchy, country code, timezone where provided)
 *   • geohash encoding + neighbours so a coarse geohash from EXIF/social media
 *     can be searched as an area
 *   • timezone estimation from longitude (explicitly labelled as an estimate:
 *     Russia alone spans 11 zones with no reliable longitude↔zone bijection)
 *   • distance/bearing between all known locations of the subject, plus a
 *     **physical feasibility check** — a movement no vehicle can perform is a
 *     strong indicator of spoofed GPS or a shared account
 *   • ready-to-use mapping links (Яндекс, Google, OSM, Wikimapia, what3words)
 */

import type { ModuleInput, ModuleContext, ModuleResult, OsintModule } from '../types/module';
import { geohashEncode, geohashDecode, geohashNeighbours, haversineMetres, bearingDegrees, assessMovement, toDms } from '../algo/geospatial';
import { parseLooseDate } from '../core/analytics';
import { evidence, entity, pivot, risk, truncate } from './common';

const MODULE_ID = 'geospatial.location';

interface NominatimReverse {
  display_name?: string;
  name?: string;
  address?: Record<string, string>;
  lat?: string;
  lon?: string;
  licence?: string;
}

const TIMEZONE_LONGITUDE_ZONES: Array<{ min: number; max: number; offset: number; label: string }> = [
  { min: -180, max: -165, offset: -11, label: 'UTC-11' },
  { min: -165, max: -150, offset: -10, label: 'UTC-10' },
  { min: -150, max: -135, offset: -9, label: 'UTC-9' },
  { min: -135, max: -120, offset: -8, label: 'UTC-8' },
  { min: -120, max: -105, offset: -7, label: 'UTC-7' },
  { min: -105, max: -90, offset: -6, label: 'UTC-6' },
  { min: -90, max: -75, offset: -5, label: 'UTC-5' },
  { min: -75, max: -60, offset: -4, label: 'UTC-4' },
  { min: -60, max: -45, offset: -3, label: 'UTC-3' },
  { min: -45, max: -30, offset: -2, label: 'UTC-2' },
  { min: -30, max: -15, offset: -1, label: 'UTC-1' },
  { min: -15, max: 15, offset: 0, label: 'UTC+0' },
  { min: 15, max: 30, offset: 1, label: 'UTC+1' },
  { min: 30, max: 45, offset: 2, label: 'UTC+2' },
  { min: 45, max: 60, offset: 3, label: 'UTC+3 (МСК)' },
  { min: 60, max: 75, offset: 4, label: 'UTC+4' },
  { min: 75, max: 90, offset: 5, label: 'UTC+5' },
  { min: 90, max: 105, offset: 6, label: 'UTC+6' },
  { min: 105, max: 120, offset: 7, label: 'UTC+7' },
  { min: 120, max: 135, offset: 8, label: 'UTC+8' },
  { min: 135, max: 150, offset: 9, label: 'UTC+9' },
  { min: 150, max: 165, offset: 10, label: 'UTC+10' },
  { min: 165, max: 180, offset: 11, label: 'UTC+11' },
];

export function estimateTimezone(longitude: number): { offset: number; label: string; celsiusOfAccuracy: string } {
  const zone = TIMEZONE_LONGITUDE_ZONES.find((entry) => longitude >= entry.min && longitude < entry.max);
  return {
    offset: zone?.offset ?? 0,
    label: zone?.label ?? 'UTC+0',
    celsiusOfAccuracy: 'Оценка по долготе: реальный часовой пояс определяется политическими границами и может отличаться на 1–3 часа',
  };
}

function mappingLinks(latitude: number, longitude: number, label?: string): Record<string, string> {
  const query = encodeURIComponent(`${latitude},${longitude}`);
  return {
    yandex: `https://yandex.ru/maps/?pt=${longitude},${latitude}&z=17&l=map`,
    google: `https://www.google.com/maps/search/?api=1&query=${query}`,
    openstreetmap: `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`,
    wikimapia: `http://wikimapia.org/#lat=${latitude}&lon=${longitude}&z=15`,
    what3words: `https://map.what3words.com/${query}`,
    sunrise: `https://www.suncalc.org/#/${latitude},${longitude},16,${new Date().toISOString().slice(11, 16)},${new Date().toISOString().slice(0, 2)}/1/3`,
    panorama: `https://yandex.ru/maps/?panorama%5Bpoint%5D=${longitude}%2C${latitude}&panorama%5Bdirection%5D=0&panorama%5Bfull%5D=true${label ? `&text=${encodeURIComponent(label)}` : ''}`,
  };
}

export const geoModule: OsintModule = {
  id: MODULE_ID,
  name: 'Геопространственный анализ (геокодирование, перемещения, геохэши)',
  category: 'geospatial',
  description:
    'Обратное геокодирование через OSM Nominatim, построение геохэшей и соседних ячеек, оценка часового пояса, расчёт расстояний и азимутов между всеми локациями субъекта, проверка физической реализуемости перемещений (признак подмены GPS) и генерация картографических ссылок.',
  accepts: ['location', 'image', 'social_profile', 'person'],
  produces: ['location', 'event'],
  requiresNetwork: true,
  cost: 2,
  priority: 65,
  cacheTtlMs: 24 * 60 * 60_000,
  tags: ['geo', 'geocoding', 'movement-analysis'],
  dataSources: ['OpenStreetMap Nominatim', 'Локальные геоалгоритмы (геохэш, Haversine)'],
  async run(input: ModuleInput, ctx: ModuleContext): Promise<ModuleResult> {
    const out: ModuleResult = { evidence: [], entities: [], edges: [], riskFactors: [], pivots: [], notes: [] };

    // ── Resolve coordinates from the entity or its properties ──────────────
    let latitude = typeof input.entity.properties.latitude === 'number' ? (input.entity.properties.latitude as number) : undefined;
    let longitude = typeof input.entity.properties.longitude === 'number' ? (input.entity.properties.longitude as number) : undefined;

    if ((latitude === undefined || longitude === undefined) && /^-?\d+\.\d+,-?\d+\.\d+$/.test(input.entity.value)) {
      const [lat, lon] = input.entity.value.split(',').map(Number);
      latitude = lat;
      longitude = lon;
    }
    if ((latitude === undefined || longitude === undefined) && /^[0-9bcfghjkmnpqrstuvwxyz]{4,12}$/i.test(input.entity.value)) {
      const area = geohashDecode(input.entity.value);
      if (area) {
        latitude = area.latitude;
        longitude = area.longitude;
        out.evidence?.push(evidence('geo.geohash-decoded', `Геохэш ${input.entity.value.toUpperCase()} соответствует ячейке с центром ${latitude.toFixed(5)}, ${longitude.toFixed(5)} (точность ~${Math.round(area.errorMetres.lat)} м)`, { lat: latitude, lon: longitude, precisionMetres: Math.round(area.errorMetres.lat) }, { name: 'Декодирование геохэша (локально)', kind: 'algorithm' }, { reliability: 0.95, tags: ['geohash'] }));
      }
    }

    if (latitude === undefined || longitude === undefined) {
      out.notes?.push('Координаты не обнаружены — геопространственный анализ пропущен');
      return out;
    }
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      out.notes?.push(`Координаты вне допустимого диапазона: ${latitude}, ${longitude}`);
      return out;
    }

    const summarySource = { name: 'Локальные геоалгоритмы TOMAHAWK', kind: 'algorithm' as const };
    const geohash = geohashEncode(latitude, longitude, 9);
    const neighbours = geohashNeighbours(geohash);
    const timezone = estimateTimezone(longitude);

    out.evidence?.push(
      evidence('geo.coordinates', `Координаты: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (${toDms(latitude, true)} ${toDms(longitude, false)})`, { latitude, longitude, dms: `${toDms(latitude, true)} ${toDms(longitude, false)}` }, summarySource, { reliability: 0.95, tags: ['geo'] }),
      evidence('geo.geohash', `Геохэш (9 знаков, точность ~5 м): ${geohash}; соседние ячейки: ${neighbours.slice(0, 4).join(', ')}`, { geohash, neighbours }, summarySource, { reliability: 0.95, tags: ['geohash', 'search-pivot'] }),
      evidence('geo.timezone-estimate', `Оценка часового пояса: ${timezone.label} (${timezone.celsiusOfAccuracy})`, timezone, { name: 'Оценка по долготе (эвристика)', kind: 'heuristic' }, { reliability: 0.6, tags: ['timezone', 'estimate'] }),
      evidence('geo.map-links', 'Картографические ссылки: Яндекс, Google, OSM, Wikimapia, what3words, панорамы', mappingLinks(latitude, longitude, input.entity.label), summarySource, { reliability: 0.95, tags: ['pivot-links'] }),
    );

    // ── Reverse geocoding ──────────────────────────────────────────────────
    try {
      const payload = await ctx.http.json<NominatimReverse>(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=ru`,
        { timeoutMs: 15_000, cacheTtlMs: 24 * 60 * 60_000, signal: ctx.signal, headers: { 'user-agent': `${ctx.settings.userAgent} (OSINT research)` } },
      );
      const address = payload.address ?? {};
      const parts = [address.country, address.state ?? address.region, address.city ?? address.town ?? address.village, address.road, address.house_number].filter(Boolean);
      out.evidence?.push(
        evidence('geo.reverse-geocode', `Адрес (OSM): ${(payload.display_name ?? parts.join(', ')) || 'не определён'}`, { displayName: payload.display_name, address: parts, countryCode: address.country_code, postcode: address.postcode }, { name: 'OpenStreetMap Nominatim', kind: 'api', url: 'https://nominatim.openstreetmap.org', license: 'ODbL 1.0' }, { reliability: 0.85, tags: ['geocoding', 'address'] }),
      );
      if (address.country) {
        out.entities?.push(entity('location', payload.display_name ?? parts.join(', '), { label: payload.display_name ?? parts.join(', '), tags: ['address'], confidence: 0.8, properties: { latitude, longitude, ...address } }));
      }
      if (address.country_code && !['ru', 'by', 'kz'].includes(address.country_code) && input.entity.properties.source === 'EXIF GPS') {
        out.riskFactors?.push(risk('opsec.precise-geolocation', 0.8, `Координаты указывают за пределы РФ (${address.country}) — проверьте легитимность пересечения границы и сопоставьте с данными о перелётах`, [], { tags: ['geo'] }));
      }
    } catch (error) {
      out.notes?.push(`Обратное геокодирование недоступно: ${(error as Error).message.slice(0, 140)}`);
    }

    // ── Movement analysis across all known locations ────────────────────────
    const locations = input.related
      .filter((entry) => entry.type === 'location')
      .map((entry) => {
        const timestamp = typeof entry === 'object' && 'timestamp' in entry ? Number((entry as { timestamp?: number }).timestamp ?? NaN) : NaN;
        const match = /^(-?\d+\.\d+),(-?\d+\.\d+)$/.exec(entry.value);
        return match ? { id: entry.id, label: entry.value, latitude: Number(match[1]), longitude: Number(match[2]), timestamp } : undefined;
      })
      .filter((entry): entry is { id: string; label: string; latitude: number; longitude: number; timestamp: number } => Boolean(entry));

    const here = { latitude, longitude };
    if (locations.length) {
      const distances = locations.map((location) => ({
        ...location,
        metres: haversineMetres(here, location),
        bearing: bearingDegrees(here, location),
      }));
      out.evidence?.push(
        evidence(
          'geo.relative-distances',
          `Расстояния от исследуемой точки: ${distances
            .slice()
            .sort((a, b) => a.metres - b.metres)
            .slice(0, 8)
            .map((entry) => `${(entry.metres / 1000).toFixed(2)} км @ ${entry.bearing.toFixed(0)}° (${truncate(entry.label, 24)})`)
            .join('; ')}`,
          distances.map((entry) => ({ label: entry.label, metres: Math.round(entry.metres), bearing: Number(entry.bearing.toFixed(1)) })),
          summarySource,
          { reliability: 0.95, tags: ['distance', 'movement'] },
        ),
      );

      const dated = distances.filter((entry) => Number.isFinite(entry.timestamp));
      for (const entry of dated.slice(0, 6)) {
        const feasibility = assessMovement(here, entry, Date.now(), entry.timestamp);
        if (feasibility.feasible) continue;
        out.evidence?.push(
          evidence('geo.movement-infeasible', `Перемещение в ${truncate(entry.label, 30)} невозможно: ${feasibility.note}`, feasibility, { name: 'Модель физической реализуемости перемещений', kind: 'heuristic' }, { reliability: 0.75, tags: ['anomaly', 'geolocation'] }),
        );
        out.riskFactors?.push(risk('opsec.movement-infeasible', 0.55, `Обнаружено физически невозможное перемещение (${(feasibility.distanceMetres / 1000).toFixed(1)} км за ${feasibility.hours.toFixed(1)} ч) — подмена GPS, общий аккаунт или рассинхрон времени`, []));
      }
    }

    // ── Nearby-area pivots for coarse geohashes ────────────────────────────
    if (input.entity.tags.includes('geohash') || (input.entity.properties.source as string) === 'geohash') {
      out.pivots?.push(pivot('location', neighbours[0] ?? geohash, { relation: 'related_to', confidence: 0.4, reason: 'Соседние ячейки геохэша расширяют зону поиска (границы ячеек не совпадают с адресами)', from: input.entity.id }));
    }

    const timestampFromProperties = typeof input.entity.properties.timestamp === 'string' ? parseLooseDate(input.entity.properties.timestamp) : null;
    if (timestampFromProperties) {
      out.evidence?.push(evidence('geo.temporal-anchor', `Геолокация привязана ко времени: ${new Date(timestampFromProperties.timestamp).toISOString()} (точность: ${timestampFromProperties.precision})`, timestampFromProperties, summarySource, { reliability: 0.85, tags: ['timeline'] }));
    }

    out.metrics = { latitude: Number(latitude.toFixed(6)), longitude: Number(longitude.toFixed(6)), geohash, relatedLocations: locations.length };
    return out;
  },
};

export const geoModules = [geoModule];
export { mappingLinks };
