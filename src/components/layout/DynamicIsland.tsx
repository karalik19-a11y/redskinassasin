import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Activity, Volume2, Sparkles } from 'lucide-react';
import { sound } from '../../utils/sound';

interface DynamicIslandProps {
  isScanning?: boolean;
  scanProgress?: number;
  threatLevel?: string;
  targetName?: string;
  statusText?: string;
}

export const DynamicIsland: React.FC<DynamicIslandProps> = ({
  isScanning = false,
  scanProgress = 0,
  threatLevel,
  targetName,
  statusText = 'OSINT MATRIX // ACTIVE',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleTap = () => {
    sound.playHapticTap();
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="w-full flex justify-center items-center py-1 select-none z-50">
      <motion.div
        layout
        onClick={handleTap}
        className={`bg-black/95 text-white cursor-pointer shadow-[0_4px_24px_rgba(0,0,0,0.8)] border border-white/10 overflow-hidden ${
          isExpanded
            ? 'w-[90%] rounded-3xl p-4'
            : isScanning
            ? 'w-72 rounded-full px-3 py-1.5'
            : 'w-36 rounded-full px-3 py-1.5'
        } transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex items-center justify-between`}
      >
        <AnimatePresence mode="wait">
          {isExpanded ? (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full space-y-2.5 text-xs"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                  <span className="font-bold tracking-wider text-red-400 text-[11px]">
                    TOMAHAWK CYBER-SHAMAN HUD
                  </span>
                </div>
                <span className="text-[10px] text-amber-400/90 font-mono">v4.8 PRO</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-white/5 rounded-xl p-2 border border-white/5">
                  <div className="text-white/40 text-[9px]">ЦЕЛЬ СКАНИРОВАНИЯ</div>
                  <div className="font-semibold text-white/90 truncate">{targetName || 'Режим ожидания'}</div>
                </div>
                <div className="bg-white/5 rounded-xl p-2 border border-white/5">
                  <div className="text-white/40 text-[9px]">СТАТУС ЗАЩИТЫ</div>
                  <div className="font-semibold text-emerald-400 flex items-center space-x-1">
                    <ShieldAlert className="w-3 h-3 text-red-400" />
                    <span>{threatLevel || 'SECURE'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 text-[10px] text-white/50">
                <span className="flex items-center space-x-1">
                  <Volume2 className="w-3 h-3 text-amber-400" />
                  <span>Тактильные сенсоры активны</span>
                </span>
                <span className="text-red-400/80 font-mono">Шифрование ГОСТ 256</span>
              </div>
            </motion.div>
          ) : isScanning ? (
            <motion.div
              key="scanning"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center space-x-2">
                <div className="relative flex items-center justify-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                  <span className="absolute w-2 h-2 rounded-full bg-red-600" />
                </div>
                <span className="text-[11px] font-semibold tracking-tight text-white/90 truncate max-w-[120px]">
                  {statusText}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <div className="w-12 h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 to-amber-400 transition-all duration-150"
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-amber-400">{scanProgress}%</span>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full flex items-center justify-between px-1"
            >
              {/* Left Island Icon */}
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                <Sparkles className="w-3 h-3 text-amber-400" />
              </div>

              {/* Camera cutout simulator */}
              <div className="w-3 h-3 rounded-full bg-neutral-900 border border-neutral-800" />

              {/* Right Island Activity */}
              <div className="flex items-center space-x-1">
                <Activity className="w-3 h-3 text-red-400 animate-pulse" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
