import React from 'react';
import type { Dossier, Relative } from '../../types/dossier';
import { Users, ArrowRight } from 'lucide-react';
import { sound } from '../../utils/sound';

interface SocialGraphSectionProps {
  dossier: Dossier;
  onOpenRelativeDossier: (relative: Relative) => void;
}

export const SocialGraphSection: React.FC<SocialGraphSectionProps> = ({
  dossier,
  onOpenRelativeDossier,
}) => {
  return (
    <div className="space-y-3">
      {/* Social Circle / Tribal Network Header */}
      <div className="ios-glass p-3.5 rounded-2xl border border-white/10 space-y-2.5">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center space-x-2 text-xs font-bold text-white">
            <Users className="w-4 h-4 text-red-400" />
            <span className="uppercase">Семейный круг & Деловые связи</span>
          </div>
          <span className="text-[10px] font-mono text-amber-400 font-bold">
            {dossier.socialGraph.length} Контактов
          </span>
        </div>

        <p className="text-[11px] text-neutral-300">
          Связи, выявленные через ЗАГС, совпадение адресов прописки, доверенности и выписки ЕГРЮЛ. Нажми на контакт для перехода в под-досье:
        </p>

        <div className="space-y-2 pt-1">
          {dossier.socialGraph.map((rel) => (
            <div
              key={rel.id}
              onClick={() => {
                sound.playHapticTap();
                onOpenRelativeDossier(rel);
              }}
              className="cursor-pointer group bg-neutral-950/80 hover:bg-red-950/30 p-3 rounded-xl border border-white/5 hover:border-red-500/40 transition-all duration-200 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 bg-red-950/60 text-red-300 border border-red-500/30 rounded text-[9px] font-bold uppercase">
                    {rel.relation}
                  </span>
                  <span className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                    {rel.fio}
                  </span>
                </div>

                <ArrowRight className="w-4 h-4 text-neutral-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
              </div>

              <div className="flex items-center justify-between text-[10px] text-neutral-400">
                <span>Д.Р.: {rel.birthDate}</span>
                {rel.phone && <span className="font-mono text-neutral-300">{rel.phone}</span>}
              </div>

              {rel.notes && (
                <div className="text-[10px] text-neutral-300 italic bg-black/40 px-2 py-1 rounded">
                  {rel.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
