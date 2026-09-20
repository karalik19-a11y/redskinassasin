import React from 'react';
import type { Dossier } from '../../types/dossier';
import { Download, Copy, Share2, Sparkles, Check, Flame } from 'lucide-react';
import { getThreatBadgeColor } from '../../utils/formatters';
import { exportDossierPDF } from '../../utils/pdfExport';
import { sound } from '../../utils/sound';

interface HeaderCardProps {
  dossier: Dossier;
}

export const HeaderCard: React.FC<HeaderCardProps> = ({ dossier }) => {
  const [copied, setCopied] = React.useState(false);
  const threatStyle = getThreatBadgeColor(dossier.threatLevel);

  const handleCopyJSON = () => {
    sound.playHapticTap();
    navigator.clipboard.writeText(JSON.stringify(dossier, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportPDF = () => {
    sound.playHapticTap();
    exportDossierPDF(dossier);
  };

  const handleShare = () => {
    sound.playHapticTap();
    if (navigator.share) {
      navigator.share({
        title: `Досье: ${dossier.fio.full}`,
        text: `Тотем: ${dossier.totemTitle} | Угроза: ${dossier.threatLevel}`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      handleCopyJSON();
    }
  };

  return (
    <div className="relative overflow-hidden rounded-3xl ios-glass-card p-4 border border-red-500/30 space-y-3.5 select-none">
      {/* Top Threat & Classification Stamp */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          <span className="text-[10px] font-mono font-bold text-red-400 uppercase tracking-wider">
            {dossier.intelligenceNotes.classification}
          </span>
        </div>

        {/* Threat Level Badge */}
        <div
          className={`flex items-center space-x-1 px-2.5 py-0.5 rounded-full border text-[10px] font-bold font-mono ${threatStyle.bg} ${threatStyle.border} ${threatStyle.text} ${threatStyle.glow}`}
        >
          <Flame className="w-3 h-3 animate-pulse" />
          <span>УГРОЗА: {dossier.threatLevel} ({dossier.riskScore}%)</span>
        </div>
      </div>

      {/* Main Profile Info Row */}
      <div className="flex items-start space-x-3.5">
        {/* Avatar with Shamanic Cyber Warpaint HUD Frame */}
        <div className="relative w-20 h-20 rounded-2xl overflow-hidden shrink-0 border-2 border-red-500/60 shadow-[0_0_20px_rgba(239,68,68,0.4)]">
          <img
            src={dossier.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80'}
            alt={dossier.fio.full}
            className="w-full h-full object-cover"
          />

          {/* Warpaint Facial Glitch Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
          <div className="absolute bottom-1 left-1 px-1 py-0.2 bg-red-600 text-[8px] font-bold font-mono text-white rounded">
            {dossier.biometricMatchRate}%
          </div>
        </div>

        {/* FIO & Totem Details */}
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-black text-white tracking-tight leading-tight totem-glow">
            {dossier.fio.full}
          </h2>

          {/* Totem Animal Subtitle */}
          <div className="flex items-center space-x-1.5 mt-1 text-amber-300 font-mono text-[11px] font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">{dossier.totemTitle}</span>
          </div>

          <div className="text-[10px] text-neutral-400 flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
            <span>{dossier.birthDate} ({dossier.age} лет)</span>
            <span>•</span>
            <span className="text-amber-200/90">{dossier.zodiac}</span>
            <span>•</span>
            <span className="truncate">{dossier.birthPlace}</span>
          </div>

          {/* Aliases */}
          {dossier.aliases.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {dossier.aliases.slice(0, 3).map((alias, i) => (
                <span
                  key={i}
                  className="px-1.5 py-0.2 bg-white/5 border border-white/10 rounded-md text-[9px] font-mono text-neutral-300"
                >
                  @{alias}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Summary note */}
      <p className="text-xs text-neutral-300 bg-neutral-950/60 p-2.5 rounded-xl border border-white/5 leading-relaxed">
        {dossier.summary}
      </p>

      {/* Quick Action Toolbar */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        <button
          onClick={handleExportPDF}
          className="py-2 px-2 bg-gradient-to-r from-red-600/40 to-amber-600/30 hover:bg-red-600/60 border border-red-500/50 rounded-xl text-[11px] font-bold text-white flex items-center justify-center space-x-1.5 transition-all shadow-[0_0_12px_rgba(239,68,68,0.2)]"
        >
          <Download className="w-3.5 h-3.5 text-amber-400" />
          <span>Экспорт PDF</span>
        </button>

        <button
          onClick={handleCopyJSON}
          className="py-2 px-2 ios-glass hover:bg-white/10 border border-white/10 rounded-xl text-[11px] font-medium text-neutral-200 flex items-center justify-center space-x-1.5 transition-all"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-neutral-400" />}
          <span>{copied ? 'Скопировано' : 'JSON Досье'}</span>
        </button>

        <button
          onClick={handleShare}
          className="py-2 px-2 ios-glass hover:bg-white/10 border border-white/10 rounded-xl text-[11px] font-medium text-neutral-200 flex items-center justify-center space-x-1.5 transition-all"
        >
          <Share2 className="w-3.5 h-3.5 text-neutral-400" />
          <span>Поделиться</span>
        </button>
      </div>
    </div>
  );
};
