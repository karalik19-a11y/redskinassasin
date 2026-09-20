import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Sparkles, Terminal } from 'lucide-react';
import { sound } from '../../utils/sound';

interface ScanningOverlayProps {
  targetName: string;
  onComplete: () => void;
}

const SCAN_STEPS = [
  'Инициализация протокола «Томагавк OSINT v4.9»...',
  'Подключение к защищенным узлам Роскомнадзора и базам СБП...',
  'Поиск совпадений по реестрам ФНС, ГИС ГМП и ФСБ...',
  'Анализ архивов утечек: Яндекс.Еда, СДЭК, Альфа, Delivery...',
  'Триангуляция базовых станций и Telegram ID переписки...',
  'Синтез графа «Ловец Снов» и расчет Тотемного Зверя...',
  'Формирование досье высшей степени секретности...',
];

export const ScanningOverlay: React.FC<ScanningOverlayProps> = ({
  targetName,
  onComplete,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [progress, setProgress] = useState(12);

  useEffect(() => {
    sound.playTotemResonance();

    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + Math.floor(Math.random() * 18 + 12);
        if (next >= 100) {
          clearInterval(interval);
          sound.playSuccessChime();
          setTimeout(onComplete, 400);
          return 100;
        }
        sound.playScanBeep(600 + next * 4);
        return next;
      });
    }, 280);

    return () => clearInterval(interval);
  }, [onComplete]);

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setCurrentStepIndex((prev) => (prev < SCAN_STEPS.length - 1 ? prev + 1 : prev));
    }, 380);
    return () => clearInterval(stepInterval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 bg-[#050508]/95 backdrop-blur-2xl flex flex-col items-center justify-between p-6 select-none"
    >
      {/* Top Header */}
      <div className="w-full flex items-center justify-between pt-6">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
          <span className="text-xs font-mono font-bold text-red-400 tracking-wider">
            TOMAHAWK DEEP SCAN // IN PROGRESS
          </span>
        </div>
        <span className="text-xs font-mono text-amber-400 font-bold">{progress}%</span>
      </div>

      {/* Center Radar & Totem Hologram */}
      <div className="relative flex flex-col items-center justify-center my-auto">
        {/* Radar Outer Circle */}
        <div className="relative w-56 h-56 rounded-full border-2 border-red-500/30 flex items-center justify-center shadow-[0_0_50px_rgba(239,68,68,0.25)]">
          {/* Radar Sweep Needle */}
          <div className="absolute inset-0 rounded-full animate-radar origin-center pointer-events-none">
            <div className="w-1/2 h-1/2 bg-gradient-to-br from-red-500/40 via-amber-500/10 to-transparent rounded-tl-full" />
          </div>

          {/* Middle Ring with Aztec / Shaman Runes */}
          <div className="w-40 h-40 rounded-full border border-amber-500/40 border-dashed animate-spin duration-[20000ms] flex items-center justify-center">
            <div className="w-28 h-28 rounded-full border border-red-400/50 flex items-center justify-center bg-red-950/20 backdrop-blur-sm">
              {/* Central Glowing Totem Icon */}
              <Shield className="w-12 h-12 text-red-500 animate-pulse drop-shadow-[0_0_12px_rgba(239,68,68,0.8)]" />
            </div>
          </div>

          {/* Orbiting Telemetry Particles */}
          <div className="absolute top-3 left-10 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <div className="absolute bottom-6 right-8 w-2 h-2 rounded-full bg-red-500 animate-ping" />
        </div>

        {/* Target Title */}
        <div className="mt-6 text-center">
          <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest block mb-1">
            СКАНИРОВАНИЕ ОБЪЕКТА
          </span>
          <h3 className="text-lg font-bold text-white tracking-tight text-center px-4">
            {targetName || 'Генерация цифрового следа'}
          </h3>
        </div>
      </div>

      {/* Bottom Terminal Log Stream */}
      <div className="w-full max-w-sm ios-glass rounded-2xl p-3 border border-red-500/20 shadow-xl pb-6">
        <div className="flex items-center space-x-1.5 mb-1.5 text-neutral-400 text-[10px]">
          <Terminal className="w-3 h-3 text-red-400" />
          <span className="font-mono">SHAMAN_TELEMETRY.LOG</span>
        </div>

        <div className="font-mono text-[11px] text-amber-300/90 leading-tight flex items-start space-x-2">
          <Sparkles className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5 animate-spin" />
          <span className="truncate">{SCAN_STEPS[currentStepIndex]}</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-neutral-800 rounded-full mt-3 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-red-600 via-amber-500 to-red-400 transition-all duration-300 shadow-[0_0_10px_rgba(239,68,68,0.8)]"
            style={{ width: `${progress}%` }}
          />
        </div>

        <button
          onClick={() => {
            sound.playHapticTap();
            onComplete();
          }}
          className="w-full mt-2 text-center text-[10px] text-neutral-400 hover:text-white transition-colors"
        >
          [Пропустить анимацию &rarr;]
        </button>
      </div>
    </motion.div>
  );
};
