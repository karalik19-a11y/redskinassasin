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
      <div className="ios-glass-accent p-3.5 rounded-[16px] border border-hair space-y-1 text-center">
        <div className="text-[10px] font-mono text-gold font-bold uppercase tracking-wider flex items-center justify-center space-x-1">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>ОЦЕНОЧНЫЙ СОВОКУПНЫЙ КАПИТАЛ</span>
        </div>
        <div className="text-xl font-semibold text-white tracking-tight ">
          {dossier.finances.estimatedNetWorth}
        </div>
        <div className="text-[9px] text-muted font-mono">
          На основе балансов счетов, криптоактивов и реестров Росреестра
        </div>
      </div>

      {/* Bank Accounts */}
      <div className="ios-glass p-3.5 rounded-[16px] border border-hair space-y-2.5">
        <div className="flex items-center space-x-2 text-xs font-bold text-white border-b border-hair pb-2">
          <Landmark className="w-4 h-4 text-clay" />
          <span className="uppercase">Банковские счета & Депозиты</span>
        </div>

        <div className="space-y-2">
          {dossier.finances.banks.map((b, idx) => (
            <div
              key={idx}
              className="bg-panel p-2.5 rounded-xl border border-hair space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">{b.bank}</span>
                <span className="text-[9px] font-mono text-sage bg-sage-soft px-1.5 py-0.2 rounded border border-hair">
                  {b.status}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-muted">{b.accountMasked}</span>
                <span className="font-bold text-gold font-mono">{b.balanceEstimated}</span>
              </div>

              <div className="text-[9px] text-muted flex justify-between">
                <span>Валюта: {b.currency}</span>
                <span>Открыт: {b.openDate}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Crypto Wallets */}
      {dossier.finances.crypto.length > 0 && (
        <div className="ios-glass p-3.5 rounded-[16px] border border-hair space-y-2.5">
          <div className="flex items-center justify-between border-b border-hair pb-2">
            <div className="flex items-center space-x-2 text-xs font-bold text-white">
              <Coins className="w-4 h-4 text-gold" />
              <span className="uppercase">Крипто-кошельки & Darknet Шлюзы</span>
            </div>
            <span className="text-[9px] font-mono text-clay font-bold">
              {dossier.finances.crypto.length} Адреса
            </span>
          </div>

          <div className="space-y-2">
            {dossier.finances.crypto.map((c, cIdx) => (
              <div
                key={cIdx}
                className="bg-panel p-2.5 rounded-xl border border-hair space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gold">{c.network}</span>
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${
                      c.riskCategory.includes('Darknet') || c.riskCategory.includes('Миксер')
                        ? 'bg-clay-soft text-clay border border-hair'
                        : 'bg-panel text-ink border border-hair'
                    }`}
                  >
                    {c.riskCategory}
                  </span>
                </div>

                {/* Address & Copy */}
                <div className="flex items-center justify-between bg-panel p-1.5 rounded-lg">
                  <span className="text-[10px] font-mono text-ink truncate max-w-[240px]">
                    {c.address}
                  </span>
                  <button
                    onClick={() => handleCopy(c.address, `crypto-${cIdx}`)}
                    className="text-muted hover:text-white"
                  >
                    {copiedKey === `crypto-${cIdx}` ? (
                      <Check className="w-3.5 h-3.5 text-sage" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-white font-bold">{c.balance}</span>
                  <span className="text-muted">{c.totalTx} транзакций</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Business Entities / Companies */}
      <div className="ios-glass p-3.5 rounded-[16px] border border-hair space-y-2.5">
        <div className="flex items-center space-x-2 text-xs font-bold text-white border-b border-hair pb-2">
          <Building2 className="w-4 h-4 text-clay" />
          <span className="uppercase">Юридические лица & Доли в бизнесе</span>
        </div>

        <div className="space-y-2">
          {dossier.finances.companies.map((comp, kIdx) => (
            <div
              key={kIdx}
              className="bg-panel p-2.5 rounded-xl border border-hair space-y-1 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-white truncate max-w-[200px]">{comp.name}</span>
                <span className="text-[9px] font-mono text-sage bg-sage-soft px-1.5 py-0.2 rounded border border-hair">
                  {comp.status}
                </span>
              </div>

              <div className="text-gold text-[11px] font-medium">{comp.role}</div>

              <div className="text-[10px] font-mono text-muted space-y-0.5">
                <div className="flex justify-between">
                  <span>ИНН: {comp.inn}</span>
                  <span>ОГРН: {comp.ogrn}</span>
                </div>
                <div className="text-ink">Выручка: {comp.revenueYear}</div>
                <div className="text-muted">Дата рег.: {comp.registrationDate}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
