import React from 'react';

export const ShamanBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Deep Obsidian Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#050508] via-[#090810] to-[#040407]" />

      {/* Cyber Shamanic Glowing Ambient Orbs */}
      <div className="absolute top-[-10%] left-[-15%] w-[450px] h-[450px] rounded-full bg-red-600/10 blur-[130px]" />
      <div className="absolute top-[35%] right-[-15%] w-[420px] h-[420px] rounded-full bg-amber-600/8 blur-[140px]" />
      <div className="absolute bottom-[-10%] left-[20%] w-[500px] h-[500px] rounded-full bg-red-800/10 blur-[150px]" />

      {/* Indigenous Cyber Totem Geometric SVG Watermark */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.035] text-red-500"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 800 1200"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        {/* Thunderbird Cyber Glyph */}
        <path d="M400,100 L350,220 L400,200 L450,220 Z" />
        <path d="M400,200 L400,380" strokeDasharray="6 4" />
        <path d="M400,240 L280,180 L200,260 L360,280" />
        <path d="M400,240 L520,180 L600,260 L440,280" />
        
        {/* Sun & Dreamcatcher Circular Rings */}
        <circle cx="400" cy="550" r="140" strokeDasharray="8 6" />
        <circle cx="400" cy="550" r="100" />
        <circle cx="400" cy="550" r="60" strokeDasharray="4 4" />
        
        {/* Diamond Aztec/Navajo Stepped Runes */}
        <polygon points="400,450 480,550 400,650 320,550" />
        <polygon points="400,480 450,550 400,620 350,550" />
        
        {/* Sacred Arrows / Lightning Strikes */}
        <path d="M400,550 L300,750 L340,760 L240,900" />
        <path d="M400,550 L500,750 L460,760 L560,900" />
        <path d="M400,690 L400,1050" strokeDasharray="10 8" />
      </svg>

      {/* Subtle Noise / Grid Overlay */}
      <div className="absolute inset-0 tribal-pattern-bg opacity-30" />
    </div>
  );
};
