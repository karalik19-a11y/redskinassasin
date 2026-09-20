import React, { useState, useRef } from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  MapPin,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Search,
  Eye,
  FileSearch,
} from 'lucide-react';
import { sound } from '../../utils/sound';
import { extractImageExif, generateErrorLevelAnalysis, getReverseImageSearchEngines, type ImageExifData } from '../../utils/osint/imageForensics';

interface BiometricFaceScannerProps {
  onScanMatch: (name: string) => void;
  onAttachToDossier?: (photoUrl: string, exif: ImageExifData) => void;
}

export const BiometricFaceScanner: React.FC<BiometricFaceScannerProps> = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80'
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [exifData, setExifData] = useState<ImageExifData | null>(null);
  const [elaImage, setElaImage] = useState<string | null>(null);
  const [showEla, setShowEla] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      sound.playHapticTap();
      setIsAnalyzing(true);
      setShowEla(false);
      setElaImage(null);

      // Read as Data URL
      const reader = new FileReader();
      reader.onload = async () => {
        const url = reader.result as string;
        setSelectedImage(url);

        // Extract real EXIF
        try {
          const exif = await extractImageExif(file);
          setExifData(exif);
          sound.playSuccessChime();
        } catch (err) {
          console.error('EXIF extraction failed:', err);
        } finally {
          setIsAnalyzing(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRunEla = async () => {
    if (!imgRef.current) return;
    sound.playRadarPing();
    setIsAnalyzing(true);
    try {
      const ela = await generateErrorLevelAnalysis(imgRef.current, 20);
      setElaImage(ela);
      setShowEla(true);
      sound.playSuccessChime();
    } catch (err) {
      console.error('ELA failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const searchEngines = getReverseImageSearchEngines();

  return (
    <div className="space-y-4 select-none">
      {/* Viewfinder Frame */}
      <div className="relative w-full aspect-square max-w-[320px] mx-auto rounded-[20px] overflow-hidden border-2 border-hair bg-panel shadow-[0_10px_30px_rgba(0,0,0,.28)]">
        {selectedImage ? (
          <img
            ref={imgRef}
            src={showEla && elaImage ? elaImage : selectedImage}
            alt="Biometric Target"
            crossOrigin="anonymous"
            className="w-full h-full object-cover filter brightness-95 contrast-105 transition-all"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted">
            <Camera className="w-12 h-12 mb-2" />
            <span className="text-xs">Загрузите фото для анализа</span>
          </div>
        )}

        {/* Viewfinder HUD Overlays */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="relative w-48 h-56 border border-hair/60 rounded-[20px] flex items-center justify-center">
            {/* Corner Markers */}
            <span className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-clay" />
            <span className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-clay" />
            <span className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-clay" />
            <span className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-clay" />

            {/* Center Reticle */}
            <div className="w-6 h-6 border border-hair rounded-full flex items-center justify-center">
              <span className="w-1.5 h-1.5 bg-clay rounded-full" />
            </div>

            {/* Scan bar */}
            {isAnalyzing && (
              <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#b45c46] to-transparent shadow-[0_10px_30px_rgba(0,0,0,.28)] animate-scan-bar" />
            )}
          </div>
        </div>

        {/* Status Chip */}
        <div className="absolute bottom-2 inset-x-2 py-1 px-3 ios-glass rounded-xl text-[10px] flex items-center justify-between text-white">
          <span className="flex items-center space-x-1 font-mono text-gold">
            <Sparkles className="w-3 h-3" />
            <span>{showEla ? 'РЕЖИМ ELA' : 'ФОТОАНАЛИЗ'}</span>
          </span>
          <span className="text-[9px] font-mono text-sage">
            {isAnalyzing ? 'ОБРАБОТКА...' : exifData?.hasExif ? 'EXIF ИЗВЛЕЧЕН' : 'ГОТОВ'}
          </span>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <label className="cursor-pointer py-2.5 px-3 ios-glass hover:bg-white/10 rounded-[16px] border border-hair text-xs font-semibold text-white flex items-center justify-center space-x-2 transition-all">
          <Upload className="w-4 h-4 text-gold" />
          <span className="truncate">Загрузить файл</span>
          <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" onChange={handleFileUpload} className="hidden" />
        </label>

        <button
          onClick={() => {
            sound.playHapticTap();
            if (showEla) {
              setShowEla(false);
            } else {
              handleRunEla();
            }
          }}
          disabled={!selectedImage || isAnalyzing}
          className={`py-2.5 px-3 border rounded-[16px] text-xs font-semibold flex items-center justify-center space-x-2 transition-all ${
            showEla
              ? 'bg-clay text-white border-clay shadow-[0_10px_30px_rgba(0,0,0,.28)]'
              : 'ios-glass text-ink hover:text-white border-hair hover:bg-white/10'
          }`}
        >
          <Eye className="w-4 h-4 text-gold" />
          <span>{showEla ? 'Оригинал' : 'Анализ ELA'}</span>
        </button>
      </div>

      {/* EXIF Data Panel */}
      {exifData && exifData.hasExif && (
        <div className="ios-glass p-3.5 rounded-[16px] border border-hair space-y-2.5">
          <div className="flex items-center justify-between border-b border-hair pb-1.5">
            <div className="flex items-center space-x-2">
              <FileSearch className="w-4 h-4 text-gold" />
              <span className="text-xs font-bold text-white uppercase tracking-tight">
                Извлеченные метаданные (EXIF)
              </span>
            </div>
            {exifData.isEditedWithSoftware ? (
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-clay/20 text-clay border border-hair flex items-center space-x-1 font-bold">
                <AlertTriangle className="w-3 h-3" />
                <span>РЕДАКТИРОВАНО В {exifData.software}</span>
              </span>
            ) : (
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-sage-soft text-sage border border-hair flex items-center space-x-1">
                <ShieldCheck className="w-3 h-3" />
                <span>ОРИГИНАЛЬНЫЙ КАДР</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {exifData.dateTime && (
              <div className="bg-panel p-2 rounded-xl border border-hair">
                <div className="text-[9px] text-muted">Дата съемки</div>
                <div className="font-mono text-white font-semibold">{exifData.dateTime}</div>
              </div>
            )}
            {exifData.cameraModel && (
              <div className="bg-panel p-2 rounded-xl border border-hair">
                <div className="text-[9px] text-muted">Камера / Устройство</div>
                <div className="font-mono text-white font-semibold truncate">
                  {exifData.cameraMake ? `${exifData.cameraMake} ` : ''}{exifData.cameraModel}
                </div>
              </div>
            )}
            {exifData.lensModel && (
              <div className="bg-panel p-2 rounded-xl border border-hair col-span-2">
                <div className="text-[9px] text-muted">Объектив</div>
                <div className="font-mono text-white truncate">{exifData.lensModel}</div>
              </div>
            )}
            {exifData.iso && (
              <div className="bg-panel p-2 rounded-xl border border-hair">
                <div className="text-[9px] text-muted">Экспозиция</div>
                <div className="font-mono text-white">ISO {exifData.iso} {exifData.exposureTime ? `• ${exifData.exposureTime}` : ''}</div>
              </div>
            )}
            {exifData.imageWidth && exifData.imageHeight && (
              <div className="bg-panel p-2 rounded-xl border border-hair">
                <div className="text-[9px] text-muted">Разрешение</div>
                <div className="font-mono text-white">{exifData.imageWidth} × {exifData.imageHeight} px</div>
              </div>
            )}
          </div>

          {/* GPS Coordinates & Map links */}
          {exifData.gps && (
            <div className="bg-panel p-2.5 rounded-xl border border-hair space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-white">
                  <MapPin className="w-4 h-4 text-clay" />
                  <span>GPS Геометка в метаданных</span>
                </div>
                <span className="text-[10px] font-mono text-gold">
                  {exifData.gps.latitude}, {exifData.gps.longitude}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <a
                  href={exifData.gps.yandexMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="py-1.5 px-2 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] text-ink font-semibold flex items-center justify-center space-x-1 border border-hair transition-all"
                >
                  <ExternalLink className="w-3 h-3 text-gold" />
                  <span>Яндекс Карты</span>
                </a>
                <a
                  href={exifData.gps.googleMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="py-1.5 px-2 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] text-ink font-semibold flex items-center justify-center space-x-1 border border-hair transition-all"
                >
                  <ExternalLink className="w-3 h-3 text-gold" />
                  <span>Google Maps</span>
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reverse Image Search Engines */}
      <div className="ios-glass p-3.5 rounded-[16px] border border-hair space-y-2.5">
        <div className="flex items-center space-x-2">
          <Search className="w-4 h-4 text-gold" />
          <span className="text-xs font-bold text-white uppercase tracking-tight">
            Обратный поиск по изображению (OSINT Engines)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {searchEngines.map((engine, idx) => (
            <a
              key={idx}
              href={engine.url}
              target="_blank"
              rel="noreferrer"
              className="p-2.5 bg-panel hover:bg-white/10 rounded-xl border border-hair transition-all flex items-start justify-between group"
            >
              <div>
                <div className="text-xs font-bold text-white group-hover:text-gold transition-colors flex items-center space-x-1">
                  <span>{engine.name}</span>
                  <ExternalLink className="w-3 h-3 text-muted group-hover:text-gold" />
                </div>
                <div className="text-[10px] text-muted mt-0.5">{engine.description}</div>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 bg-white/5 rounded text-ink font-mono border border-hair">
                {engine.badge}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};
