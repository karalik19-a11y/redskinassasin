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
      <div className="ios-glass p-3.5 rounded-[16px] border border-hair space-y-2.5">
        <div className="flex items-center justify-between border-b border-hair pb-2">
          <div className="flex items-center space-x-2 text-xs font-bold text-white">
            <Database className="w-4 h-4 text-clay" />
            <span className="uppercase">Слитые базы данных (Tomahawk Leaks)</span>
          </div>
          <span className="text-[10px] font-mono text-clay font-bold bg-clay-soft px-2 py-0.5 rounded-full border border-hair">
            {dossier.breaches.length} УТЕЧЕК
          </span>
        </div>

        <p className="text-[11px] text-ink leading-relaxed">
          Обнаружены компрометации личных данных в проиндексированных архивах Darknet и открытых утечках:
        </p>

        <div className="space-y-2.5 pt-1">
          {dossier.breaches.map((b, idx) => (
            <div
              key={idx}
              className="bg-panel p-3 rounded-xl border border-hair space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <AlertOctagon className="w-3.5 h-3.5 text-clay" />
                  <span className="text-xs font-bold text-white">{b.source}</span>
                </div>
                <span className="text-[9px] font-mono text-muted">{b.date}</span>
              </div>

              <div className="space-y-1.5 text-[11px]">
                {/* Leaked Address */}
                {b.leakedData.address && (
                  <div className="bg-panel p-2 rounded-lg text-ink">
                    <span className="text-muted text-[10px] block">АДРЕС ДОСТАВКИ:</span>
                    <span className="text-gold font-medium">{b.leakedData.address}</span>
                  </div>
                )}

                {/* Clear Password or Hash */}
                {b.leakedData.clearPassword && (
                  <div className="flex items-center justify-between bg-clay-soft p-2 rounded-lg border border-hair">
                    <div>
                      <span className="text-clay text-[10px] block font-mono">СЛИТЫЙ ПАРОЛЬ:</span>
                      <span className="font-mono font-bold text-white">
                        {unmaskedPasswords[idx] ? b.leakedData.clearPassword : '••••••••••••'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => togglePassword(idx)}
                        className="text-muted hover:text-white"
                      >
                        {unmaskedPasswords[idx] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleCopy(b.leakedData.clearPassword!, `pass-${idx}`)}
                        className="text-muted hover:text-white"
                      >
                        {copiedKey === `pass-${idx}` ? (
                          <Check className="w-4 h-4 text-sage" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Password Hash */}
                {b.leakedData.passwordHash && !b.leakedData.clearPassword && (
                  <div className="bg-panel p-2 rounded-lg text-muted font-mono text-[10px]">
                    <span className="text-muted block">ХЭШ ПАРОЛЯ:</span>
                    <span className="text-ink truncate block">{b.leakedData.passwordHash}</span>
                  </div>
                )}

                {/* Amount Spent & Notes */}
                {b.leakedData.amountSpent && (
                  <div className="text-[10px] text-muted">
                    Сумма расходов в сервисе: <span className="text-sage font-bold">{b.leakedData.amountSpent}</span>
                  </div>
                )}

                {b.leakedData.notes && (
                  <div className="text-[10px] text-ink italic bg-panel p-1.5 rounded">
                    «{b.leakedData.notes}»
                  </div>
                )}

                {b.leakedData.deviceInfo && (
                  <div className="text-[9px] text-muted font-mono">
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
