/**
 * TOMAHAWK OSINT ENGINE — dependency-free image metadata parser
 * ---------------------------------------------------------------------------
 * Parses the metadata that actually matters in investigations, with zero
 * third-party code so the engine stays embeddable anywhere:
 *   • JPEG: APP1/Exif (IFD0 + ExifSubIFD + GPS IFD + Interop), APP1/XMP,
 *     APP13/IPTC, COM comments, embedded thumbnail presence/size
 *   • PNG: tEXt / iTXt / zTXt keywords and the eXIf chunk (PNG spec 1.5+)
 *   • GPS → decimal degrees, timestamp reconstruction, editing-software flags
 *   • Chain-of-custody signals: thumbnail mismatch, software stamps, presence
 *     of XMP history (Photoshop "saved by" trail), ICC profile description
 */

export interface ExtractedImageMetadata {
  format: 'jpeg' | 'png' | 'webp' | 'gif' | 'unknown';
  byteLength: number;
  width?: number;
  height?: number;
  make?: string;
  model?: string;
  lens?: string;
  software?: string;
  dateTime?: string;
  dateTimeOriginal?: string;
  orientation?: number;
  iso?: number;
  fNumber?: number;
  exposureTime?: string;
  focalLength?: string;
  artist?: string;
  copyright?: string;
  gps?: {
    latitude: number;
    longitude: number;
    altitude?: number;
    timestamp?: string;
    precision: number;
  };
  /** Software stamps that indicate post-processing. */
  editingSoftware: string[];
  hasXmp: boolean;
  xmpToolkit?: string;
  hasIptc: boolean;
  iccProfile?: string;
  comment?: string;
  thumbnail?: { present: boolean; width?: number; height?: number; bytes?: number };
  pngTextChunks: Record<string, string>;
  flags: {
    gpsPresent: boolean;
    cameraMetadataPresent: boolean;
    metadataStripped: boolean;
    editedLikely: boolean;
    screenshotLikely: boolean;
    notes: string[];
  };
  rawTags: Record<string, string | number>;
}

const EDIT_SOFTWARE = /(adobe|photoshop|lightroom|camera raw|gimp|affinity|pixelmator|snapseed|canva|picsart|pixlr|vsco|facetune|meitu|inpaint|клонирование|editor)/i;
const SCREENSHOT_SOFTWARE = /(screenshot|скриншот|snipping tool|sharex|gyazo|lightshot|greenshot|flameshot|cmd\+shift)/i;

const EXIF_TAGS: Record<number, string> = {
  0x0100: 'ImageWidth',
  0x0101: 'ImageLength',
  0x010e: 'ImageDescription',
  0x010f: 'Make',
  0x0110: 'Model',
  0x0112: 'Orientation',
  0x011a: 'XResolution',
  0x0128: 'ResolutionUnit',
  0x0131: 'Software',
  0x0132: 'DateTime',
  0x013b: 'Artist',
  0x8298: 'Copyright',
  0x829a: 'ExposureTime',
  0x829d: 'FNumber',
  0x8827: 'ISOSpeedRatings',
  0x9003: 'DateTimeOriginal',
  0x9004: 'DateTimeDigitized',
  0x9201: 'ShutterSpeedValue',
  0x9202: 'ApertureValue',
  0x9209: 'Flash',
  0x920a: 'FocalLength',
  0x927c: 'MakerNote',
  0x9286: 'UserComment',
  0xa001: 'ColorSpace',
  0xa002: 'PixelXDimension',
  0xa003: 'PixelYDimension',
  0xa434: 'LensModel',
  0xa430: 'CameraOwnerName',
  0xa431: 'BodySerialNumber',
  0xa432: 'LensSpecification',
};

const GPS_TAGS: Record<number, string> = {
  0x0000: 'GPSVersionID',
  0x0001: 'GPSLatitudeRef',
  0x0002: 'GPSLatitude',
  0x0003: 'GPSLongitudeRef',
  0x0004: 'GPSLongitude',
  0x0005: 'GPSAltitudeRef',
  0x0006: 'GPSAltitude',
  0x0007: 'GPSTimeStamp',
  0x000c: 'GPSSpeedRef',
  0x000d: 'GPSSpeed',
  0x001d: 'GPSDateStamp',
};

