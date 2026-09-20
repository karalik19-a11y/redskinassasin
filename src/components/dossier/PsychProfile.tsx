import React from 'react';
import type { Dossier } from '../../types/dossier';
import { ShieldAlert, Brain, Eye, AlertTriangle } from 'lucide-react';

interface PsychProfileProps {
  dossier: Dossier;
}

export const PsychProfile: React.FC<PsychProfileProps> = ({ dossier }) => {
  return (
    <div className="space-y-3">
      {/* Risk & Vulnerabilities Card */}
      <div className="ios-glass p-3.5 rounded-[16px] border border-hair space-y-3">
        <div className="flex items-center justify-between border-b border-hair pb-2">
          <div className="flex items-center space-x-2 text-xs font-bold text-white">
            <ShieldAlert className="w-4 h-4 text-clay" />
            <span className="uppercase">Оперативные уязвимости & Риски</span>
          </div>
          <span className="text-[10px] font-mono text-clay font-bold">
            {dossier.intelligenceNotes.vulnerabilities.length} ФАКТОРА
          </span>
        </div>

        <div className="space-y-2">
          {dossier.intelligenceNotes.vulnerabilities.map((v, idx) => (
            <div
              key={idx}
              className="flex items-start space-x-2 bg-clay-soft p-2.5 rounded-xl border border-hair text-xs text-ink"
            >
              <AlertTriangle className="w-4 h-4 text-gold shrink-0 mt-0.5" />
              <span>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Psychological & Behavioral Portrait */}
      <div className="ios-glass p-3.5 rounded-[16px] border border-hair space-y-2.5">
        <div className="flex items-center space-x-2 text-xs font-bold text-white border-b border-hair pb-2">
          <Brain className="w-4 h-4 text-gold" />
          <span className="uppercase">Психологический портрет & Поведение</span>
        </div>

        <p className="text-xs text-ink leading-relaxed bg-panel p-3 rounded-xl border border-hair">
          {dossier.intelligenceNotes.psychologicalProfile}
        </p>

        <div className="space-y-1 pt-1">
          <div className="text-[10px] font-mono text-muted uppercase">
            Паттерны образа жизни:
          </div>
          <p className="text-xs text-ink italic bg-panel p-2.5 rounded-xl border border-hair">
            {dossier.intelligenceNotes.lifestylePattern}
          </p>
        </div>
      </div>

      {/* Official Cases / Operational Registers */}
      {dossier.intelligenceNotes.cases.length > 0 && (
        <div className="ios-glass p-3.5 rounded-[16px] border border-hair space-y-2">
          <div className="flex items-center space-x-2 text-xs font-bold text-white border-b border-hair pb-2">
            <Eye className="w-4 h-4 text-clay" />
            <span className="uppercase">Проверки & Учет в ведомствах</span>
          </div>

          <div className="space-y-1.5">
            {dossier.intelligenceNotes.cases.map((cItem, cIdx) => (
              <div
                key={cIdx}
                className="text-[11px] font-mono text-ink bg-panel p-2 rounded-lg border border-hair"
              >
                {cItem}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2 text-[10px] text-muted">
            <span>Рекомендация наружного наблюдения:</span>
            <span
              className={`font-mono font-bold ${
                dossier.intelligenceNotes.surveillanceRecommended
                  ? 'text-clay'
                  : 'text-sage'
              }`}
            >
              {dossier.intelligenceNotes.surveillanceRecommended ? 'РЕКОМЕНДОВАНО' : 'НЕ ТРЕБУЕТСЯ'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
