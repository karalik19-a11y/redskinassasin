import React from 'react';
import { Search, FileText, Share2, Database, Terminal, Settings } from 'lucide-react';
import { sound } from '../../utils/sound';

export type ActiveTab = 'search' | 'dossier' | 'graph' | 'breaches' | 'terminal' | 'settings';
interface BottomNavBarProps { activeTab: ActiveTab; onTabChange: (tab: ActiveTab) => void; hasDossier: boolean; }

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ activeTab, onTabChange, hasDossier }) => {
  const tabs = [
    { id: 'search', label: 'Поиск', icon: Search },
    { id: 'dossier', label: 'Досье', icon: FileText },
    { id: 'graph', label: 'Связи', icon: Share2 },
    { id: 'breaches', label: 'Реестры', icon: Database },
    { id: 'terminal', label: 'Терминал', icon: Terminal },
    { id: 'settings', label: 'Настройки', icon: Settings },
  ] as const;
  return (
    <div className="sticky bottom-0 z-40 w-full px-4 pb-5 pt-4 sm:px-8">
      <nav className="mx-auto grid w-full max-w-[760px] grid-cols-6 gap-1 rounded-[22px] border border-white/[.12] bg-[#1a1e2a]/90 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,.32)] backdrop-blur-2xl">
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button key={id} onClick={() => { sound.playHapticTap(); onTabChange(id as ActiveTab); }} className={`relative flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[10px] transition-all ${active ? 'bg-[#d7ad6a]/15 text-[#f1d49a] shadow-[inset_0_1px_0_rgba(255,255,255,.1)]' : 'text-[#858c9b] hover:bg-white/[.05] hover:text-[#e9e5dc]'}`}>
              <Icon className={`h-[17px] w-[17px] ${active ? 'text-[#d7ad6a]' : ''}`} strokeWidth={active ? 2.2 : 1.7} />
              <span className={active ? 'font-semibold' : ''}>{label}</span>
              {id === 'dossier' && hasDossier && <span className="absolute right-[20%] top-2 h-1.5 w-1.5 rounded-full bg-[#d26f57]" />}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
