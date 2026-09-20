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
      <div className="ios-glass p-3.5 rounded-2xl border border-white/10 space-y-3">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center space-x-2">
            <Phone className="w-4 h-4 text-red-400" />
            <span className="text-xs font-bold text-white tracking-tight uppercase">
              Мобильные номера & Идентификаторы
            </span>
          </div>
          <span className="text-[10px] font-mono text-amber-400 font-bold">
            {dossier.telecom.length} Линии
          </span>
        </div>

        <div className="space-y-2.5">
          {dossier.telecom.map((tel, idx) => (
            <div
              key={idx}
              className="bg-neutral-950/70 p-2.5 rounded-xl border border-white/5 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono font-bold text-white tracking-wide">
                    {tel.number}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 bg-red-950/50 text-red-300 rounded border border-red-500/30 font-mono">
                    {tel.operator}
                  </span>
                </div>

                <button
                  onClick={() => handleCopy(tel.number, `tel-${idx}`)}
                  className="text-neutral-400 hover:text-white transition-colors"
                >
                  {copiedKey === `tel-${idx}` ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Hardware IMSI/IMEI */}
              <div className="bg-black/50 p-2 rounded-lg text-[10px] font-mono text-neutral-400 space-y-0.5">
                <div className="flex justify-between">
                  <span>IMSI:</span>
                  <span className="text-neutral-300">{tel.imsi}</span>
                </div>
                <div className="flex justify-between">
                  <span>IMEI:</span>
                  <span className="text-amber-300/90">{tel.imei}</span>
                </div>
                <div className="flex justify-between">
                  <span>Регион:</span>
                  <span className="text-neutral-300">{tel.region}</span>
                </div>
              </div>

              {/* Tags from Caller ID Leaks (GetContact) */}
              {tel.tags && tel.tags.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[9px] font-mono text-neutral-400 uppercase flex items-center space-x-1">
                    <Hash className="w-3 h-3 text-red-400" />
                    <span>Теги в телефонных книгах (GetContact/NumBuster):</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {tel.tags.map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        className="px-2 py-0.5 bg-neutral-900 border border-white/10 rounded-md text-[9px] text-amber-200"
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
        <div className="ios-glass p-3.5 rounded-2xl border border-white/10 space-y-2.5">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-bold text-white tracking-tight uppercase">
                Telegram Профиль & Слитые Чаты
              </span>
            </div>
            <span className="text-[9px] font-mono text-sky-300 bg-sky-950/60 px-2 py-0.5 rounded-full border border-sky-500/30">
              ID: {dossier.telegram.id}
            </span>
          </div>

          <div className="bg-neutral-950/70 p-2.5 rounded-xl border border-white/5 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-white">
                {dossier.telegram.firstName} {dossier.telegram.lastName || ''}{' '}
                <span className="text-sky-400 font-mono">@{dossier.telegram.username}</span>
              </div>
              <span className="text-[9px] font-mono text-amber-400 font-bold">
                {dossier.telegram.leakedMessagesCount} слитых сообщений
              </span>
            </div>

            {dossier.telegram.bio && (
              <p className="text-[11px] text-neutral-300 italic">«{dossier.telegram.bio}»</p>
            )}

            {dossier.telegram.lastSeen && (
              <div className="text-[10px] text-neutral-400">
                Последний визит: {dossier.telegram.lastSeen}
              </div>
            )}

            {/* Leaked Groups */}
            <div className="pt-1 space-y-1">
              <div className="text-[9px] font-mono text-neutral-400 uppercase">
                Зафиксирован в закрытых группах / каналах:
              </div>
              <div className="space-y-1">
                {dossier.telegram.groups.map((grp, gIdx) => (
                  <div
                    key={gIdx}
                    className="flex items-center space-x-1.5 text-[10px] text-neutral-300 bg-black/40 px-2 py-1 rounded-md"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
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
        <div className="ios-glass p-3 rounded-2xl border border-white/10 space-y-1.5">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-white">
            <Mail className="w-3.5 h-3.5 text-red-400" />
            <span>Email адреса</span>
          </div>
          <div className="space-y-1">
            {dossier.emails.map((em, eIdx) => (
              <div
                key={eIdx}
                className="text-[10px] font-mono text-neutral-300 bg-neutral-950/80 p-1.5 rounded-lg border border-white/5 truncate"
              >
                {em}
              </div>
            ))}
          </div>
        </div>

        {/* IP logs */}
        <div className="ios-glass p-3 rounded-2xl border border-white/10 space-y-1.5">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-white">
            <Globe className="w-3.5 h-3.5 text-amber-400" />
            <span>IP Активность & Провайдеры</span>
          </div>
          <div className="space-y-1">
            {dossier.ipAddresses.map((ipObj, iIdx) => (
              <div
                key={iIdx}
                className="text-[10px] font-mono text-neutral-300 bg-neutral-950/80 p-1.5 rounded-lg border border-white/5"
              >
                <div className="flex justify-between font-bold text-amber-300">
                  <span>{ipObj.ip}</span>
                  <span className="text-neutral-400 text-[9px]">{ipObj.city}</span>
                </div>
                <div className="text-[9px] text-neutral-400 truncate">{ipObj.isp}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
