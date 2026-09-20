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
      <div className="ios-glass p-3.5 rounded-[16px] border border-hair">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-gold" />
          <span className="text-xs font-bold text-white uppercase tracking-tight">
            Опции & Настройки Системы
          </span>
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
              <div className="text-xs font-semibold text-white">Apple Haptic & Звуковые эффекты</div>
              <div className="text-[10px] text-muted">Синтез частот и тактильный отклик Web Audio</div>
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
              <div className="text-xs font-semibold text-white">Компактность рабочей области</div>
              <div className="text-[10px] text-muted">Плотный или свободный ритм интерфейса</div>
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

      {/* Database Index Info */}
      <div className="ios-glass p-3.5 rounded-[16px] border border-hair space-y-2">
        <div className="flex items-center space-x-2 text-xs font-bold text-white">
          <Database className="w-4 h-4 text-sage" />
          <span>Статистика Баз Данных и Реестров</span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
          <div className="bg-panel p-2 rounded-xl border border-hair">
            <div className="text-[9px] text-muted">ВСЕГО ЗАПИСЕЙ</div>
            <div className="text-white font-bold">4,820,914,200</div>
          </div>
          <div className="bg-panel p-2 rounded-xl border border-hair">
            <div className="text-[9px] text-muted">TELEGRAM СООБЩЕНИЙ</div>
            <div className="text-gold font-bold">142,500,000</div>
          </div>
          <div className="bg-panel p-2 rounded-xl border border-hair">
            <div className="text-[9px] text-muted">КРИПТО-ТРАНЗАКЦИЙ</div>
            <div className="text-sage font-bold">89,140,200</div>
          </div>
          <div className="bg-panel p-2 rounded-xl border border-hair">
            <div className="text-[9px] text-muted">ТОТЕМНЫХ ШТРАФОВ ГИБДД</div>
            <div className="text-clay font-bold">210,400,000</div>
          </div>
        </div>
      </div>

      {/* GitHub Repository info & Deployment */}
      <div className="ios-glass p-3.5 rounded-[16px] border border-hair space-y-2">
        <div className="flex items-center space-x-2 text-xs font-bold text-white">
          <GitBranch className="w-4 h-4 text-ink" />
          <span>GitHub & Развертывание</span>
        </div>

        <p className="text-xs text-ink leading-relaxed">
          Приложение полностью статическое и оптимизировано для мгновенного запуска через <b>GitHub Pages</b> или любую ссылку.
        </p>

        <div className="bg-panel p-2.5 rounded-xl border border-hair text-[10px] font-mono text-gold space-y-1">
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
        className="w-full py-2.5 px-3 bg-clay-soft hover:bg-clay-soft border border-hair rounded-[16px] text-xs font-bold text-clay flex items-center justify-center space-x-2 transition-all"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>Сбросить кэш и вернуть демо-цели</span>
      </button>
    </div>
  );
};
