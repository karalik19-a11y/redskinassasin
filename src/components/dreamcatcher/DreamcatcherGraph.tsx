import React, { useState } from 'react';
import type { Dossier } from '../../types/dossier';
import { Share2, Sparkles, ZoomIn, ZoomOut, Info, Shield } from 'lucide-react';
import { sound } from '../../utils/sound';

interface DreamcatcherGraphProps {
  dossier: Dossier;
}

interface GraphNode {
  id: string;
  label: string;
  type: 'target' | 'relative' | 'finance' | 'asset' | 'telecom' | 'breach';
  angle: number; // in radians
  radius: number; // distance from center in px
  details: string;
  color: string;
}

export const DreamcatcherGraph: React.FC<DreamcatcherGraphProps> = ({ dossier }) => {
  const [zoom, setZoom] = useState(1);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // Build nodes dynamically from dossier data
  const nodes: GraphNode[] = [
    // Center Target
    {
      id: 'center',
      label: dossier.fio.last + ' ' + dossier.fio.first[0] + '.',
      type: 'target',
      angle: 0,
      radius: 0,
      details: `${dossier.fio.full} [Тотем: ${dossier.totemTitle}]`,
      color: '#ef4444',
    },
  ];

  // Inner Ring: Relatives
  dossier.socialGraph.forEach((rel, i) => {
    const angle = (i * 2 * Math.PI) / Math.max(1, dossier.socialGraph.length);
    nodes.push({
      id: rel.id,
      label: rel.relation,
      type: 'relative',
      angle,
      radius: 85,
      details: `${rel.fio} (${rel.relation}) • ${rel.birthDate}`,
      color: '#f59e0b',
    });
  });

  // Middle Ring: Finances & Assets
  dossier.finances.banks.forEach((b, i) => {
    const angle = 0.5 + (i * 2 * Math.PI) / Math.max(1, dossier.finances.banks.length);
    nodes.push({
      id: `bank-${i}`,
      label: b.bank.split(' ')[1] || 'Банк',
      type: 'finance',
      angle,
      radius: 145,
      details: `${b.bank} [${b.accountMasked}] ~ ${b.balanceEstimated || 'N/A'}`,
      color: '#10b981',
    });
  });

  dossier.assets.vehicles.forEach((v, i) => {
    const angle = 1.2 + (i * 2 * Math.PI) / Math.max(1, dossier.assets.vehicles.length);
    nodes.push({
      id: `car-${i}`,
      label: v.plate,
      type: 'asset',
      angle,
      radius: 145,
      details: `${v.brandModel} (${v.plate}) VIN: ${v.vin}`,
      color: '#06b6d4',
    });
  });

  // Outer Ring: Telecom & Breaches
  dossier.breaches.forEach((br, i) => {
    const angle = 0.2 + (i * 2 * Math.PI) / Math.max(1, dossier.breaches.length);
    nodes.push({
      id: `br-${i}`,
      label: br.source.split(' ')[0],
      type: 'breach',
      angle,
      radius: 195,
      details: `Утечка: ${br.source} (${br.date}) • ${br.leakedData.address || br.leakedData.phone || ''}`,
      color: '#ec4899',
    });
  });

  const handleNodeClick = (node: GraphNode) => {
    sound.playHapticTap();
    setSelectedNode(node);
  };

  return (
    <div className="space-y-3 pb-20 select-none">
      {/* Title */}
      <div className="ios-glass p-3.5 rounded-2xl border border-red-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Share2 className="w-4 h-4 text-red-500" />
            <span className="text-xs font-bold text-white uppercase tracking-tight">
              Ловец Снов // Граф Связей & Нитей
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => {
                sound.playHapticTap();
                setZoom((z) => Math.min(1.4, z + 0.1));
              }}
              className="p-1 text-neutral-400 hover:text-white"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                sound.playHapticTap();
                setZoom((z) => Math.max(0.7, z - 0.1));
              }}
              className="p-1 text-neutral-400 hover:text-white"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Dreamcatcher Interactive Canvas Graph */}
      <div className="relative w-full aspect-square max-h-[460px] rounded-3xl bg-gradient-to-b from-neutral-950 via-[#0a0812] to-neutral-950 border border-red-500/30 overflow-hidden flex items-center justify-center shadow-2xl">
        {/* Background Sacred Geometric Web */}
        <div className="absolute inset-0 tribal-pattern-bg opacity-30 pointer-events-none" />

        {/* Concentric Dreamcatcher Web Rings */}
        <div
          className="relative transition-transform duration-300 ease-out flex items-center justify-center"
          style={{ transform: `scale(${zoom})`, width: '420px', height: '420px' }}
        >
          {/* Circular Rings */}
          <div className="absolute w-[170px] h-[170px] rounded-full border border-amber-500/20 border-dashed" />
          <div className="absolute w-[290px] h-[290px] rounded-full border border-red-500/20" />
          <div className="absolute w-[390px] h-[390px] rounded-full border border-cyan-500/15 border-dotted" />

          {/* Radiating Lines from Center SVG */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 420 420">
            {nodes.map((node) => {
              if (node.id === 'center') return null;
              const cx = 210 + Math.cos(node.angle) * node.radius;
              const cy = 210 + Math.sin(node.angle) * node.radius;

              return (
                <g key={`line-${node.id}`}>
                  <line
                    x1="210"
                    y1="210"
                    x2={cx}
                    y2={cy}
                    stroke={node.color}
                    strokeWidth="1.2"
                    strokeOpacity="0.4"
                    strokeDasharray={node.type === 'breach' ? '4 3' : 'none'}
                  />
                  {/* Subtle pulsing pulse dot along the thread */}
                  <circle cx={(210 + cx) / 2} cy={(210 + cy) / 2} r="1.5" fill={node.color} opacity="0.8" />
                </g>
              );
            })}
          </svg>

          {/* Interactive Nodes */}
          {nodes.map((node) => {
            const isCenter = node.id === 'center';
            const posX = 210 + Math.cos(node.angle) * node.radius;
            const posY = 210 + Math.sin(node.angle) * node.radius;
            const isSelected = selectedNode?.id === node.id;

            return (
              <button
                key={node.id}
                onClick={() => handleNodeClick(node)}
                style={{
                  left: `${posX}px`,
                  top: `${posY}px`,
                }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 group transition-all duration-200 z-10 flex flex-col items-center ${
                  isSelected ? 'scale-125 z-30' : 'hover:scale-110'
                }`}
              >
                <div
                  style={{ borderColor: node.color, backgroundColor: isCenter ? '#dc2626' : '#171717' }}
                  className={`rounded-full flex items-center justify-center border-2 shadow-lg transition-all ${
                    isCenter
                      ? 'w-14 h-14 text-white shadow-[0_0_20px_rgba(239,68,68,0.8)]'
                      : 'w-8 h-8 text-neutral-200 shadow-md hover:shadow-[0_0_12px_rgba(245,158,11,0.6)]'
                  }`}
                >
                  {isCenter ? (
                    <Shield className="w-6 h-6 animate-pulse text-amber-300" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" style={{ color: node.color }} />
                  )}
                </div>

                <span
                  className={`mt-1 px-1.5 py-0.2 rounded-md text-[9px] font-mono whitespace-nowrap bg-black/80 border border-white/10 ${
                    isSelected ? 'text-amber-300 font-bold border-amber-400' : 'text-neutral-300'
                  }`}
                >
                  {node.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Node Details Popover at Bottom */}
        {selectedNode && (
          <div className="absolute bottom-2 left-2 right-2 p-2.5 bg-black/90 backdrop-blur-xl rounded-2xl border border-red-500/40 text-xs text-white flex items-center justify-between z-40 shadow-2xl">
            <div className="min-w-0 flex-1 pr-2">
              <div className="text-[10px] font-mono text-amber-400 font-bold uppercase flex items-center space-x-1">
                <Info className="w-3 h-3" />
                <span>УЗЕЛ: {selectedNode.type.toUpperCase()}</span>
              </div>
              <div className="font-semibold truncate text-white mt-0.5">{selectedNode.details}</div>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-neutral-500 hover:text-white px-2 py-1 text-xs"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="ios-glass p-2.5 rounded-2xl border border-white/5 flex flex-wrap items-center justify-around gap-2 text-[10px] text-neutral-400 font-mono">
        <span className="flex items-center space-x-1"><span className="w-2 h-2 rounded-full bg-red-500" /><span>Цель</span></span>
        <span className="flex items-center space-x-1"><span className="w-2 h-2 rounded-full bg-amber-500" /><span>Родственники</span></span>
        <span className="flex items-center space-x-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /><span>Банки</span></span>
        <span className="flex items-center space-x-1"><span className="w-2 h-2 rounded-full bg-cyan-500" /><span>Авто/ТС</span></span>
        <span className="flex items-center space-x-1"><span className="w-2 h-2 rounded-full bg-pink-500" /><span>Утечки</span></span>
      </div>
    </div>
  );
};
