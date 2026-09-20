import React, { useState } from 'react';
import { Camera, Upload, Sparkles, CheckCircle2, ShieldCheck, RefreshCw } from 'lucide-react';
import { sound } from '../../utils/sound';

interface BiometricFaceScannerProps {
  onScanMatch: (name: string) => void;
}

export const BiometricFaceScanner: React.FC<BiometricFaceScannerProps> = ({ onScanMatch }) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80'
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    matched: boolean;
    name: string;
    confidence: number;
    totem: string;
  } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      sound.playHapticTap();
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImage(reader.result as string);
        runFaceRecognition(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const runFaceRecognition = (_imgUrl: string) => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    sound.playRadarPing();

    setTimeout(() => {
      setIsAnalyzing(false);
      sound.playSuccessChime();
      setAnalysisResult({
        matched: true,
        name: 'Морозов Александр Дмитриевич',
        confidence: 98.4,
        totem: 'Волк // Теневой Поток',
      });
    }, 1800);
  };

  return (
    <div className="space-y-4">
      {/* Viewfinder Frame */}
      <div className="relative w-full aspect-square max-w-[320px] mx-auto rounded-[20px] overflow-hidden border-2 border-hair bg-panel shadow-[0_10px_30px_rgba(0,0,0,.28)]">
        {selectedImage ? (
          <img
            src={selectedImage}
            alt="Biometric Target"
            className="w-full h-full object-cover filter brightness-90 contrast-110"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted">
            <Camera className="w-12 h-12 mb-2" />
            <span className="text-xs">Загрузите фото лица</span>
          </div>
        )}

        {/* Shamanic Cyber Warpaint HUD Mesh */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          {/* Facial Target Box */}
          <div className="relative w-48 h-56 border-2 border-dashed border-hair rounded-[20px] flex items-center justify-center">
            {/* Corner Markers */}
            <span className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-hair" />
            <span className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-hair" />
            <span className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-hair" />
            <span className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-hair" />

            {/* Cyber Warpaint Cheek Glyphs */}
            <div className="absolute top-1/3 -left-3 flex flex-col space-y-1">
              <span className="w-3 h-0.5 bg-clay shadow-[0_10px_30px_rgba(0,0,0,.28)]" />
              <span className="w-4 h-0.5 bg-clay shadow-[0_10px_30px_rgba(0,0,0,.28)]" />
              <span className="w-2 h-0.5 bg-clay shadow-[0_10px_30px_rgba(0,0,0,.28)]" />
            </div>
            <div className="absolute top-1/3 -right-3 flex flex-col space-y-1">
              <span className="w-3 h-0.5 bg-clay shadow-[0_10px_30px_rgba(0,0,0,.28)]" />
              <span className="w-4 h-0.5 bg-clay shadow-[0_10px_30px_rgba(0,0,0,.28)]" />
              <span className="w-2 h-0.5 bg-clay shadow-[0_10px_30px_rgba(0,0,0,.28)]" />
            </div>

            {/* Center Crosshair */}
            <div className="w-6 h-6 border border-hair rounded-full flex items-center justify-center">
              <span className="w-1.5 h-1.5 bg-clay rounded-full animate-pulse-totem" />
            </div>

            {/* Scanning Laser Line */}
            {isAnalyzing && (
              <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#b45c46] to-transparent shadow-[0_10px_30px_rgba(0,0,0,.28)] animate-scan-bar" />
            )}
          </div>
        </div>

        {/* Live Status Overlay */}
        <div className="absolute bottom-2 inset-x-2 py-1 px-3 ios-glass rounded-xl text-[10px] flex items-center justify-between text-white/90">
          <span className="flex items-center space-x-1 font-mono">
            <Sparkles className="w-3 h-3 text-gold" />
            <span>ВЕКТОР: 1024-D</span>
          </span>
          <span className="text-sage font-mono">
            {isAnalyzing ? 'АНАЛИЗ...' : 'ГОТОВ К СКАНИРОВАНИЮ'}
          </span>
        </div>
      </div>

      {/* Analysis Result Box */}
      {analysisResult && (
        <div className="ios-glass-accent p-3.5 rounded-[16px] border border-hair space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-sage text-xs font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span>СОВПАДЕНИЕ НАЙДЕНО ({analysisResult.confidence}%)</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gold-soft text-gold font-mono">
              {analysisResult.totem}
            </span>
          </div>

          <div className="text-sm font-bold text-white tracking-tight">
            {analysisResult.name}
          </div>

          <button
            onClick={() => {
              sound.playHapticTap();
              onScanMatch(analysisResult.name);
            }}
            className="w-full py-2.5 bg-gradient-to-r from-[#c2664f] via-[#b8925a] to-[#a8523d] hover:brightness-110 text-white text-xs font-bold rounded-xl shadow-[0_10px_30px_rgba(0,0,0,.28)] flex items-center justify-center space-x-2 transition-transform active:scale-95"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>ОТКРЫТЬ ПОЛНОЕ ДОСЬЕ</span>
          </button>
        </div>
      )}

      {/* Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <label className="cursor-pointer py-2.5 px-3 ios-glass hover:bg-white/10 rounded-[16px] border border-hair text-xs font-semibold text-white/90 flex items-center justify-center space-x-2 transition-all">
          <Upload className="w-4 h-4 text-gold" />
          <span>Загрузить фото</span>
          <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
        </label>

        <button
          onClick={() => {
            sound.playHapticTap();
            if (selectedImage) runFaceRecognition(selectedImage);
          }}
          disabled={isAnalyzing}
          className="py-2.5 px-3 bg-clay/30 hover:bg-clay/50 border border-hair rounded-[16px] text-xs font-semibold text-white flex items-center justify-center space-x-2 transition-all"
        >
          <RefreshCw className={`w-4 h-4 text-clay ${isAnalyzing ? 'animate-spin' : ''}`} />
          <span>{isAnalyzing ? 'Поиск...' : 'Сканировать'}</span>
        </button>
      </div>
    </div>
  );
};