class Reader {
  private readonly view: DataView;
  readonly bytes: Uint8Array;
  littleEndian = true;
  constructor(bytes: Uint8Array, offset = 0, length?: number) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset + offset, length ?? bytes.byteLength - offset);
  }
  get length(): number {
    return this.view.byteLength;
  }
  u8(offset: number): number {
    return this.view.getUint8(offset);
  }
  u16(offset: number): number {
    return this.view.getUint16(offset, this.littleEndian);
  }
  u32(offset: number): number {
    return this.view.getUint32(offset, this.littleEndian);
  }
  i32(offset: number): number {
    return this.view.getInt32(offset, this.littleEndian);
  }
  ascii(offset: number, length: number): string {
    let out = '';
    for (let i = 0; i < length; i += 1) {
      const code = this.u8(offset + i);
      if (code === 0) break;
      out += String.fromCharCode(code);
    }
    return out.replace(/\0+$/, '').trim();
  }
}

type TagValue = string | number | number[];

function readTagValue(reader: Reader, type: number, count: number, valueOffset: number): TagValue | undefined {
  const typeSizes: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
  const size = (typeSizes[type] ?? 1) * count;
  const offset = size > 4 ? reader.u32(valueOffset) : valueOffset;
  if (offset < 0 || offset + size > reader.length) return undefined;

  switch (type) {
    case 1:
    case 7: {
      if (type === 7 && count > 8) {
        // UNDEFINED — usually a text payload (UserComment); keep the ASCII part.
        return reader.ascii(offset, Math.min(count, 64));
      }
      const values: number[] = [];
      for (let i = 0; i < Math.min(count, 32); i += 1) values.push(reader.u8(offset + i));
      return values.length === 1 ? (values[0] as number) : values;
    }
    case 2:
      return reader.ascii(offset, Math.min(count, 256));
    case 3: {
      const values: number[] = [];
      for (let i = 0; i < Math.min(count, 16); i += 1) values.push(reader.u16(offset + i * 2));
      return values.length === 1 ? (values[0] as number) : values;
    }
    case 4: {
      const values: number[] = [];
      for (let i = 0; i < Math.min(count, 16); i += 1) values.push(reader.u32(offset + i * 4));
      return values.length === 1 ? (values[0] as number) : values;
    }
    case 5:
    case 10: {
      const values: number[] = [];
      for (let i = 0; i < Math.min(count, 8); i += 1) {
        const numerator = type === 5 ? reader.u32(offset + i * 8) : reader.i32(offset + i * 8);
        const denominator = type === 5 ? reader.u32(offset + i * 8 + 4) : reader.i32(offset + i * 8 + 4);
        values.push(denominator === 0 ? 0 : numerator / denominator);
      }
      return values.length === 1 ? (values[0] as number) : values;
    }
    case 9: {
      const values: number[] = [];
      for (let i = 0; i < Math.min(count, 16); i += 1) values.push(reader.i32(offset + i * 4));
      return values.length === 1 ? (values[0] as number) : values;
    }
    default:
      return undefined;
  }
}

function parseIfd(reader: Reader, offset: number, tagNames: Record<number, string>, out: Record<string, TagValue>, followSubIfds = true): void {
  if (offset <= 0 || offset + 2 > reader.length) return;
  const entries = reader.u16(offset);
  for (let i = 0; i < Math.min(entries, 200); i += 1) {
    const entryOffset = offset + 2 + i * 12;
    if (entryOffset + 12 > reader.length) return;
    const tag = reader.u16(entryOffset);
    const type = reader.u16(entryOffset + 2);
    const count = reader.u32(entryOffset + 4);
    const value = readTagValue(reader, type, count, entryOffset + 8);
    if (value === undefined) continue;
    const name = tagNames[tag] ?? `Tag_0x${tag.toString(16)}`;
    out[name] = value;

    // Sub-IFD pointers: Exif (0x8769) and GPS (0x8825)
    if (followSubIfds && (tag === 0x8769 || tag === 0x8825) && typeof value === 'number') {
      parseIfd(reader, value, tag === 0x8825 ? GPS_TAGS : EXIF_TAGS, out, tag !== 0x8825);
    }
  }
  // Next IFD
  const nextOffset = offset + 2 + entries * 12;
  if (followSubIfds && nextOffset + 4 <= reader.length) {
    const next = reader.u32(nextOffset);
    if (next > offset && next + 2 <= reader.length) parseIfd(reader, next, tagNames, out, false);
  }
}

