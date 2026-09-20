import React from 'react';
import { PRESET_DOSSIERS } from '../../utils/presetDossiers';
import type { Dossier } from '../../types/dossier';
import { Shield, Sparkles, UserCheck } from 'lucide-react';
import { sound } from '../../utils/sound';

interface PresetSelectorProps {
  onSelectPreset: (dossier: Dossier) => void;
}

export const PresetSelector: React.FC<PresetSelectorProps> = ({ onSelectPreset }) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-bold text-neutral-400 tracking-wider flex items-center space-x-1 uppercase">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Быстрые VIP-цели для демонстрации</span>
        </span>
        <span className="text-[10px] text-red-400 font-mono">4 Профиля</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {PRESET_DOSSIERS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => {
              sound.playHapticTap();
              onSelectPreset(preset);
            }}
            className="group relative p-2.5 rounded-2xl bg-gradient-to-br from-neutral-900/90 to-neutral-950/90 border border-red-500/20 hover:border-red-500/60 hover:shadow-[0_0_20px_rgba(239,68,68,0.3)] transition-all duration-200 text-left flex items-center space-x-3"
          >
            {/* Avatar thumbnail with warpaint border */}
            <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 border border-amber-400/50 shadow-md">
              <img
                src={preset.avatarUrl}
                alt={preset.fio.full}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
              />
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-red-600 rounded-tl-sm text-[8px] font-black text-white flex items-center justify-center">
                ★
              </span>
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-bold text-white group-hover:text-amber-300 truncate transition-colors">
                  {preset.fio.last} {preset.fio.first[0]}.{preset.fio.middle[0]}.
                </span>
                <Shield className="w-3 h-3 text-red-500 shrink-0" />
              </div>

              <div className="text-[10px] text-amber-400/90 font-mono truncate">
                {preset.totemTitle}
              </div>

              <div className="text-[9px] text-neutral-400 flex items-center space-x-2 mt-0.5">
                <span>{preset.birthDate}</span>
                <span>•</span>
                <span className="text-red-400 font-medium">Риск: {preset.riskScore}%</span>
              </div>
            </div>

            <UserCheck className="w-4 h-4 text-neutral-600 group-hover:text-red-400 shrink-0 transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
};
