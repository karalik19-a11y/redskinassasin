import React, { useState } from 'react';
import type { Dossier, Relative } from '../../types/dossier';
import { HeaderCard } from './HeaderCard';
import { IdentitySection } from './IdentitySection';
import { TelecomSection } from './TelecomSection';
import { FinanceSection } from './FinanceSection';
import { AssetsSection } from './AssetsSection';
import { SocialGraphSection } from './SocialGraphSection';
import { BreachesSection } from './BreachesSection';
import { EagleEyeMap } from './EagleEyeMap';
import { PsychProfile } from './PsychProfile';
import {
  FileText,
  Phone,
  Landmark,
  Car,
  Users,
  Database,
  Compass,
  ShieldAlert,
} from 'lucide-react';
import { sound } from '../../utils/sound';

interface DossierViewProps {
  dossier: Dossier;
  onOpenRelativeDossier: (relative: Relative) => void;
  onBackToSearch: () => void;
}

type DossierTab =
  | 'identity'
  | 'telecom'
  | 'finance'
  | 'assets'
  | 'social'
  | 'breaches'
  | 'eagle'
  | 'psych';

export const DossierView: React.FC<DossierViewProps> = ({
  dossier,
  onOpenRelativeDossier,
  onBackToSearch,
}) => {
  const [activeTab, setActiveTab] = useState<DossierTab>('identity');

  const tabs = [
    { id: 'identity', label: 'Документы', icon: FileText },
    { id: 'telecom', label: 'Телеком', icon: Phone },
    { id: 'finance', label: 'Финансы', icon: Landmark },
    { id: 'assets', label: 'Имущество', icon: Car },
    { id: 'social', label: 'Связи', icon: Users },
    { id: 'breaches', label: 'Утечки', icon: Database },
    { id: 'eagle', label: 'Маршруты', icon: Compass },
    { id: 'psych', label: 'Сводка', icon: ShieldAlert },
  ] as const;

  return (
    <div className="space-y-4 pb-20 select-none">
      {/* Back button & dossier ID stamp */}
      <div className="flex items-center justify-between px-1">
        <button
          onClick={() => {
            sound.playHapticTap();
            onBackToSearch();
          }}
          className="text-xs text-neutral-400 hover:text-white flex items-center space-x-1 py-1 px-2 rounded-lg bg-white/5 border border-white/5 transition-all"
        >
          <span>&larr; Новый поиск</span>
        </button>

        <span className="text-[10px] font-mono text-neutral-500">
          ID: {dossier.id}
        </span>
      </div>

      {/* Main Header & Totem Badge */}
      <HeaderCard dossier={dossier} />

      {/* Segmented iOS Sub-Navbar (Horizontal Scroll) */}
      <div className="flex space-x-1 overflow-x-auto py-1 px-1 no-scrollbar bg-black/60 rounded-2xl border border-white/10 backdrop-blur-md">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                sound.playHapticTap();
                setActiveTab(tab.id as DossierTab);
              }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-red-600 to-amber-700 text-white shadow-[0_0_12px_rgba(239,68,68,0.5)] border border-amber-400/30'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Sub-Tab Content with Transition */}
      <div className="min-h-[360px]">
        {activeTab === 'identity' && <IdentitySection dossier={dossier} />}
        {activeTab === 'telecom' && <TelecomSection dossier={dossier} />}
        {activeTab === 'finance' && <FinanceSection dossier={dossier} />}
        {activeTab === 'assets' && <AssetsSection dossier={dossier} />}
        {activeTab === 'social' && (
          <SocialGraphSection
            dossier={dossier}
            onOpenRelativeDossier={onOpenRelativeDossier}
          />
        )}
        {activeTab === 'breaches' && <BreachesSection dossier={dossier} />}
        {activeTab === 'eagle' && <EagleEyeMap dossier={dossier} />}
        {activeTab === 'psych' && <PsychProfile dossier={dossier} />}
      </div>
    </div>
  );
};