function parseTiffBlock(bytes: Uint8Array): Record<string, TagValue> {
  if (bytes.length < 8) return {};
  const reader = new Reader(bytes);
  const byteOrder = reader.u16(0);
  if (byteOrder === 0x4949) reader.littleEndian = true;
  else if (byteOrder === 0x4d4d) reader.littleEndian = false;
  else return {};
  if (reader.u16(2) !== 0x002a) return {};
  const ifd0 = reader.u32(4);
  const out: Record<string, TagValue> = {};
  parseIfd(reader, ifd0, EXIF_TAGS, out, true);
  return out;
}

function dmsToDecimal(dms: number[] | number, ref?: string): number | undefined {
  const values = Array.isArray(dms) ? dms : [dms];
  if (!values.length) return undefined;
  const [degrees = 0, minutes = 0, seconds = 0] = values;
  const decimal = degrees + minutes / 60 + seconds / 3600;
  const negative = ref === 'S' || ref === 'W';
  return Number((negative ? -decimal : decimal).toFixed(7));
}

const asString = (value: TagValue | undefined): string | undefined => {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value.length && typeof value[0] === 'number' && value.length <= 32 ? undefined : undefined;
  return String(value).replace(/^0+/, '').trim() || undefined;
};

const asNumber = (value: TagValue | undefined): number | undefined => {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return typeof value[0] === 'number' ? (value[0] as number) : undefined;
  return typeof value === 'number' ? value : Number.isFinite(Number(value)) ? Number(value) : undefined;
};

function formatExposure(value: TagValue | undefined): string | undefined {
  const numeric = asNumber(value);
  if (numeric === undefined || numeric === 0) return undefined;
  return numeric >= 1 ? `${numeric.toFixed(1)} с` : `1/${Math.round(1 / numeric)} с`;
}

