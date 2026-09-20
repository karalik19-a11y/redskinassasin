/**
 * MODULE: media — image forensics & provenance
 * ---------------------------------------------------------------------------
 * Accepts either raw bytes (attached by the host as `artifacts.imageBytes`) or
 * an image URL. Produces:
 *   • full metadata extraction (EXIF/XMP/IPTC/PNG chunks) with editing-software,
 *     screenshot and metadata-stripping flags
 *   • GPS → location entity with precision, so a photo becomes a geospatial fact
 *   • perceptual hashes (aHash/dHash/pHash) — the key to matching the *same*
 *     photo across platforms even after resizing/recompression
 *   • Error-Level Analysis when the host supplies a recompressed copy
 *   • reverse-search plan (Yandex, Google Lens, TinEye, PimEyes) with the exact
 *     subject URL, plus a Gravatar check for e-mail-derived avatars
 */

import type { ModuleInput, ModuleContext, ModuleResult, OsintModule } from '../types/module';
import { parseImageMetadata, sniffFileType } from '../algo/exif';
import { perceptualHash, errorLevelAnalysis, compareHashes, type RgbaImage } from '../algo/phash';
import { md5 } from '../algo/hashes';
import { evidence, entity, edge, pivot, risk, truncate, DIRECTORY_LINKS } from './common';

const MODULE_ID = 'media.image';

interface MediaArtifacts {
  imageBytes?: Uint8Array | ArrayBuffer | number[];
  imageData?: RgbaImage;
  recompressedData?: RgbaImage;
  knownHashes?: Record<string, string>;
}

function toBytes(input: Uint8Array | ArrayBuffer | number[]): Uint8Array {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  return Uint8Array.from(input);
}

