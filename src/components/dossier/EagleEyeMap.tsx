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
      <div className="ios-glass p-3.5 rounded-[16px] border border-hair space-y-3">
        <div className="flex items-center justify-between border-b border-hair pb-2">
          <div className="flex items-center space-x-2 text-xs font-bold text-white">
            <Compass className="w-4 h-4 text-gold" />
            <span className="uppercase">Орлиный Глаз // Гео-разведка & Маршруты</span>
          </div>
          <span className="text-[10px] font-mono text-gold bg-gold-soft px-2 py-0.5 rounded-full border border-hair">
            GPS / CELL INTERCEPT
          </span>
        </div>

        {/* Tactical Map Canvas Simulator */}
        <div className="relative w-full h-48 rounded-[16px] overflow-hidden bg-panel border border-hair flex items-center justify-center shadow-inner">
          {/* Cyber Grid & Radar Rings */}
          <div className="absolute inset-0 tribal-pattern-bg opacity-30" />
          <div className="absolute w-44 h-44 rounded-full border border-hair animate-pulse-totem duration-3000" />
          <div className="absolute w-32 h-32 rounded-full border border-hair" />
          <div className="absolute w-16 h-16 rounded-full border border-hair" />

          {/* Crosshair lines */}
          <div className="absolute inset-x-0 top-1/2 h-px bg-clay/20" />
          <div className="absolute inset-y-0 left-1/2 w-px bg-clay/20" />

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
                      ? 'bg-clay text-white shadow-[0_10px_30px_rgba(0,0,0,.28)] ring-2 ring-amber-400'
                      : 'bg-panel text-gold border border-hair'
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
          <div className="absolute bottom-2 left-2 right-2 p-2 bg-panel backdrop-blur-md rounded-xl border border-hair text-xs flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] text-gold font-mono flex items-center space-x-1">
                <Navigation className="w-3 h-3" />
                <span>
                  {selectedGeo?.date} • {selectedGeo?.time} ({selectedGeo?.source})
                </span>
              </div>
              <div className="font-bold text-white truncate">{selectedGeo?.locationName}</div>
            </div>
            <span className="text-[10px] font-mono text-sage shrink-0 ml-2">
              [{selectedGeo?.coordinates[0].toFixed(2)}, {selectedGeo?.coordinates[1].toFixed(2)}]
            </span>
          </div>
        </div>

        {/* Timeline List of Movements */}
        <div className="space-y-2 pt-1">
          <div className="text-[10px] font-mono text-muted uppercase">
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
                    ? 'bg-clay-soft border-hair shadow-[0_10px_30px_rgba(0,0,0,.28)]'
                    : 'bg-panel border-hair hover:border-hair text-ink'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-white">{geo.locationName}</span>
                  <span className="text-[9px] font-mono text-gold">{geo.date} {geo.time}</span>
                </div>

                <div className="text-[10px] text-muted flex justify-between">
                  <span>Источник: {geo.source}</span>
                  <span className="text-sage font-medium">{geo.category}</span>
                </div>

                {geo.details && (
                  <div className="text-[10px] text-ink italic pt-1 border-t border-hair mt-1">
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