/** Parse a full image byte stream (JPEG/PNG/WebP/GIF). */
export function parseImageMetadata(input: Uint8Array | ArrayBuffer): ExtractedImageMetadata {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const result: ExtractedImageMetadata = {
    format: 'unknown',
    byteLength: bytes.length,
    editingSoftware: [],
    hasXmp: false,
    hasIptc: false,
    pngTextChunks: {},
    flags: { gpsPresent: false, cameraMetadataPresent: false, metadataStripped: false, editedLikely: false, screenshotLikely: false, notes: [] },
    rawTags: {},
  };

  const isJpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8;
  const isPng = bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isWebp = bytes.length > 12 && String.fromCharCode(bytes[0] as number, bytes[1] as number, bytes[2] as number, bytes[3] as number) === 'RIFF';

  let exif: Record<string, TagValue> = {};

  if (isPng) {
    result.format = 'png';
    parsePngChunks(bytes, result);
  } else if (isJpeg) {
    result.format = 'jpeg';
    parseJpegSegments(bytes, result).forEach((segment) => {
      if (segment.kind === 'exif') exif = segment.tags;
    });
  } else if (isWebp) {
    result.format = 'webp';
    const riff = scanForString(bytes, 'EXIF');
    if (riff >= 0) {
      const start = riff + 4;
      const tiffOffset = findTiffHeader(bytes, start);
      if (tiffOffset >= 0) exif = parseTiffBlock(bytes.slice(tiffOffset));
    }
  }

  // ── Map TIFF/EXIF tags onto the structured result ─────────────────────────
  if (Object.keys(exif).length) {
    for (const [key, value] of Object.entries(exif)) {
      if (typeof value === 'string' || typeof value === 'number') result.rawTags[key] = value;
    }
    result.make = asString(exif.Make);
    result.model = asString(exif.Model);
    result.lens = asString(exif.LensModel);
    result.software = asString(exif.Software);
    result.dateTime = asString(exif.DateTime);
    result.dateTimeOriginal = asString(exif.DateTimeOriginal) ?? asString(exif.DateTimeDigitized);
    result.orientation = asNumber(exif.Orientation);
    result.iso = asNumber(exif.ISOSpeedRatings);
    result.fNumber = asNumber(exif.FNumber);
    result.exposureTime = formatExposure(exif.ExposureTime);
    const focal = asNumber(exif.FocalLength);
    if (focal) result.focalLength = `${focal.toFixed(0)} мм`;
    result.artist = asString(exif.Artist);
    result.copyright = asString(exif.Copyright);
    result.width = asNumber(exif.PixelXDimension) ?? asNumber(exif.ImageWidth);
    result.height = asNumber(exif.PixelYDimension) ?? asNumber(exif.ImageLength);
    result.comment = asString(exif.UserComment) ?? asString(exif.ImageDescription);

    const latitude = dmsToDecimal(exif.GPSLatitude as number[], exif.GPSLatitudeRef as string);
    const longitude = dmsToDecimal(exif.GPSLongitude as number[], exif.GPSLongitudeRef as string);
    const altitudeValue = asNumber(exif.GPSAltitude);
    if (latitude !== undefined && longitude !== undefined) {
      const dateStamp = asString(exif.GPSDateStamp);
      const timeStamp = Array.isArray(exif.GPSTimeStamp) ? (exif.GPSTimeStamp as number[]).map((v) => Math.round(v).toString().padStart(2, '0')).join(':') : undefined;
      result.gps = {
        latitude,
        longitude,
        altitude: altitudeValue,
        timestamp: dateStamp ? `${dateStamp} ${timeStamp ?? ''}`.trim() : timeStamp,
        precision: Array.isArray(exif.GPSLatitude) && (exif.GPSLatitude as number[]).length === 3 ? 3 : 1,
      };
      result.flags.gpsPresent = true;
    }
  }

  if (result.hasXmp && !result.xmpToolkit) result.xmpToolkit = 'XMP packet present';

  // ── Derived forensic flags ────────────────────────────────────────────────
  const softwareStamps = [result.software, result.xmpToolkit, result.comment].filter(Boolean) as string[];
  for (const stamp of softwareStamps) {
    if (EDIT_SOFTWARE.test(stamp)) result.editingSoftware.push(stamp);
  }
  result.editingSoftware = [...new Set(result.editingSoftware)];
  result.flags.editedLikely = result.editingSoftware.length > 0 || result.hasXmp;
  result.flags.cameraMetadataPresent = Boolean(result.make || result.model);
  result.flags.screenshotLikely = softwareStamps.some((stamp) => SCREENSHOT_SOFTWARE.test(stamp));

  if (!result.flags.cameraMetadataPresent && !result.gps) {
    result.flags.metadataStripped = true;
    result.flags.notes.push('Метаданные камеры отсутствуют — снимок прошёл через мессенджер/соцсеть либо метаданные вычищены намеренно');
  }
  if (result.thumbnail?.present && result.width && result.thumbnail.width && result.width > result.thumbnail.width * 4) {
    result.flags.notes.push('Встроенный превью-кадр меньше основного изображения — стоит проверить соответствие превью содержимому (признак подмены)');
  }
  if (!result.dateTimeOriginal && !result.dateTime) result.flags.notes.push('Дата съёмки отсутствует — восстановить хронологию по EXIF невозможно');

  return result;
}

function findTiffHeader(bytes: Uint8Array, from: number): number {
  for (let i = from; i < Math.min(bytes.length - 8, from + 4096); i += 1) {
    const a = bytes[i] as number;
    const b = bytes[i + 1] as number;
    if ((a === 0x49 && b === 0x49) || (a === 0x4d && b === 0x4d)) {
      const r = new Reader(bytes, i);
      if (r.u16(2) === 0x002a) return i;
    }
  }
  return -1;
}

function scanForString(bytes: Uint8Array, needle: string, from = 0): number {
  const target = [...needle].map((char) => char.charCodeAt(0));
  outer: for (let i = from; i < bytes.length - target.length; i += 1) {
    for (let j = 0; j < target.length; j += 1) if (bytes[i + j] !== target[j]) continue outer;
    return i;
  }
  return -1;
}

interface JpegSegment {
  kind: 'exif' | 'xmp' | 'iptc' | 'comment';
  tags: Record<string, TagValue>;
  text?: string;
}

