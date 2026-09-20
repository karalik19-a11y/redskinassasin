import React from 'react';
import type { Dossier } from '../../types/dossier';
import { Landmark, Coins, Building2, TrendingUp, Copy, Check } from 'lucide-react';
import { sound } from '../../utils/sound';

interface FinanceSectionProps {
  dossier: Dossier;
}

export const FinanceSection: React.FC<FinanceSectionProps> = ({ dossier }) => {
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    sound.playHapticTap();
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  return (
    <div className="space-y-3">
      {/* Estimated Capital Card */}
      <div className="ios-glass-accent p-3.5 rounded-2xl border border-amber-500/40 space-y-1 text-center">
        <div className="text-[10px] font-mono text-amber-300 font-bold uppercase tracking-wider flex items-center justify-center space-x-1">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>ОЦЕНОЧНЫЙ СОВОКУПНЫЙ КАПИТАЛ</span>
        </div>
        <div className="text-xl font-black text-white tracking-tight cyber-gold-glow">
          {dossier.finances.estimatedNetWorth}
        </div>
        <div className="text-[9px] text-neutral-400 font-mono">
          На основе балансов счетов, криптоактивов и реестров Росреестра
        </div>
      </div>

      {/* Bank Accounts */}
      <div className="ios-glass p-3.5 rounded-2xl border border-white/10 space-y-2.5">
        <div className="flex items-center space-x-2 text-xs font-bold text-white border-b border-white/10 pb-2">
          <Landmark className="w-4 h-4 text-red-400" />
          <span className="uppercase">Банковские счета & Депозиты</span>
        </div>

        <div className="space-y-2">
          {dossier.finances.banks.map((b, idx) => (
            <div
              key={idx}
              className="bg-neutral-950/70 p-2.5 rounded-xl border border-white/5 space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">{b.bank}</span>
                <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/50 px-1.5 py-0.2 rounded border border-emerald-500/30">
                  {b.status}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-neutral-400">{b.accountMasked}</span>
                <span className="font-bold text-amber-300 font-mono">{b.balanceEstimated}</span>
              </div>

              <div className="text-[9px] text-neutral-500 flex justify-between">
                <span>Валюта: {b.currency}</span>
                <span>Открыт: {b.openDate}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Crypto Wallets */}
      {dossier.finances.crypto.length > 0 && (
        <div className="ios-glass p-3.5 rounded-2xl border border-white/10 space-y-2.5">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center space-x-2 text-xs font-bold text-white">
              <Coins className="w-4 h-4 text-amber-400" />
              <span className="uppercase">Крипто-кошельки & Darknet Шлюзы</span>
            </div>
            <span className="text-[9px] font-mono text-red-400 font-bold">
              {dossier.finances.crypto.length} Адреса
            </span>
          </div>

          <div className="space-y-2">
            {dossier.finances.crypto.map((c, cIdx) => (
              <div
                key={cIdx}
                className="bg-neutral-950/70 p-2.5 rounded-xl border border-white/5 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300">{c.network}</span>
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${
                      c.riskCategory.includes('Darknet') || c.riskCategory.includes('Миксер')
                        ? 'bg-red-950/60 text-red-400 border border-red-500/40'
                        : 'bg-neutral-900 text-neutral-300 border border-white/10'
                    }`}
                  >
                    {c.riskCategory}
                  </span>
                </div>

                {/* Address & Copy */}
                <div className="flex items-center justify-between bg-black/50 p-1.5 rounded-lg">
                  <span className="text-[10px] font-mono text-neutral-300 truncate max-w-[240px]">
                    {c.address}
                  </span>
                  <button
                    onClick={() => handleCopy(c.address, `crypto-${cIdx}`)}
                    className="text-neutral-400 hover:text-white"
                  >
                    {copiedKey === `crypto-${cIdx}` ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-white font-bold">{c.balance}</span>
                  <span className="text-neutral-400">{c.totalTx} транзакций</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Business Entities / Companies */}
      <div className="ios-glass p-3.5 rounded-2xl border border-white/10 space-y-2.5">
        <div className="flex items-center space-x-2 text-xs font-bold text-white border-b border-white/10 pb-2">
          <Building2 className="w-4 h-4 text-red-400" />
          <span className="uppercase">Юридические лица & Доли в бизнесе</span>
        </div>

        <div className="space-y-2">
          {dossier.finances.companies.map((comp, kIdx) => (
            <div
              key={kIdx}
              className="bg-neutral-950/70 p-2.5 rounded-xl border border-white/5 space-y-1 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-white truncate max-w-[200px]">{comp.name}</span>
                <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/50 px-1.5 py-0.2 rounded border border-emerald-500/30">
                  {comp.status}
                </span>
              </div>

              <div className="text-amber-300 text-[11px] font-medium">{comp.role}</div>

              <div className="text-[10px] font-mono text-neutral-400 space-y-0.5">
                <div className="flex justify-between">
                  <span>ИНН: {comp.inn}</span>
                  <span>ОГРН: {comp.ogrn}</span>
                </div>
                <div className="text-neutral-300">Выручка: {comp.revenueYear}</div>
                <div className="text-neutral-500">Дата рег.: {comp.registrationDate}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
