import React, { useState, useEffect } from 'react';
import { Wifi, Battery } from 'lucide-react';

interface StatusBarProps {
  onTapIsland?: () => void;
}

export const IPhoneStatusBar: React.FC<StatusBarProps> = () => {
  const [time, setTime] = useState('09:41');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setTime(`${hours}:${minutes}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full flex items-center justify-between px-7 pt-3.5 pb-2 select-none text-xs text-white/90 font-medium tracking-tight z-50">
      {/* Left: Clock */}
      <div className="flex items-center space-x-1 font-semibold text-[13px] tracking-wide">
        <span>{time}</span>
      </div>

      {/* Right: Signal, 5G, Wi-Fi, Battery */}
      <div className="flex items-center space-x-2 text-white/80">
        {/* Cellular Bars */}
        <div className="flex items-end space-x-[2px] h-3">
          <span className="w-[3px] h-1.5 bg-clay rounded-xs" />
          <span className="w-[3px] h-2 bg-clay rounded-xs" />
          <span className="w-[3px] h-2.5 bg-clay rounded-xs" />
          <span className="w-[3px] h-3 bg-clay rounded-xs" />
        </div>

        {/* 5G Totem Indicator */}
        <span className="text-[10px] font-bold text-gold tracking-tighter">5G+</span>

        {/* Wi-Fi Icon */}
        <Wifi className="w-3.5 h-3.5 text-white/85" />

        {/* Battery with percentage */}
        <div className="flex items-center space-x-1">
          <span className="text-[10px] text-white/70">98%</span>
          <div className="relative flex items-center">
            <Battery className="w-4 h-4 text-sage" />
            <span className="absolute left-[3px] top-[4px] w-2 h-1.5 bg-sage-soft rounded-xs" />
          </div>
        </div>
      </div>
    </div>
  );
};
