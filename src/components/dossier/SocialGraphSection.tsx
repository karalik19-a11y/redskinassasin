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
      <div className="ios-glass p-3.5 rounded-[16px] border border-hair space-y-2.5">
        <div className="flex items-center justify-between border-b border-hair pb-2">
          <div className="flex items-center space-x-2 text-xs font-bold text-white">
            <Users className="w-4 h-4 text-clay" />
            <span className="uppercase">Семейный круг & Деловые связи</span>
          </div>
          <span className="text-[10px] font-mono text-gold font-bold">
            {dossier.socialGraph.length} Контактов
          </span>
        </div>

        <p className="text-[11px] text-ink">
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
              className="cursor-pointer group bg-panel hover:bg-clay-soft p-3 rounded-xl border border-hair hover:border-hair transition-all duration-200 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 bg-clay-soft text-clay border border-hair rounded text-[9px] font-bold uppercase">
                    {rel.relation}
                  </span>
                  <span className="text-xs font-bold text-white group-hover:text-gold transition-colors">
                    {rel.fio}
                  </span>
                </div>

                <ArrowRight className="w-4 h-4 text-muted group-hover:text-gold group-hover:translate-x-0.5 transition-all" />
              </div>

              <div className="flex items-center justify-between text-[10px] text-muted">
                <span>Д.Р.: {rel.birthDate}</span>
                {rel.phone && <span className="font-mono text-ink">{rel.phone}</span>}
              </div>

              {rel.notes && (
                <div className="text-[10px] text-ink italic bg-panel px-2 py-1 rounded">
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
