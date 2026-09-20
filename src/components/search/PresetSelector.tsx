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
        <span className="text-[11px] font-bold text-muted tracking-wider flex items-center space-x-1 uppercase">
          <Sparkles className="w-3.5 h-3.5 text-gold" />
          <span>Быстрые VIP-цели для демонстрации</span>
        </span>
        <span className="text-[10px] text-clay font-mono">4 Профиля</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {PRESET_DOSSIERS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => {
              sound.playHapticTap();
              onSelectPreset(preset);
            }}
            className="group relative p-2.5 rounded-[16px] bg-gradient-to-br from-neutral-900/90 to-neutral-950/90 border border-hair hover:border-hair hover:shadow-[0_10px_30px_rgba(0,0,0,.28)] transition-all duration-200 text-left flex items-center space-x-3"
          >
            {/* Avatar thumbnail with warpaint border */}
            <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 border border-hair shadow-md">
              <img
                src={preset.avatarUrl}
                alt={preset.fio.full}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
              />
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-clay rounded-tl-sm text-[8px] font-semibold text-white flex items-center justify-center">
                ★
              </span>
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-bold text-white group-hover:text-gold truncate transition-colors">
                  {preset.fio.last} {preset.fio.first[0]}.{preset.fio.middle[0]}.
                </span>
                <Shield className="w-3 h-3 text-clay shrink-0" />
              </div>

              <div className="text-[10px] text-gold font-mono truncate">
                {preset.totemTitle}
              </div>

              <div className="text-[9px] text-muted flex items-center space-x-2 mt-0.5">
                <span>{preset.birthDate}</span>
                <span>•</span>
                <span className="text-clay font-medium">Риск: {preset.riskScore}%</span>
              </div>
            </div>

            <UserCheck className="w-4 h-4 text-faint group-hover:text-clay shrink-0 transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
};
