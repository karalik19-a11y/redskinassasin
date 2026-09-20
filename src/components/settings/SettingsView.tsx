import React from 'react';
import { Volume2, VolumeX, Smartphone, Maximize2, Database, Sparkles, RefreshCw, GitBranch } from 'lucide-react';
import { sound } from '../../utils/sound';

interface SettingsViewProps {
  isSoundEnabled: boolean;
  onToggleSound: () => void;
  isFrameEnabled: boolean;
  onToggleFrame: () => void;
  onResetData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  isSoundEnabled,
  onToggleSound,
  isFrameEnabled,
  onToggleFrame,
  onResetData,
}) => {
  return (
    <div className="space-y-3 pb-20 select-none">
      {/* Title */}
      <div className="ios-glass p-3.5 rounded-2xl border border-red-500/30">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold text-white uppercase tracking-tight">
            Опции & Настройки Системы
          </span>
        </div>
      </div>

      {/* General Controls (iOS Switch Style) */}
      <div className="ios-glass p-3.5 rounded-2xl border border-white/10 space-y-3">
        <div className="text-[10px] font-mono text-neutral-400 uppercase font-bold">
          Интерфейс & Тактильный отклик
        </div>

        {/* Sound Toggle */}
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {isSoundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Apple Haptic & Звуковые эффекты</div>
              <div className="text-[10px] text-neutral-400">Синтез частот и тактильный отклик Web Audio</div>
            </div>
          </div>

          <button
            onClick={() => {
              sound.playHapticTap();
              onToggleSound();
            }}
            className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
              isSoundEnabled ? 'bg-red-600' : 'bg-neutral-800'
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
        <div className="flex items-center justify-between py-1 border-t border-white/5 pt-2">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
              {isFrameEnabled ? <Smartphone className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Рамка iPhone 16 Pro</div>
              <div className="text-[10px] text-neutral-400">Титановый корпус или адаптивный экран</div>
            </div>
          </div>

          <button
            onClick={() => {
              sound.playHapticTap();
              onToggleFrame();
            }}
            className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
              isFrameEnabled ? 'bg-red-600' : 'bg-neutral-800'
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

      {/* Database Index Info */}
      <div className="ios-glass p-3.5 rounded-2xl border border-white/10 space-y-2">
        <div className="flex items-center space-x-2 text-xs font-bold text-white">
          <Database className="w-4 h-4 text-emerald-400" />
          <span>Статистика Баз Данных и Реестров</span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
          <div className="bg-neutral-950/70 p-2 rounded-xl border border-white/5">
            <div className="text-[9px] text-neutral-400">ВСЕГО ЗАПИСЕЙ</div>
            <div className="text-white font-bold">4,820,914,200</div>
          </div>
          <div className="bg-neutral-950/70 p-2 rounded-xl border border-white/5">
            <div className="text-[9px] text-neutral-400">TELEGRAM СООБЩЕНИЙ</div>
            <div className="text-amber-300 font-bold">142,500,000</div>
          </div>
          <div className="bg-neutral-950/70 p-2 rounded-xl border border-white/5">
            <div className="text-[9px] text-neutral-400">КРИПТО-ТРАНЗАКЦИЙ</div>
            <div className="text-emerald-400 font-bold">89,140,200</div>
          </div>
          <div className="bg-neutral-950/70 p-2 rounded-xl border border-white/5">
            <div className="text-[9px] text-neutral-400">ТОТЕМНЫХ ШТРАФОВ ГИБДД</div>
            <div className="text-red-400 font-bold">210,400,000</div>
          </div>
        </div>
      </div>

      {/* GitHub Repository info & Deployment */}
      <div className="ios-glass p-3.5 rounded-2xl border border-white/10 space-y-2">
        <div className="flex items-center space-x-2 text-xs font-bold text-white">
          <GitBranch className="w-4 h-4 text-neutral-300" />
          <span>GitHub & Развертывание</span>
        </div>

        <p className="text-xs text-neutral-300 leading-relaxed">
          Приложение полностью статическое и оптимизировано для мгновенного запуска через <b>GitHub Pages</b> или любую ссылку.
        </p>

        <div className="bg-neutral-950/80 p-2.5 rounded-xl border border-white/5 text-[10px] font-mono text-amber-300 space-y-1">
          <div>Репозиторий: karalik19-a11y/redskinassasin</div>
          <div>Поддержка PWA & Touch Gestures: АКТИВНО</div>
          <div>Шифрование сессии: ГОСТ Р 34.12-2015</div>
        </div>
      </div>

      {/* Reset button */}
      <button
        onClick={() => {
          sound.playHapticTap();
          onResetData();
        }}
        className="w-full py-2.5 px-3 bg-red-950/40 hover:bg-red-900/50 border border-red-500/30 rounded-2xl text-xs font-bold text-red-300 flex items-center justify-center space-x-2 transition-all"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>Сбросить кэш и вернуть демо-цели</span>
      </button>
    </div>
  );
};
