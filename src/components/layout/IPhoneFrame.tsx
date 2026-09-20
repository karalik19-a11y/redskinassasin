import React from 'react';
import type { ReactNode } from 'react';
import { Maximize2, Volume2, VolumeX, Radio, SlidersHorizontal } from 'lucide-react';
import { sound } from '../../utils/sound';

interface IPhoneFrameProps {
  children: ReactNode;
  isFrameEnabled: boolean;
  onToggleFrame: () => void;
  isSoundEnabled: boolean;
  onToggleSound: () => void;
}

/** A responsive product shell, deliberately free of device chrome. */
export const IPhoneFrame: React.FC<IPhoneFrameProps> = ({ children, isFrameEnabled, onToggleFrame, isSoundEnabled, onToggleSound }) => (
  <div className="relative min-h-screen w-full bg-transparent">
    <header className="relative z-30 mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-14">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[16px] border border-[#d7ad6a]/30 bg-[#d7ad6a]/10 text-[#d7ad6a] shadow-[0_8px_24px_rgba(0,0,0,.18)]">
          <Radio className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold tracking-[.2em] text-[#f5f1e8]">RED SKIN</span>
            <span className="hidden rounded-full border border-hair bg-white/5 px-2 py-0.5 text-[9px] font-medium tracking-[.16em] text-[#9da3b2] sm:inline">FIELD NOTES</span>
          </div>
          <p className="hidden text-[11px] text-[#9da3b2] sm:block">Personal intelligence workspace</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => { sound.playHapticTap(); onToggleSound(); }} title="Переключить звук" className="flex items-center gap-2 rounded-xl border border-hair bg-white/[.045] px-3 py-2 text-[11px] text-[#b9bfcb] hover:bg-white/[.09]">
          {isSoundEnabled ? <Volume2 className="h-3.5 w-3.5 text-[#d7ad6a]" /> : <VolumeX className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{isSoundEnabled ? 'Звук включён' : 'Звук выключен'}</span>
        </button>
        <button onClick={() => { sound.playHapticTap(); onToggleFrame(); }} title="Переключить плотность интерфейса" className="flex items-center gap-2 rounded-xl border border-hair bg-white/[.045] px-3 py-2 text-[11px] text-[#b9bfcb] hover:bg-white/[.09]">
          {isFrameEnabled ? <SlidersHorizontal className="h-3.5 w-3.5 text-[#d7ad6a]" /> : <Maximize2 className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{isFrameEnabled ? 'Компактный вид' : 'Плотный вид'}</span>
        </button>
      </div>
    </header>
    <div className={`relative z-10 mx-auto w-full max-w-[1440px] overflow-hidden border-y border-white/[.07] bg-[#131722]/60 shadow-[0_24px_80px_rgba(0,0,0,.22)] ${isFrameEnabled ? '' : 'wide-layout'}`}>
      {children}
    </div>
    <footer className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-5 py-5 text-[10px] tracking-[.08em] text-[#747b8d] sm:px-8 lg:px-14">
      <span>REDSKIN / FIELD NOTES</span>
      <span className="hidden sm:inline">A QUIET TOOL FOR DEEPER CONTEXT</span>
    </footer>
  </div>
);