export const mediaModule: OsintModule = {
  id: MODULE_ID,
  name: 'Экспертиза изображений (EXIF, ELA, перцептивные хэши)',
  category: 'media',
  description:
    'Извлекает метаданные JPEG/PNG/WebP (камера, объектив, ПО, GPS, история XMP), выявляет признаки редактирования и удаления метаданных, рассчитывает перцептивные хэши (aHash/dHash/pHash) для поиска того же фото на других платформах, выполняет Error Level Analysis при наличии пережатой копии и формирует план обратного поиска.',
  accepts: ['image', 'url', 'social_profile', 'email', 'document'],
  produces: ['location', 'image', 'service', 'person'],
  requiresNetwork: true,
  cost: 2,
  priority: 70,
  cacheTtlMs: 30 * 60_000,
  tags: ['media', 'forensics', 'exif', 'phash'],
  dataSources: ['Локальный парсер EXIF/XMP/IPTC', 'Яндекс.Картинки / Google Lens / TinEye (ссылки)', 'Gravatar'],
  async run(input: ModuleInput, ctx: ModuleContext): Promise<ModuleResult> {
    const artifacts = (input.artifacts ?? {}) as MediaArtifacts;
    const out: ModuleResult = { evidence: [], entities: [], edges: [], riskFactors: [], pivots: [], notes: [] };
    let bytes: Uint8Array | undefined = artifacts.imageBytes ? toBytes(artifacts.imageBytes) : undefined;
    let sourceUrl: string | undefined;

    if (!bytes && /^https?:\/\//i.test(input.entity.value)) {
      sourceUrl = input.entity.value;
      try {
        const response = await ctx.http.text(sourceUrl, { timeoutMs: 15_000, cacheTtlMs: 60 * 60_000, signal: ctx.signal });
        bytes = Uint8Array.from([...response].map((char) => char.charCodeAt(0) & 0xff));
        out.notes?.push('Изображение получено как текст: бинарные данные могли быть повреждены транспортом (используйте artifacts.imageBytes для точного анализа)');
      } catch (error) {
        out.notes?.push(`Не удалось загрузить изображение: ${(error as Error).message.slice(0, 140)}`);
      }
    }

    if (!bytes && !artifacts.imageData) {
      out.notes?.push('Изображение не передано: для анализа метаданных прикрепите файл (artifacts.imageBytes) или укажите прямой URL');
      if (sourceUrl) {
        out.evidence?.push(evidence('image.reverse-search', 'План обратного поиска изображения', { yandex: DIRECTORY_LINKS.yandexImages(sourceUrl), googleLens: DIRECTORY_LINKS.googleLens(sourceUrl), tineye: DIRECTORY_LINKS.tineye(sourceUrl), pimeyes: DIRECTORY_LINKS.pimeyes() }, { name: 'Генерация плана поиска (локально)', kind: 'algorithm' }, { reliability: 0.9, tags: ['plan'] }));
      }
      return out;
    }

    // ── Metadata ────────────────────────────────────────────────────────────
    if (bytes) {
      const sniff = sniffFileType(bytes);
      const metadata = parseImageMetadata(bytes);
      const source = { name: 'Локальный парсер метаданных TOMAHAWK', kind: 'algorithm' as const };

      out.evidence?.push(
        evidence('image.format', `Формат по сигнатуре файла: ${sniff.type} (${sniff.mime}), размер ${bytes.length} байт`, { type: sniff.type, bytes: bytes.length }, source, { reliability: 0.98, tags: ['format'] }),
        evidence('image.file-md5', `MD5 файла (для точного сопоставления с базами): ${md5(bytes)}`, md5(bytes), source, { reliability: 0.99, tags: ['hash'] }),
      );

      if (metadata.make || metadata.model) {
        out.evidence?.push(
          evidence('image.camera', `Устройство съёмки: ${metadata.make ?? ''} ${metadata.model ?? ''}`.trim(), { make: metadata.make, model: metadata.model, lens: metadata.lens }, source, { reliability: 0.92, tags: ['camera', 'attribution'] }),
        );
      }
      if (metadata.dateTimeOriginal || metadata.dateTime) {
        out.evidence?.push(evidence('image.datetime', `Дата съёмки: ${metadata.dateTimeOriginal ?? metadata.dateTime}`, metadata.dateTimeOriginal ?? metadata.dateTime, source, { reliability: 0.85, tags: ['timeline'] }));
      }
      if (metadata.iso || metadata.fNumber || metadata.exposureTime || metadata.focalLength) {
        out.evidence?.push(evidence('image.exposure', `Параметры съёмки: ISO ${metadata.iso ?? '—'}, f/${metadata.fNumber ?? '—'}, ${metadata.exposureTime ?? '—'}, ${metadata.focalLength ?? '—'}`, { iso: metadata.iso, fNumber: metadata.fNumber, exposure: metadata.exposureTime, focal: metadata.focalLength }, source, { reliability: 0.9, tags: ['camera'] }));
      }
      if (metadata.software) {
        out.evidence?.push(evidence('image.software', `ПО, записавшее файл: ${metadata.software}`, metadata.software, source, { reliability: 0.9, tags: ['forensics'] }));
      }
      if (metadata.editingSoftware.length) {
        out.evidence?.push(evidence('image.editing-tools', `Обнаружены следы обработки: ${metadata.editingSoftware.join('; ')}`, metadata.editingSoftware, source, { reliability: 0.88, tags: ['forensics', 'manipulation'] }));
        out.riskFactors?.push(risk('opsec.identity-mismatch', 0.3, `Изображение редактировалось (${truncate(metadata.editingSoftware.join(', '), 80)}) — метаданные не отражают оригинальный снимок`, [], { label: 'Изображение редактировалось' }));
      }
      if (metadata.hasXmp || metadata.hasIptc) {
        out.evidence?.push(evidence('image.xmp', `XMP: ${metadata.hasXmp ? 'присутствует' : 'нет'}${metadata.xmpToolkit ? ` (${truncate(metadata.xmpToolkit, 120)})` : ''}; IPTC: ${metadata.hasIptc ? 'присутствует' : 'нет'}`, { xmp: metadata.hasXmp, iptc: metadata.hasIptc, toolkit: metadata.xmpToolkit }, source, { reliability: 0.85, tags: ['forensics'] }));
      }
      if (Object.keys(metadata.pngTextChunks).length) {
        out.evidence?.push(evidence('image.png-text', `Текстовые блоки PNG: ${truncate(JSON.stringify(metadata.pngTextChunks), 300)}`, metadata.pngTextChunks, source, { reliability: 0.85, tags: ['png'] }));
      }
      if (metadata.thumbnail?.present) {
        out.evidence?.push(evidence('image.thumbnail', `Встроенный превью-кадр присутствует (${metadata.thumbnail.bytes ?? '?'} байт) — может содержать исходную версию изображения до редактирования`, metadata.thumbnail, source, { reliability: 0.8, tags: ['forensics'] }));
      }
      for (const note of metadata.flags.notes) {
        out.evidence?.push(evidence('image.flag', note, note, source, { reliability: 0.8, tags: ['caveat'] }));
      }
      if (metadata.flags.metadataStripped) {
        out.riskFactors?.push(risk('opsec.identity-mismatch', 0.25, 'Метаданные камеры отсутствуют (снимок прошёл мессенджер/соцсеть или был вычищен) — атрибуция по EXIF невозможна', []));
      }

      // GPS → geospatial fact
      if (metadata.gps) {
        const { latitude, longitude, altitude } = metadata.gps;
        out.evidence?.push(
          evidence('image.gps', `GPS-метаданные: ${latitude}, ${longitude}${altitude ? `, высота ${altitude} м` : ''} (точность ~${metadata.gps.precision === 3 ? '10–30' : '1000+'} м)`, metadata.gps, source, { reliability: 0.9, tags: ['geo', 'geolocation'] }),
        );
        out.entities?.push(
          entity('location', `${latitude.toFixed(6)},${longitude.toFixed(6)}`, {
            label: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
            tags: ['exif-gps', 'precise'],
            confidence: 0.9,
            properties: { latitude, longitude, altitude, source: 'EXIF GPS', timestamp: metadata.gps.timestamp },
          }),
        );
        out.edges?.push(edge(input.entity.id, { type: 'location', value: `${latitude.toFixed(6)},${longitude.toFixed(6)}` }, 'located_at', 0.9, 0.9));
        out.pivots?.push(pivot('location', `${latitude.toFixed(6)},${longitude.toFixed(6)}`, { relation: 'located_at', confidence: 0.9, reason: 'Координаты из EXIF — точная геопривязка снимка', from: input.entity.id }));
        out.riskFactors?.push(risk('opsec.precise-geolocation', 0.75, `Изображение содержит GPS-координаты (${latitude.toFixed(4)}, ${longitude.toFixed(4)}) — раскрывается точное место съёмки`, [], { tags: ['geolocation'] }));
      }
    }

    // ── Perceptual hashing ──────────────────────────────────────────────────
    if (artifacts.imageData) {
      const hashes = perceptualHash(artifacts.imageData);
      out.evidence?.push(
        evidence('image.phash', `Перцептивные хэши (устойчивы к пережатию/масштабированию): pHash ${hashes.pHash}, dHash ${hashes.dHash}, aHash ${hashes.aHash}`, { ...hashes }, { name: 'pHash / dHash / aHash (DCT, локально)', kind: 'algorithm' }, { reliability: 0.92, tags: ['phash', 'matching'] }),
      );
      out.entities?.push(
        entity('image', hashes.pHash, {
          label: `Изображение ${hashes.width}×${hashes.height} (pHash ${hashes.pHash})`,
          tags: ['perceptual-hash'],
          confidence: 0.9,
          properties: { pHash: hashes.pHash, dHash: hashes.dHash, aHash: hashes.aHash, width: hashes.width, height: hashes.height, avatarHash: hashes.pHash },
        }),
      );

      for (const [name, reference] of Object.entries(artifacts.knownHashes ?? {})) {
        const comparison = compareHashes(hashes.pHash, reference);
        if (comparison.verdict === 'different') continue;
        out.evidence?.push(
          evidence(
            'image.match',
            `Совпадение с изображением «${name}»: расстояние Хэмминга ${comparison.distance} (${comparison.verdict}, схожесть ${(comparison.similarity * 100).toFixed(1)}%)`,
            { with: name, ...comparison },
            { name: 'Сравнение перцептивных хэшей (локально)', kind: 'algorithm' },
            { reliability: comparison.verdict === 'identical' ? 0.97 : 0.85, tags: ['matching', 'identity-cluster'] },
          ),
        );
        out.pivots?.push(pivot('image', reference, { relation: 'same_as', confidence: 0.85, reason: `То же изображение, что и «${name}» — связывает аккаунты/страницы`, from: input.entity.id }));
      }

      if (artifacts.recompressedData) {
        const ela = errorLevelAnalysis(artifacts.imageData, artifacts.recompressedData);
        out.evidence?.push(
          evidence(
            'image.ela',
            `Error Level Analysis: средний уровень ошибки ${ela.meanError}, вариативность ${ela.errorVariance}, аномальных блоков ${ela.anomalousBlocks.length} — вердикт «${ela.verdict}» (подозрительность ${(ela.suspicion * 100).toFixed(0)}%)`,
            ela,
            { name: 'ELA (анализ уровня ошибок JPEG, локально)', kind: 'algorithm' },
            { reliability: 0.7, tags: ['forensics', 'manipulation', 'heuristic'] },
          ),
        );
        if (ela.verdict === 'suspicious-splice') {
          out.riskFactors?.push(risk('opsec.identity-mismatch', 0.45, `ELA выявил ${ela.anomalousBlocks.length} аномальных блоков — вероятен монтаж или вставка фрагмента из другого изображения`, [], { label: 'Признаки фотомонтажа (ELA)' }));
        }
      } else {
        out.notes?.push('Для Error Level Analysis требуется пережатая копия изображения (artifacts.recompressedData)');
      }
    }

    // ── Reverse search & Gravatar ───────────────────────────────────────────
    if (sourceUrl) {
      out.evidence?.push(
        evidence('image.reverse-search', 'План обратного поиска: Яндекс.Картинки, Google Lens, TinEye, PimEyes (биометрия)', { yandex: DIRECTORY_LINKS.yandexImages(sourceUrl), googleLens: DIRECTORY_LINKS.googleLens(sourceUrl), tineye: DIRECTORY_LINKS.tineye(sourceUrl), pimeyes: DIRECTORY_LINKS.pimeyes() }, { name: 'Публичные сервисы обратного поиска', kind: 'web' }, { reliability: 0.85, tags: ['plan', 'reverse-search'] }),
      );
    }

    if (input.entity.type === 'email') {
      const email = input.entity.value.toLowerCase().trim();
      const hash = md5(email);
      const gravatarUrl = `https://www.gravatar.com/avatar/${hash}?d=404&s=400`;
      try {
        const probe = await ctx.http.probe(gravatarUrl, { timeoutMs: 8_000, cacheTtlMs: 60 * 60_000, signal: ctx.signal, expect: 'any' });
        const exists = probe.status === 200;
        out.evidence?.push(
          evidence('image.gravatar', exists ? `Gravatar для адреса существует: ${gravatarUrl} — раскрывает публичный профиль и аватар` : 'Gravatar для этого адреса не зарегистрирован', { url: gravatarUrl, md5: hash, exists }, { name: 'Gravatar API (MD5 адреса)', kind: 'api', url: 'https://gravatar.com' }, { reliability: 0.9, tags: ['avatar', 'osint-technique'] }),
        );
        if (exists) {
          out.entities?.push(entity('image', gravatarUrl, { label: `Gravatar ${email}`, tags: ['avatar', 'gravatar'], confidence: 0.85, properties: { gravatarHash: hash } }));
          out.pivots?.push(pivot('url', gravatarUrl, { relation: 'uses', confidence: 0.8, reason: 'Gravatar-аватар: сравнить перцептивный хэш с аватарами из социальных сетей', from: input.entity.id }));
        }
      } catch (error) {
        out.notes?.push(`Gravatar недоступен: ${(error as Error).message.slice(0, 120)}`);
      }
    }

    return out;
  },
};

export const mediaModules = [mediaModule];
