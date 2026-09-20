// ============================================================================
// REDSKIN ASSASSIN // TOMAHAWK OSINT - REAL IMAGE FORENSICS & EXIF EXTRACTOR
// Real EXIF Metadata Parsing, GPS Pinpoint, ELA Manipulation Detector & Reverse Search
// ============================================================================

import exifr from 'exifr';

export interface ImageExifData {
  hasExif: boolean;
  dateTime?: string;
  cameraMake?: string;
  cameraModel?: string;
  lensModel?: string;
  software?: string;
  isEditedWithSoftware: boolean;
  iso?: number;
  fNumber?: number;
  exposureTime?: string;
  focalLength?: string;
  imageWidth?: number;
  imageHeight?: number;
  gps?: {
    latitude: number;
    longitude: number;
    altitude?: number;
    googleMapsUrl: string;
    yandexMapsUrl: string;
  };
  rawTags: Record<string, any>;
}

export async function extractImageExif(fileOrBuffer: File | Blob | ArrayBuffer | string): Promise<ImageExifData> {
  try {
    const raw = await exifr.parse(fileOrBuffer, {
      tiff: true,
      xmp: true,
      icc: true,
      jfif: true,
      gps: true,
      iptc: true,
    });

    if (!raw) {
      return {
        hasExif: false,
        isEditedWithSoftware: false,
        rawTags: {},
      };
    }

    const software = raw.Software || raw.ProcessingSoftware || raw.CreatorTool;
    const isEditedWithSoftware = Boolean(
      software &&
      /(adobe|photoshop|lightroom|gimp|snapseed|canva|vsco|procreate|picsart|pixlr)/i.test(String(software))
    );

    let gpsData = undefined;
    if (typeof raw.latitude === 'number' && typeof raw.longitude === 'number') {
      const lat = Number(raw.latitude.toFixed(6));
      const lon = Number(raw.longitude.toFixed(6));
      gpsData = {
        latitude: lat,
        longitude: lon,
        altitude: raw.GPSAltitude ? Number(raw.GPSAltitude.toFixed(1)) : undefined,
        googleMapsUrl: `https://www.google.com/maps?q=${lat},${lon}`,
        yandexMapsUrl: `https://yandex.ru/maps/?ll=${lon}%2C${lat}&z=16&pt=${lon}%2C${lat}`,
      };
    }

    let expTime = undefined;
    if (raw.ExposureTime) {
      expTime = raw.ExposureTime < 1 ? `1/${Math.round(1 / raw.ExposureTime)}s` : `${raw.ExposureTime}s`;
    }

    return {
      hasExif: true,
      dateTime: raw.DateTimeOriginal ? new Date(raw.DateTimeOriginal).toLocaleString('ru-RU') : undefined,
      cameraMake: raw.Make,
      cameraModel: raw.Model,
      lensModel: raw.LensModel,
      software: software ? String(software) : undefined,
      isEditedWithSoftware,
      iso: raw.ISO,
      fNumber: raw.FNumber ? Number(raw.FNumber.toFixed(1)) : undefined,
      exposureTime: expTime,
      focalLength: raw.FocalLength ? `${raw.FocalLength}mm` : undefined,
      imageWidth: raw.ExifImageWidth || raw.ImageWidth,
      imageHeight: raw.ExifImageHeight || raw.ImageHeight,
      gps: gpsData,
      rawTags: raw,
    };
  } catch (err) {
    console.warn('EXIF extract error:', err);
    return {
      hasExif: false,
      isEditedWithSoftware: false,
      rawTags: {},
    };
  }
}

// ----------------------------------------------------------------------------
// REAL ERROR LEVEL ANALYSIS (ELA) ALGORITHM
// ----------------------------------------------------------------------------
export function generateErrorLevelAnalysis(
  imageElement: HTMLImageElement,
  scale: number = 20
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('No canvas context');

      const width = imageElement.naturalWidth || imageElement.width;
      const height = imageElement.naturalHeight || imageElement.height;
      canvas.width = width;
      canvas.height = height;

      // Draw original
      ctx.drawImage(imageElement, 0, 0, width, height);
      const origData = ctx.getImageData(0, 0, width, height);

      // Recompress to JPEG quality 0.90
      const recompressedDataUrl = canvas.toDataURL('image/jpeg', 0.90);
      const recompressedImg = new Image();

      recompressedImg.onload = () => {
        const reCanvas = document.createElement('canvas');
        reCanvas.width = width;
        reCanvas.height = height;
        const reCtx = reCanvas.getContext('2d');
        if (!reCtx) return resolve(recompressedDataUrl);

        reCtx.drawImage(recompressedImg, 0, 0, width, height);
        const reData = reCtx.getImageData(0, 0, width, height);

        // Calculate absolute difference amplified by scale
        const outData = ctx.createImageData(width, height);
        for (let i = 0; i < origData.data.length; i += 4) {
          const dr = Math.abs(origData.data[i] - reData.data[i]) * scale;
          const dg = Math.abs(origData.data[i + 1] - reData.data[i + 1]) * scale;
          const db = Math.abs(origData.data[i + 2] - reData.data[i + 2]) * scale;

          outData.data[i] = Math.min(255, dr);
          outData.data[i + 1] = Math.min(255, dg);
          outData.data[i + 2] = Math.min(255, db);
          outData.data[i + 3] = 255; // Full opacity
        }

        ctx.putImageData(outData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };

      recompressedImg.onerror = () => reject('Recompression failed');
      recompressedImg.src = recompressedDataUrl;
    } catch (err) {
      reject(err);
    }
  });
}

// ----------------------------------------------------------------------------
// REVERSE IMAGE SEARCH DIRECT LINKS
// ----------------------------------------------------------------------------
export function getReverseImageSearchEngines() {
  return [
    {
      name: 'Яндекс Картинки',
      url: 'https://yandex.ru/images/search?rpt=imageview',
      badge: 'СНГ / Лица / VK',
      description: 'Лучший поиск по лицам и профилям РФ/СНГ',
    },
    {
      name: 'Google Lens',
      url: 'https://lens.google.com/upload',
      badge: 'Глобальный поиск',
      description: 'Поиск похожих объектов, товаров и локаций',
    },
    {
      name: 'PimEyes (Face Search)',
      url: 'https://pimeyes.com/en',
      badge: 'AI Биометрия',
      description: 'Поиск совпадений лиц в открытых источниках',
    },
    {
      name: 'TinEye Reverse Search',
      url: 'https://tineye.com/',
      badge: 'Точные дубликаты',
      description: 'Поиск первоисточника и модификаций фото',
    },
    {
      name: 'Bing Visual Search',
      url: 'https://www.bing.com/visualsearch',
      badge: 'Microsoft AI',
      description: 'Поиск по визуальным совпадениям Bing',
    },
  ];
}
