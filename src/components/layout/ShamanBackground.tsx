import React from 'react';

export const ShamanBackground: React.FC = () => (
  <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,#2b2b47_0,transparent_34%),radial-gradient(circle_at_92%_18%,#3a292d_0,transparent_28%),linear-gradient(140deg,#10131c_0%,#161a26_52%,#11141e_100%)]" />
    <div className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-[#8f8bb5]/10 blur-[90px]" style={{ animation: 'ambient-drift 14s ease-in-out infinite' }} />
    <div className="absolute -right-24 top-[42%] h-96 w-96 rounded-full bg-[#d26f57]/10 blur-[110px]" style={{ animation: 'ambient-drift 18s ease-in-out infinite reverse' }} />
    <svg className="absolute inset-0 h-full w-full opacity-[.055]" viewBox="0 0 1200 900" fill="none" aria-hidden="true">
      <path d="M-100 650C170 490 280 770 510 560S900 260 1320 420" stroke="#d7ad6a" strokeWidth="1" />
      <path d="M-100 690C170 530 280 810 510 600S900 300 1320 460" stroke="#d7ad6a" strokeWidth="1" />
      <path d="M180 0v260m-35-35 35 35 35-35M980 900V640m-35 35 35-35 35 35" stroke="#f5f1e8" strokeWidth="1" />
      <circle cx="600" cy="430" r="230" stroke="#8f8bb5" strokeDasharray="3 12" />
      <circle cx="600" cy="430" r="166" stroke="#8f8bb5" strokeDasharray="1 16" />
    </svg>
    <div className="absolute inset-0 opacity-[.045]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.7) 1px, transparent 1px)', backgroundSize: '72px 72px' }} />
  </div>
);
