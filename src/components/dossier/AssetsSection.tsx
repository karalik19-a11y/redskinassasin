import React from 'react';
import type { Dossier } from '../../types/dossier';
import { Car, Home, Copy, Check, AlertTriangle } from 'lucide-react';
import { sound } from '../../utils/sound';

interface AssetsSectionProps {
  dossier: Dossier;
}

export const AssetsSection: React.FC<AssetsSectionProps> = ({ dossier }) => {
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    sound.playHapticTap();
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  return (
    <div className="space-y-3">
      {/* Vehicles (Auto Fleet) */}
      <div className="ios-glass p-3.5 rounded-[16px] border border-hair space-y-2.5">
        <div className="flex items-center justify-between border-b border-hair pb-2">
          <div className="flex items-center space-x-2 text-xs font-bold text-white">
            <Car className="w-4 h-4 text-clay" />
            <span className="uppercase">Автотранспорт & Спецтехника</span>
          </div>
          <span className="text-[10px] font-mono text-gold font-bold">
            {dossier.assets.vehicles.length} ТС
          </span>
        </div>

        <div className="space-y-2.5">
          {dossier.assets.vehicles.map((v, idx) => (
            <div
              key={idx}
              className="bg-panel p-3 rounded-xl border border-hair space-y-2"
            >
              {/* Brand & Plate */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white">{v.brandModel}</div>
                  <div className="text-[10px] text-muted">{v.year} г.в. • {v.color}</div>
                </div>

                {/* Russian License Plate Badge */}
                <div className="flex items-center bg-white text-black font-mono font-semibold text-xs px-2 py-0.5 rounded border-2 border-hair shadow-sm">
                  <span>{v.plate}</span>
                  <span className="ml-1 pl-1 border-l border-hair text-[9px] text-faint">RUS</span>
                </div>
              </div>

              {/* VIN & STS */}
              <div className="bg-panel p-2 rounded-lg text-[10px] font-mono space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted">VIN:</span>
                  <span className="text-gold font-bold">{v.vin}</span>
                  <button
                    onClick={() => handleCopy(v.vin, `vin-${idx}`)}
                    className="text-muted hover:text-white"
                  >
                    {copiedKey === `vin-${idx}` ? (
                      <Check className="w-3 h-3 text-sage" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>

                <div className="flex justify-between text-muted">
                  <span>СТС: {v.stsNumber}</span>
                  <span>ОСАГО: {v.osagoNumber}</span>
                </div>
              </div>

              {/* Fines */}
              <div className="flex items-center justify-between text-[10px] pt-0.5">
                <span className="flex items-center space-x-1 text-gold">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Штрафы ГИБДД: {v.finesCount} шт ({v.finesSum})</span>
                </span>
                <span className="text-sage font-mono text-[9px]">{v.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Real Estate Property */}
      <div className="ios-glass p-3.5 rounded-[16px] border border-hair space-y-2.5">
        <div className="flex items-center justify-between border-b border-hair pb-2">
          <div className="flex items-center space-x-2 text-xs font-bold text-white">
            <Home className="w-4 h-4 text-clay" />
            <span className="uppercase">Недвижимость & Земельные участки</span>
          </div>
          <span className="text-[10px] font-mono text-gold font-bold">
            {dossier.assets.realEstate.length} Объекта
          </span>
        </div>

        <div className="space-y-2.5">
          {dossier.assets.realEstate.map((re, rIdx) => (
            <div
              key={rIdx}
              className="bg-panel p-3 rounded-xl border border-hair space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gold">{re.type}</span>
                <span className="text-xs font-bold text-white font-mono">{re.estimatedPrice}</span>
              </div>

              <div className="text-xs text-ink font-medium leading-snug">{re.address}</div>

              <div className="bg-panel p-2 rounded-lg text-[10px] font-mono text-muted space-y-0.5">
                <div className="flex justify-between">
                  <span>Кадастровый номер:</span>
                  <span className="text-ink">{re.cadastralNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Площадь:</span>
                  <span className="text-white font-bold">{re.areaSqMeters} м²</span>
                </div>
                <div className="flex justify-between">
                  <span>Доля владения:</span>
                  <span className="text-sage">{re.ownershipShare}</span>
                </div>
                {re.encumbrance && (
                  <div className="text-muted pt-0.5">Обременение: {re.encumbrance}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
