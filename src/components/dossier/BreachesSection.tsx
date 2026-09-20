import React, { useState } from 'react';
import type { Dossier } from '../../types/dossier';
import { Database, AlertOctagon, Eye, EyeOff, Copy, Check } from 'lucide-react';
import { sound } from '../../utils/sound';

interface BreachesSectionProps {
  dossier: Dossier;
}

export const BreachesSection: React.FC<BreachesSectionProps> = ({ dossier }) => {
  const [unmaskedPasswords, setUnmaskedPasswords] = useState<Record<number, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const togglePassword = (idx: number) => {
    sound.playHapticTap();
    setUnmaskedPasswords((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleCopy = (text: string, key: string) => {
    sound.playHapticTap();
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  return (
    <div className="space-y-3">
      {/* Breaches Banner */}
      <div className="ios-glass p-3.5 rounded-2xl border border-red-500/30 space-y-2.5">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center space-x-2 text-xs font-bold text-white">
            <Database className="w-4 h-4 text-red-500" />
            <span className="uppercase">Слитые базы данных (Tomahawk Leaks)</span>
          </div>
          <span className="text-[10px] font-mono text-red-400 font-bold bg-red-950/60 px-2 py-0.5 rounded-full border border-red-500/40">
            {dossier.breaches.length} УТЕЧЕК
          </span>
        </div>

        <p className="text-[11px] text-neutral-300 leading-relaxed">
          Обнаружены компрометации личных данных в проиндексированных архивах Darknet и открытых утечках:
        </p>

        <div className="space-y-2.5 pt-1">
          {dossier.breaches.map((b, idx) => (
            <div
              key={idx}
              className="bg-neutral-950/85 p-3 rounded-xl border border-red-500/20 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <AlertOctagon className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-xs font-bold text-white">{b.source}</span>
                </div>
                <span className="text-[9px] font-mono text-neutral-400">{b.date}</span>
              </div>

              <div className="space-y-1.5 text-[11px]">
                {/* Leaked Address */}
                {b.leakedData.address && (
                  <div className="bg-black/50 p-2 rounded-lg text-neutral-300">
                    <span className="text-neutral-500 text-[10px] block">АДРЕС ДОСТАВКИ:</span>
                    <span className="text-amber-200 font-medium">{b.leakedData.address}</span>
                  </div>
                )}

                {/* Clear Password or Hash */}
                {b.leakedData.clearPassword && (
                  <div className="flex items-center justify-between bg-red-950/30 p-2 rounded-lg border border-red-500/30">
                    <div>
                      <span className="text-red-400 text-[10px] block font-mono">СЛИТЫЙ ПАРОЛЬ:</span>
                      <span className="font-mono font-bold text-white">
                        {unmaskedPasswords[idx] ? b.leakedData.clearPassword : '••••••••••••'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => togglePassword(idx)}
                        className="text-neutral-400 hover:text-white"
                      >
                        {unmaskedPasswords[idx] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleCopy(b.leakedData.clearPassword!, `pass-${idx}`)}
                        className="text-neutral-400 hover:text-white"
                      >
                        {copiedKey === `pass-${idx}` ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Password Hash */}
                {b.leakedData.passwordHash && !b.leakedData.clearPassword && (
                  <div className="bg-black/50 p-2 rounded-lg text-neutral-400 font-mono text-[10px]">
                    <span className="text-neutral-500 block">ХЭШ ПАРОЛЯ:</span>
                    <span className="text-neutral-300 truncate block">{b.leakedData.passwordHash}</span>
                  </div>
                )}

                {/* Amount Spent & Notes */}
                {b.leakedData.amountSpent && (
                  <div className="text-[10px] text-neutral-400">
                    Сумма расходов в сервисе: <span className="text-emerald-400 font-bold">{b.leakedData.amountSpent}</span>
                  </div>
                )}

                {b.leakedData.notes && (
                  <div className="text-[10px] text-neutral-300 italic bg-black/30 p-1.5 rounded">
                    «{b.leakedData.notes}»
                  </div>
                )}

                {b.leakedData.deviceInfo && (
                  <div className="text-[9px] text-neutral-500 font-mono">
                    Устройство: {b.leakedData.deviceInfo}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