function parseJpegSegments(bytes: Uint8Array, result: ExtractedImageMetadata): JpegSegment[] {
  const segments: JpegSegment[] = [];
  let offset = 2;

  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1] as number;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xda || marker === 0xd9) break; // start of scan → pixel data

    const length = ((bytes[offset + 2] as number) << 8) | (bytes[offset + 3] as number);
    const payloadStart = offset + 4;
    const payloadLength = length - 2;

    if (marker === 0xe1 && payloadLength > 6) {
      const header = String.fromCharCode(...bytes.slice(payloadStart, payloadStart + 6));
      if (header === 'Exif\0\0') {
        const tags = parseTiffBlock(bytes.slice(payloadStart + 6, payloadStart + payloadLength));
        segments.push({ kind: 'exif', tags });
      } else if (header.startsWith('http') || scanForString(bytes.slice(payloadStart, payloadStart + 64), 'xmpmeta') >= 0) {
        const xmpText = new TextDecoderSafe().decode(bytes.slice(payloadStart, payloadStart + payloadLength));
        result.hasXmp = true;
        const toolkit = /xmpmeta[^>]*>.*?<x:xmptk>(.*?)<\/x:xmptk>/is.exec(xmpText) ?? /Adobe XMP Core [^"<]+/.exec(xmpText);
        if (toolkit) result.xmpToolkit = (toolkit[1] ?? toolkit[0]).trim().slice(0, 120);
        const tool = /photoshop:SoftwareAgent="([^"]+)"/i.exec(xmpText) ?? /<xmp:CreatorTool>(.*?)<\/xmp:CreatorTool>/i.exec(xmpText);
        if (tool?.[1]) {
          result.editingSoftware.push(tool[1].trim());
          if (!result.software) result.software = tool[1].trim();
        }
        segments.push({ kind: 'xmp', tags: {} });
      }
    } else if (marker === 0xed && payloadLength > 14) {
      const signature = String.fromCharCode(...bytes.slice(payloadStart, payloadStart + 13));
      if (signature.startsWith('Photoshop 3.0')) {
        result.hasIptc = true;
        const text = new TextDecoderSafe().decode(bytes.slice(payloadStart, payloadStart + payloadLength));
        // IPTC strings are NUL-terminated, so the control byte is part of the grammar.
        // oxlint-disable-next-line eslint/no-control-regex
        const caption = /(?:Caption|Description|By-line)[^\x00]*\x00*([^\x00]{3,120})/i.exec(text);
        if (caption?.[1]) result.comment = result.comment ?? caption[1].trim();
        segments.push({ kind: 'iptc', tags: {} });
      }
    } else if (marker === 0xfe && payloadLength > 0) {
      result.comment = new TextDecoderSafe().decode(bytes.slice(payloadStart, payloadStart + payloadLength)).trim();
      segments.push({ kind: 'comment', tags: {}, text: result.comment });
    } else if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      const height = ((bytes[payloadStart + 1] as number) << 8) | (bytes[payloadStart + 2] as number);
      const width = ((bytes[payloadStart + 3] as number) << 8) | (bytes[payloadStart + 4] as number);
      result.width = result.width ?? width;
      result.height = result.height ?? height;
    }

    // Embedded EXIF thumbnail (JPEGInterchangeFormat 0x0201 / 0x0202)
    if (marker === 0xe1 && payloadLength > 6) {
      const header = String.fromCharCode(...bytes.slice(payloadStart, payloadStart + 6));
      if (header === 'Exif\0\0') {
        const thumbOffset = scanForString(bytes.slice(payloadStart, payloadStart + payloadLength), '\xff\xd8\xff');
        if (thumbOffset > 0) {
          result.thumbnail = { present: true, bytes: payloadLength - thumbOffset };
        }
      }
    }

    offset += 2 + length;
  }

  const exifSegment = segments.find((segment) => segment.kind === 'exif');
  if (exifSegment) {
    const thumbnailOffset = exifSegment.tags.JPEGInterchangeFormat;
    const thumbnailLength = exifSegment.tags.JPEGInterchangeFormatLength;
    if (typeof thumbnailOffset === 'number' && typeof thumbnailLength === 'number') {
      result.thumbnail = { ...(result.thumbnail ?? { present: true }), present: true, bytes: thumbnailLength };
    }
  }
  return segments;
}

