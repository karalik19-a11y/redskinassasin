import React from 'react';
import { Search, FileText, Share2, Database, Terminal, Settings } from 'lucide-react';
import { sound } from '../../utils/sound';

export type ActiveTab = 'search' | 'dossier' | 'graph' | 'breaches' | 'terminal' | 'settings';

interface BottomNavBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  hasDossier: boolean;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onTabChange,
  hasDossier,
}) => {
  const tabs = [
    { id: 'search', label: 'Поиск', icon: Search, badge: null },
    { id: 'dossier', label: 'Досье', icon: FileText, badge: hasDossier ? 'TOP' : null },
    { id: 'graph', label: 'Связи', icon: Share2, badge: null },
    { id: 'breaches', label: 'Утечки', icon: Database, badge: '4.8B' },
    { id: 'terminal', label: 'CLI', icon: Terminal, badge: null },
    { id: 'settings', label: 'Опции', icon: Settings, badge: null },
  ] as const;

  const handleSelect = (id: ActiveTab) => {
    sound.playHapticTap();
    onTabChange(id);
  };

  return (
    <div className="w-full px-4 pb-4 pt-1 z-40 select-none">
      <nav className="relative w-full max-w-md mx-auto ios-glass rounded-3xl p-1.5 shadow-[0_10px_35px_rgba(0,0,0,0.7)] border border-red-500/20 backdrop-blur-3xl">
        <div className="grid grid-cols-6 gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => handleSelect(tab.id as ActiveTab)}
                className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all duration-300 ${
                  isActive
                    ? 'bg-gradient-to-b from-red-600/30 to-amber-600/20 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)] border border-red-500/40 scale-105'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
                }`}
              >
                {/* Badge if present */}
                {tab.badge && (
                  <span className="absolute -top-1.5 right-1 px-1.5 py-0.2 bg-gradient-to-r from-red-600 to-amber-600 text-[8px] font-bold text-white rounded-full shadow-[0_0_8px_rgba(239,68,68,0.8)]">
                    {tab.badge}
                  </span>
                )}

                <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'text-red-400 scale-110' : ''}`} />
                <span
                  className={`text-[9px] mt-1 font-medium tracking-tight ${
                    isActive ? 'text-red-200 font-semibold' : 'text-neutral-400'
                  }`}
                >
                  {tab.label}
                </span>

                {isActive && (
                  <span className="absolute bottom-0.5 w-4 h-0.5 bg-gradient-to-r from-red-500 to-amber-400 rounded-full shadow-[0_0_6px_rgba(239,68,68,1)]" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
