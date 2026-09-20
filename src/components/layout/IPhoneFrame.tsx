import React from 'react';
import type { ReactNode } from 'react';
import { Smartphone, Maximize2, Volume2, VolumeX, Shield, Sparkles } from 'lucide-react';
import { sound } from '../../utils/sound';

interface IPhoneFrameProps {
  children: ReactNode;
  isFrameEnabled: boolean;
  onToggleFrame: () => void;
  isSoundEnabled: boolean;
  onToggleSound: () => void;
}

export const IPhoneFrame: React.FC<IPhoneFrameProps> = ({
  children,
  isFrameEnabled,
  onToggleFrame,
  isSoundEnabled,
  onToggleSound,
}) => {
  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-0 sm:p-4 md:p-8 bg-[#020204]">
      {/* Top Desktop Cyber Bar (only visible on tablet/desktop) */}
      <header className="hidden md:flex items-center justify-between w-full max-w-5xl mb-4 px-6 py-2.5 ios-glass rounded-2xl border border-red-500/20 shadow-[0_0_25px_rgba(239,68,68,0.15)]">
        {/* Logo & Totem Badge */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-red-600 via-amber-600 to-red-900 flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.6)] border border-amber-400/30">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-black tracking-widest text-white uppercase bg-gradient-to-r from-red-400 via-amber-300 to-red-500 bg-clip-text text-transparent">
                REDSKIN ASSASSIN
              </span>
              <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-red-950/80 text-red-400 border border-red-500/40 rounded">
                OSINT v4.9
              </span>
            </div>
            <p className="text-[10px] text-neutral-400">
              Cyber-Shaman Dossier Intelligence // Томагавк Досье-Разведка
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-3">
          {/* Sound Toggle */}
          <button
            onClick={() => {
              sound.playHapticTap();
              onToggleSound();
            }}
            title="Переключить звук"
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              isSoundEnabled
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                : 'bg-white/5 text-neutral-400 hover:text-white border border-white/10'
            }`}
          >
            {isSoundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{isSoundEnabled ? 'Звук: ВКЛ' : 'Звук: ВЫКЛ'}</span>
          </button>

          {/* Frame Toggle */}
          <button
            onClick={() => {
              sound.playHapticTap();
              onToggleFrame();
            }}
            title="Переключить рамку iPhone 16 Pro"
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              isFrameEnabled
                ? 'bg-red-500/20 text-red-300 border border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                : 'bg-white/5 text-neutral-400 hover:text-white border border-white/10'
            }`}
          >
            {isFrameEnabled ? <Smartphone className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{isFrameEnabled ? 'iPhone 16 Pro' : 'Широкий экран'}</span>
          </button>

          {/* Luxury Status Badge */}
          <div className="hidden lg:flex items-center space-x-1.5 px-3 py-1 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-[11px] text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-mono font-medium">СЕТЬ OSINT: ОНЛАЙН</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div
        className={`w-full transition-all duration-500 ease-out flex justify-center ${
          isFrameEnabled
            ? 'max-w-[430px] sm:my-2'
            : 'max-w-5xl'
        }`}
      >
        {isFrameEnabled ? (
          /* iPhone 16 Pro Titanium Hardware Chassis */
          <div className="relative w-full aspect-[9/19.5] min-h-[840px] max-h-[920px] rounded-[52px] p-[10px] bg-gradient-to-b from-[#2e2a27] via-[#1a1918] to-[#121110] shadow-[0_25px_80px_rgba(0,0,0,0.9),0_0_50px_rgba(239,68,68,0.15)] border-[3px] border-[#4a443e] ring-1 ring-white/15">
            {/* Action Button Left */}
            <div className="absolute -left-[5px] top-[115px] w-[3px] h-[26px] bg-[#3a3530] rounded-l-sm" />
            {/* Volume Up */}
            <div className="absolute -left-[5px] top-[160px] w-[3px] h-[50px] bg-[#3a3530] rounded-l-sm" />
            {/* Volume Down */}
            <div className="absolute -left-[5px] top-[225px] w-[3px] h-[50px] bg-[#3a3530] rounded-l-sm" />
            {/* Power Button Right */}
            <div className="absolute -right-[5px] top-[180px] w-[3px] h-[75px] bg-[#3a3530] rounded-r-sm" />

            {/* Display Screen Area */}
            <div className="relative w-full h-full rounded-[44px] overflow-hidden bg-black flex flex-col justify-between shadow-inner">
              {children}

              {/* iOS Home Indicator Bar */}
              <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/40 rounded-full select-none pointer-events-none z-50 hover:bg-white/70 transition-colors" />
            </div>
          </div>
        ) : (
          /* Fullscreen Standalone App Container */
          <div className="w-full min-h-[880px] rounded-3xl overflow-hidden bg-[#07070b] border border-red-500/20 shadow-[0_20px_70px_rgba(0,0,0,0.85)] flex flex-col justify-between">
            {children}
            {/* iOS Home Indicator Bar */}
            <div className="w-full flex justify-center py-2 bg-black/40">
              <div className="w-36 h-1 bg-white/30 rounded-full" />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Footer Note */}
      <footer className="mt-4 text-center text-xs text-neutral-400 select-none flex flex-col sm:flex-row items-center justify-center gap-2">
        <span className="flex items-center space-x-1">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>Redskin Assassin Dossier OSINT Intelligence // iOS 18 Premium Engine</span>
        </span>
        <span className="hidden sm:inline text-white/20">•</span>
        <span className="text-red-400/80">Оригинальный дизайн: Коренные Индейцы × Кибер-Шаманизм</span>
      </footer>
    </div>
  );
};