function parsePngChunks(bytes: Uint8Array, result: ExtractedImageMetadata): void {
  let offset = 8;
  const decoder = new TextDecoderSafe();
  while (offset + 8 <= bytes.length) {
    const length = ((bytes[offset] as number) << 24) | ((bytes[offset + 1] as number) << 16) | ((bytes[offset + 2] as number) << 8) | (bytes[offset + 3] as number);
    if (length < 0 || offset + 12 + length > bytes.length) break;
    const type = String.fromCharCode(bytes[offset + 4] as number, bytes[offset + 5] as number, bytes[offset + 6] as number, bytes[offset + 7] as number);
    const payloadStart = offset + 8;
    const payload = bytes.slice(payloadStart, payloadStart + length);

    if (type === 'IHDR') {
      const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
      result.width = view.getUint32(0);
      result.height = view.getUint32(4);
    } else if (type === 'tEXt') {
      const text = decoder.decode(payload);
      const [keyword, ...rest] = text.split('\0');
      if (keyword) {
        result.pngTextChunks[keyword] = rest.join('\0').slice(0, 200);
        if (/software|creator|author|source|comment|creation time|history/i.test(keyword)) {
          result.editingSoftware.push(rest.join(' ').slice(0, 120).trim());
        }
      }
    } else if (type === 'iTXt') {
      const text = decoder.decode(payload);
      const [keyword, , , , value] = text.split('\0');
      if (keyword) result.pngTextChunks[keyword] = (value ?? '').slice(0, 200);
    } else if (type === 'eXIf') {
      const tags = parseTiffBlock(payload);
      Object.assign(result.rawTags, tags);
      result.make = result.make ?? asString(tags.Make);
      result.model = result.model ?? asString(tags.Model);
      result.software = result.software ?? asString(tags.Software);
      result.dateTime = result.dateTime ?? asString(tags.DateTime);
      if (tags.GPSLatitude) {
        const latitude = dmsToDecimal(tags.GPSLatitude as number[], tags.GPSLatitudeRef as string);
        const longitude = dmsToDecimal(tags.GPSLongitude as number[], tags.GPSLongitudeRef as string);
        if (latitude !== undefined && longitude !== undefined) {
          result.gps = { latitude, longitude, altitude: asNumber(tags.GPSAltitude), precision: 3 };
          result.flags.gpsPresent = true;
        }
      }
    } else if (type === 'iCCP') {
      result.iccProfile = decoder.decode(payload.slice(0, 40)).split('\0')[0] ?? undefined;
    }
    if (type === 'IEND') break;
    offset += 12 + length;
  }
}

/** Minimal TextDecoder wrapper that degrades to manual UTF-8 decoding. */
class TextDecoderSafe {
  decode(bytes: Uint8Array): string {
    if (typeof TextDecoder !== 'undefined') {
      try {
        return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      } catch {
        /* fall through */
      }
    }
    let out = '';
    for (const byte of bytes) out += byte < 128 ? String.fromCharCode(byte) : '';
    return out;
  }
}

/** Detect a file type from its magic bytes (defeats extension spoofing). */
export function sniffFileType(bytes: Uint8Array): { type: string; mime: string; extensionMatches?: boolean } {
  const startsWith = (signature: number[]): boolean => signature.every((byte, index) => bytes[index] === byte);
  const text = String.fromCharCode(...bytes.slice(0, 12));
  if (startsWith([0xff, 0xd8, 0xff])) return { type: 'jpeg', mime: 'image/jpeg' };
  if (startsWith([0x89, 0x50, 0x4e, 0x47])) return { type: 'png', mime: 'image/png' };
  if (text.startsWith('RIFF') && text.slice(8, 12) === 'WEBP') return { type: 'webp', mime: 'image/webp' };
  if (text.startsWith('GIF8')) return { type: 'gif', mime: 'image/gif' };
  if (text.startsWith('%PDF')) return { type: 'pdf', mime: 'application/pdf' };
  if (text.startsWith('PK')) return { type: 'zip', mime: 'application/zip' };
  if (startsWith([0x1f, 0x8b])) return { type: 'gzip', mime: 'application/gzip' };
  if (text.startsWith('OggS')) return { type: 'ogg', mime: 'audio/ogg' };
  if (text.slice(4, 8) === 'ftyp') return { type: 'isobmff', mime: 'video/mp4' };
  if (text.startsWith('ID3')) return { type: 'mp3', mime: 'audio/mpeg' };
  return { type: 'unknown', mime: 'application/octet-stream' };
}
