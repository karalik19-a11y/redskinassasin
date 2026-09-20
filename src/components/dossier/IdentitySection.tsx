import React from 'react';
import type { Dossier } from '../../types/dossier';
import { ShieldCheck, FileCheck, MapPin, Copy, Check } from 'lucide-react';
import { sound } from '../../utils/sound';

interface IdentitySectionProps {
  dossier: Dossier;
}

export const IdentitySection: React.FC<IdentitySectionProps> = ({ dossier }) => {
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    sound.playHapticTap();
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  return (
    <div className="space-y-3">
      {/* Primary Passports & Legal Docs */}
      <div className="ios-glass p-3.5 rounded-2xl border border-white/10 space-y-3">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-red-400" />
            <span className="text-xs font-bold text-white tracking-tight uppercase">
              Паспортные данные & Госуслуги
            </span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 font-semibold bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-500/30">
            ПРОВЕРЕНО МВД РФ
          </span>
        </div>

        <div className="space-y-2.5">
          {dossier.documents.map((doc, idx) => (
            <div
              key={idx}
              className="bg-neutral-950/70 p-2.5 rounded-xl border border-white/5 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <FileCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs font-bold text-neutral-200">{doc.type}</span>
                </div>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${
                    doc.status === 'Действителен'
                      ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                      : 'bg-red-950/60 text-red-400 border border-red-500/30'
                  }`}
                >
                  {doc.status}
                </span>
              </div>

              {/* Number and copy */}
              <div className="flex items-center justify-between bg-black/40 px-2.5 py-1.5 rounded-lg">
                <span className="font-mono text-xs font-bold text-amber-300">
                  {doc.series ? `${doc.series} ` : ''}{doc.number}
                </span>
                <button
                  onClick={() => handleCopy(`${doc.series || ''} ${doc.number}`, `doc-${idx}`)}
                  className="text-neutral-400 hover:text-white transition-colors"
                >
                  {copiedKey === `doc-${idx}` ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Details */}
              <div className="text-[10px] text-neutral-400 space-y-0.5">
                {doc.issuedBy && <div>Кем выдан: {doc.issuedBy}</div>}
                <div className="flex justify-between">
                  <span>Дата выдачи: {doc.issueDate}</span>
                  {doc.departmentCode && <span>Код: {doc.departmentCode}</span>}
                </div>
                {doc.extra &&
                  Object.entries(doc.extra).map(([k, v]) => (
                    <div key={k} className="text-neutral-300 pt-0.5">
                      <span className="text-neutral-400">{k}:</span> {v}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tax & Social Security Identifiers */}
      <div className="grid grid-cols-2 gap-2">
        {/* INN */}
        <div className="ios-glass p-3 rounded-2xl border border-white/10 space-y-1">
          <div className="text-[10px] font-mono text-neutral-400 uppercase">ИНН Физлица</div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-white tracking-wider">
              {dossier.finances.taxId}
            </span>
            <button
              onClick={() => handleCopy(dossier.finances.taxId, 'inn')}
              className="text-neutral-400 hover:text-white"
            >
              {copiedKey === 'inn' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <div className="text-[9px] text-emerald-400 font-mono">ФНС: Активен</div>
        </div>

        {/* SNILS */}
        <div className="ios-glass p-3 rounded-2xl border border-white/10 space-y-1">
          <div className="text-[10px] font-mono text-neutral-400 uppercase">СНИЛС</div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-white tracking-wider">
              {dossier.finances.snils}
            </span>
            <button
              onClick={() => handleCopy(dossier.finances.snils, 'snils')}
              className="text-neutral-400 hover:text-white"
            >
              {copiedKey === 'snils' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <div className="text-[9px] text-emerald-400 font-mono">СФР: Подтвержден</div>
        </div>
      </div>

      {/* Address History / Registration */}
      <div className="ios-glass p-3.5 rounded-2xl border border-white/10 space-y-2">
        <div className="flex items-center space-x-2 text-xs font-bold text-white">
          <MapPin className="w-4 h-4 text-red-400" />
          <span>Адреса постоянной регистрации и проживания</span>
        </div>

        <div className="bg-neutral-950/70 p-2.5 rounded-xl border border-white/5 text-xs text-neutral-200">
          <div className="text-[10px] text-amber-400 font-mono mb-1">ТЕКУЩАЯ ПРОПИСКА</div>
          <div className="font-medium">{dossier.assets.realEstate[0]?.address || dossier.birthPlace}</div>
          <div className="text-[10px] text-neutral-400 mt-1">
            Кадастровый номер: {dossier.assets.realEstate[0]?.cadastralNumber || '77:01:0001024:810'}
          </div>
        </div>
      </div>
    </div>
  );
};
