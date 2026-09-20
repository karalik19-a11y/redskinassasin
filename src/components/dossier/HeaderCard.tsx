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
    <div className="relative overflow-hidden rounded-[20px] ios-glass-card p-4 border border-hair space-y-3.5 select-none">
      {/* Top Threat & Classification Stamp */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-clay animate-pulse-totem" />
          <span className="text-[10px] font-mono font-bold text-clay uppercase tracking-wider">
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
        <div className="relative w-20 h-20 rounded-[16px] overflow-hidden shrink-0 border-2 border-hair shadow-[0_10px_30px_rgba(0,0,0,.28)]">
          <img
            src={dossier.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80'}
            alt={dossier.fio.full}
            className="w-full h-full object-cover"
          />

          {/* Warpaint Facial Glitch Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
          <div className="absolute bottom-1 left-1 px-1 py-0.2 bg-clay text-[8px] font-bold font-mono text-white rounded">
            {dossier.biometricMatchRate}%
          </div>
        </div>

        {/* FIO & Totem Details */}
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-white tracking-tight leading-tight ">
            {dossier.fio.full}
          </h2>

          {/* Totem Animal Subtitle */}
          <div className="flex items-center space-x-1.5 mt-1 text-gold font-mono text-[11px] font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-gold shrink-0" />
            <span className="truncate">{dossier.totemTitle}</span>
          </div>

          <div className="text-[10px] text-muted flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
            <span>{dossier.birthDate} ({dossier.age} лет)</span>
            <span>•</span>
            <span className="text-gold">{dossier.zodiac}</span>
            <span>•</span>
            <span className="truncate">{dossier.birthPlace}</span>
          </div>

          {/* Aliases */}
          {dossier.aliases.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {dossier.aliases.slice(0, 3).map((alias, i) => (
                <span
                  key={i}
                  className="px-1.5 py-0.2 bg-white/5 border border-hair rounded-md text-[9px] font-mono text-ink"
                >
                  @{alias}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Summary note */}
      <p className="text-xs text-ink bg-panel p-2.5 rounded-xl border border-hair leading-relaxed">
        {dossier.summary}
      </p>

      {/* Quick Action Toolbar */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        <button
          onClick={handleExportPDF}
          className="py-2 px-2 bg-gradient-to-r from-[#c2664f] to-[#a8834c] hover:bg-clay/60 border border-hair rounded-xl text-[11px] font-bold text-white flex items-center justify-center space-x-1.5 transition-all shadow-[0_10px_30px_rgba(0,0,0,.28)]"
        >
          <Download className="w-3.5 h-3.5 text-gold" />
          <span>Экспорт PDF</span>
        </button>

        <button
          onClick={handleCopyJSON}
          className="py-2 px-2 ios-glass hover:bg-white/10 border border-hair rounded-xl text-[11px] font-medium text-ink flex items-center justify-center space-x-1.5 transition-all"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-sage" /> : <Copy className="w-3.5 h-3.5 text-muted" />}
          <span>{copied ? 'Скопировано' : 'JSON Досье'}</span>
        </button>

        <button
          onClick={handleShare}
          className="py-2 px-2 ios-glass hover:bg-white/10 border border-hair rounded-xl text-[11px] font-medium text-ink flex items-center justify-center space-x-1.5 transition-all"
        >
          <Share2 className="w-3.5 h-3.5 text-muted" />
          <span>Поделиться</span>
        </button>
      </div>
    </div>
  );
};
