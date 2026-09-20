import React, { useState } from 'react';
import type { Dossier, GeoMovement } from '../../types/dossier';
import { Plane, MapPin, Navigation, Compass } from 'lucide-react';
import { sound } from '../../utils/sound';

interface EagleEyeMapProps {
  dossier: Dossier;
}

export const EagleEyeMap: React.FC<EagleEyeMapProps> = ({ dossier }) => {
  const [selectedGeo, setSelectedGeo] = useState<GeoMovement | null>(
    dossier.geoHistory[0] || null
  );

  return (
    <div className="space-y-3">
      {/* Eagle Eye Header Card */}
      <div className="ios-glass p-3.5 rounded-2xl border border-white/10 space-y-3">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center space-x-2 text-xs font-bold text-white">
            <Compass className="w-4 h-4 text-amber-400" />
            <span className="uppercase">Орлиный Глаз // Гео-разведка & Маршруты</span>
          </div>
          <span className="text-[10px] font-mono text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-500/40">
            GPS / CELL INTERCEPT
          </span>
        </div>

        {/* Tactical Map Canvas Simulator */}
        <div className="relative w-full h-48 rounded-2xl overflow-hidden bg-neutral-950 border border-red-500/30 flex items-center justify-center shadow-inner">
          {/* Cyber Grid & Radar Rings */}
          <div className="absolute inset-0 tribal-pattern-bg opacity-30" />
          <div className="absolute w-44 h-44 rounded-full border border-red-500/20 animate-ping duration-3000" />
          <div className="absolute w-32 h-32 rounded-full border border-amber-500/30" />
          <div className="absolute w-16 h-16 rounded-full border border-red-500/40" />

          {/* Crosshair lines */}
          <div className="absolute inset-x-0 top-1/2 h-px bg-red-500/20" />
          <div className="absolute inset-y-0 left-1/2 w-px bg-red-500/20" />

          {/* Geo Points on HUD */}
          {dossier.geoHistory.map((item, idx) => {
            const isSelected = selectedGeo?.id === item.id;
            const posX = 20 + ((idx * 37) % 60);
            const posY = 20 + ((idx * 43) % 55);

            return (
              <button
                key={item.id}
                onClick={() => {
                  sound.playHapticTap();
                  setSelectedGeo(item);
                }}
                style={{ left: `${posX}%`, top: `${posY}%` }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 group p-1 transition-transform ${
                  isSelected ? 'scale-125 z-20' : 'hover:scale-110 z-10'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shadow-lg transition-all ${
                    isSelected
                      ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,1)] ring-2 ring-amber-400'
                      : 'bg-neutral-900/90 text-amber-400 border border-amber-500/40'
                  }`}
                >
                  {item.category === 'Аэропорт' ? (
                    <Plane className="w-3.5 h-3.5" />
                  ) : (
                    <MapPin className="w-3.5 h-3.5" />
                  )}
                </div>
              </button>
            );
          })}

          {/* Selected Point Overlay Box */}
          <div className="absolute bottom-2 left-2 right-2 p-2 bg-black/85 backdrop-blur-md rounded-xl border border-white/10 text-xs flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] text-amber-400 font-mono flex items-center space-x-1">
                <Navigation className="w-3 h-3" />
                <span>
                  {selectedGeo?.date} • {selectedGeo?.time} ({selectedGeo?.source})
                </span>
              </div>
              <div className="font-bold text-white truncate">{selectedGeo?.locationName}</div>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 shrink-0 ml-2">
              [{selectedGeo?.coordinates[0].toFixed(2)}, {selectedGeo?.coordinates[1].toFixed(2)}]
            </span>
          </div>
        </div>

        {/* Timeline List of Movements */}
        <div className="space-y-2 pt-1">
          <div className="text-[10px] font-mono text-neutral-400 uppercase">
            Хронологическая лента перемещений:
          </div>

          <div className="space-y-2">
            {dossier.geoHistory.map((geo) => (
              <div
                key={geo.id}
                onClick={() => {
                  sound.playHapticTap();
                  setSelectedGeo(geo);
                }}
                className={`cursor-pointer p-2.5 rounded-xl border transition-all text-xs ${
                  selectedGeo?.id === geo.id
                    ? 'bg-red-950/40 border-red-500/60 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                    : 'bg-neutral-950/70 border-white/5 hover:border-white/20 text-neutral-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-white">{geo.locationName}</span>
                  <span className="text-[9px] font-mono text-amber-400">{geo.date} {geo.time}</span>
                </div>

                <div className="text-[10px] text-neutral-400 flex justify-between">
                  <span>Источник: {geo.source}</span>
                  <span className="text-emerald-400 font-medium">{geo.category}</span>
                </div>

                {geo.details && (
                  <div className="text-[10px] text-neutral-300 italic pt-1 border-t border-white/5 mt-1">
                    {geo.details}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
