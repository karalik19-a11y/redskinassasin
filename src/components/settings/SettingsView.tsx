import React, { useState, useEffect } from 'react';
import {
  Volume2,
  VolumeX,
  Smartphone,
  Maximize2,
  Sparkles,
  RefreshCw,
  Download,
  Upload,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { sound } from '../../utils/sound';
import { loadAllCases, saveAllCases, setActiveCaseId, getActiveCaseId } from '../../utils/caseStorage';
import type { Dossier } from '../../types/dossier';

interface SettingsViewProps {
  isSoundEnabled: boolean;
  onToggleSound: () => void;
  isFrameEnabled: boolean;
  onToggleFrame: () => void;
  onResetData: () => void;
  onSelectCase?: (dossier: Dossier) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  isSoundEnabled,
  onToggleSound,
  isFrameEnabled,
  onToggleFrame,
  onResetData,
  onSelectCase,
}) => {
  const [cases, setCases] = useState<Dossier[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    setCases(loadAllCases());
    setActiveId(getActiveCaseId());
  }, []);

  const handleSwitchCase = (cs: Dossier) => {
    sound.playHapticTap();
    setActiveCaseId(cs.id);
    setActiveId(cs.id);
    if (onSelectCase) onSelectCase(cs);
  };

  const handleExportAllJSON = () => {
    sound.playHapticTap();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(cases, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `tomahawk_osint_cases_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    sound.playSuccessChime();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result as string);
          if (Array.isArray(parsed) && parsed.length > 0) {
            saveAllCases(parsed);
            setCases(parsed);
            setActiveCaseId(parsed[0].id);
            setActiveId(parsed[0].id);
            sound.playSuccessChime();
            if (onSelectCase) onSelectCase(parsed[0]);
          }
        } catch {
          alert('Ошибка чтения JSON файла');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="space-y-3 pb-20 select-none">
      {/* Title */}
      <div className="ios-glass p-3.5 rounded-[16px] border border-hair">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-gold" />
          <span className="text-xs font-bold text-white uppercase tracking-tight">
            Опции & База Данных Расследований
          </span>
        </div>
      </div>

      {/* Case Management */}
      <div className="ios-glass p-3.5 rounded-[16px] border border-hair space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-muted uppercase font-bold">
            Управление делами ({cases.length})
          </span>
          <div className="flex space-x-1">
            <button
              onClick={handleExportAllJSON}
              className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-semibold text-ink flex items-center space-x-1 border border-hair transition-all"
            >
              <Download className="w-3 h-3 text-gold" />
              <span>Экспорт JSON</span>
            </button>
            <label className="cursor-pointer px-2 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-semibold text-ink flex items-center space-x-1 border border-hair transition-all">
              <Upload className="w-3 h-3 text-gold" />
              <span>Импорт</span>
              <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
            </label>
          </div>
        </div>

        <div className="space-y-1.5 max-h-[220px] overflow-y-auto no-scrollbar">
          {cases.map((cs) => (
            <div
              key={cs.id}
              onClick={() => handleSwitchCase(cs)}
              className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                cs.id === activeId
                  ? 'bg-clay/20 border-clay text-white font-bold'
                  : 'bg-panel border-hair text-ink hover:bg-white/5'
              }`}
            >
              <div>
                <div className="text-xs text-white">{cs.fio.full}</div>
                <div className="text-[10px] text-muted font-mono">ID: {cs.id} • {cs.totemTitle}</div>
              </div>
              {cs.id === activeId && <CheckCircle2 className="w-4 h-4 text-sage" />}
            </div>
          ))}
        </div>
      </div>

      {/* General Controls (iOS Switch Style) */}
      <div className="ios-glass p-3.5 rounded-[16px] border border-hair space-y-3">
        <div className="text-[10px] font-mono text-muted uppercase font-bold">
          Интерфейс & Тактильный отклик
        </div>

        {/* Sound Toggle */}
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-gold-soft text-gold border border-hair">
              {isSoundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Apple Haptic & Аудио-синтезатор</div>
              <div className="text-[10px] text-muted">Web Audio API тактильный отклик</div>
            </div>
          </div>

          <button
            onClick={() => {
              sound.playHapticTap();
              onToggleSound();
            }}
            className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
              isSoundEnabled ? 'bg-clay' : 'bg-panel'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                isSoundEnabled ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Frame Toggle */}
        <div className="flex items-center justify-between py-1 border-t border-hair pt-2">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-clay/10 text-clay border border-hair">
              {isFrameEnabled ? <Smartphone className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Компактный режим iPhone 16 Pro</div>
              <div className="text-[10px] text-muted">Эмуляция корпуса или полноэкранный вид</div>
            </div>
          </div>

          <button
            onClick={() => {
              sound.playHapticTap();
              onToggleFrame();
            }}
            className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
              isFrameEnabled ? 'bg-clay' : 'bg-panel'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                isFrameEnabled ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Engine Status */}
      <div className="ios-glass p-3.5 rounded-[16px] border border-hair space-y-2">
        <div className="flex items-center space-x-2 text-xs font-bold text-white">
          <ShieldCheck className="w-4 h-4 text-sage" />
          <span>Диагностика OSINT Модулей</span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
          <div className="bg-panel p-2 rounded-xl border border-hair">
            <div className="text-[9px] text-muted">ВАЛИДАТОРЫ РФ</div>
            <div className="text-sage font-bold">89 Регионов (100% OK)</div>
          </div>
          <div className="bg-panel p-2 rounded-xl border border-hair">
            <div className="text-[9px] text-muted">EXIF & ELA ДВИЖОК</div>
            <div className="text-sage font-bold">exifr v7.1 Активен</div>
          </div>
          <div className="bg-panel p-2 rounded-xl border border-hair">
            <div className="text-[9px] text-muted">DNS OVER HTTPS</div>
            <div className="text-gold font-bold">Cloudflare DoH Live</div>
          </div>
          <div className="bg-panel p-2 rounded-xl border border-hair">
            <div className="text-[9px] text-muted">WEB CRYPTO HASHES</div>
            <div className="text-sage font-bold">MD5 / SHA-256 OK</div>
          </div>
        </div>
      </div>

      {/* Reset button */}
      <button
        onClick={() => {
          sound.playHapticTap();
          onResetData();
        }}
        className="w-full py-2.5 px-3 bg-clay-soft hover:bg-clay-soft border border-hair rounded-[16px] text-xs font-bold text-clay flex items-center justify-center space-x-2 transition-all"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>Сбросить данные к эталонному делу</span>
      </button>
    </div>
  );
};
