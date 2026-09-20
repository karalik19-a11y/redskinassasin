import React from 'react';
import type { Dossier } from '../../types/dossier';
import { Phone, MessageSquare, Mail, Globe, Copy, Check, Hash } from 'lucide-react';
import { sound } from '../../utils/sound';

interface TelecomSectionProps {
  dossier: Dossier;
}

export const TelecomSection: React.FC<TelecomSectionProps> = ({ dossier }) => {
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    sound.playHapticTap();
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  return (
    <div className="space-y-3">
      {/* Phone Numbers with IMSI / IMEI / Tags */}
      <div className="ios-glass p-3.5 rounded-[16px] border border-hair space-y-3">
        <div className="flex items-center justify-between border-b border-hair pb-2">
          <div className="flex items-center space-x-2">
            <Phone className="w-4 h-4 text-clay" />
            <span className="text-xs font-bold text-white tracking-tight uppercase">
              Мобильные номера & Идентификаторы
            </span>
          </div>
          <span className="text-[10px] font-mono text-gold font-bold">
            {dossier.telecom.length} Линии
          </span>
        </div>

        <div className="space-y-2.5">
          {dossier.telecom.map((tel, idx) => (
            <div
              key={idx}
              className="bg-panel p-2.5 rounded-xl border border-hair space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono font-bold text-white tracking-wide">
                    {tel.number}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 bg-clay-soft text-clay rounded border border-hair font-mono">
                    {tel.operator}
                  </span>
                </div>

                <button
                  onClick={() => handleCopy(tel.number, `tel-${idx}`)}
                  className="text-muted hover:text-white transition-colors"
                >
                  {copiedKey === `tel-${idx}` ? (
                    <Check className="w-3.5 h-3.5 text-sage" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Hardware IMSI/IMEI */}
              <div className="bg-panel p-2 rounded-lg text-[10px] font-mono text-muted space-y-0.5">
                <div className="flex justify-between">
                  <span>IMSI:</span>
                  <span className="text-ink">{tel.imsi}</span>
                </div>
                <div className="flex justify-between">
                  <span>IMEI:</span>
                  <span className="text-gold">{tel.imei}</span>
                </div>
                <div className="flex justify-between">
                  <span>Регион:</span>
                  <span className="text-ink">{tel.region}</span>
                </div>
              </div>

              {/* Tags from Caller ID Leaks (GetContact) */}
              {tel.tags && tel.tags.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[9px] font-mono text-muted uppercase flex items-center space-x-1">
                    <Hash className="w-3 h-3 text-clay" />
                    <span>Теги в телефонных книгах (GetContact/NumBuster):</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {tel.tags.map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        className="px-2 py-0.5 bg-panel border border-hair rounded-md text-[9px] text-gold"
                      >
                        «{tag}»
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Telegram Intelligence Card */}
      {dossier.telegram && (
        <div className="ios-glass p-3.5 rounded-[16px] border border-hair space-y-2.5">
          <div className="flex items-center justify-between border-b border-hair pb-2">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-violet-ink" />
              <span className="text-xs font-bold text-white tracking-tight uppercase">
                Telegram Профиль & Слитые Чаты
              </span>
            </div>
            <span className="text-[9px] font-mono text-violet-ink bg-violet-soft px-2 py-0.5 rounded-full border border-hair">
              ID: {dossier.telegram.id}
            </span>
          </div>

          <div className="bg-panel p-2.5 rounded-xl border border-hair space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-white">
                {dossier.telegram.firstName} {dossier.telegram.lastName || ''}{' '}
                <span className="text-violet-ink font-mono">@{dossier.telegram.username}</span>
              </div>
              <span className="text-[9px] font-mono text-gold font-bold">
                {dossier.telegram.leakedMessagesCount} слитых сообщений
              </span>
            </div>

            {dossier.telegram.bio && (
              <p className="text-[11px] text-ink italic">«{dossier.telegram.bio}»</p>
            )}

            {dossier.telegram.lastSeen && (
              <div className="text-[10px] text-muted">
                Последний визит: {dossier.telegram.lastSeen}
              </div>
            )}

            {/* Leaked Groups */}
            <div className="pt-1 space-y-1">
              <div className="text-[9px] font-mono text-muted uppercase">
                Зафиксирован в закрытых группах / каналах:
              </div>
              <div className="space-y-1">
                {dossier.telegram.groups.map((grp, gIdx) => (
                  <div
                    key={gIdx}
                    className="flex items-center space-x-1.5 text-[10px] text-ink bg-panel px-2 py-1 rounded-md"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-soft" />
                    <span>{grp}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Emails & IP Traces */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {/* Emails */}
        <div className="ios-glass p-3 rounded-[16px] border border-hair space-y-1.5">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-white">
            <Mail className="w-3.5 h-3.5 text-clay" />
            <span>Email адреса</span>
          </div>
          <div className="space-y-1">
            {dossier.emails.map((em, eIdx) => (
              <div
                key={eIdx}
                className="text-[10px] font-mono text-ink bg-panel p-1.5 rounded-lg border border-hair truncate"
              >
                {em}
              </div>
            ))}
          </div>
        </div>

        {/* IP logs */}
        <div className="ios-glass p-3 rounded-[16px] border border-hair space-y-1.5">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-white">
            <Globe className="w-3.5 h-3.5 text-gold" />
            <span>IP Активность & Провайдеры</span>
          </div>
          <div className="space-y-1">
            {dossier.ipAddresses.map((ipObj, iIdx) => (
              <div
                key={iIdx}
                className="text-[10px] font-mono text-ink bg-panel p-1.5 rounded-lg border border-hair"
              >
                <div className="flex justify-between font-bold text-gold">
                  <span>{ipObj.ip}</span>
                  <span className="text-muted text-[9px]">{ipObj.city}</span>
                </div>
                <div className="text-[9px] text-muted truncate">{ipObj.isp}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
