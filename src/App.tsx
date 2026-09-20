import { useState, useEffect } from 'react';
import { ShamanBackground } from './components/layout/ShamanBackground';
import { IPhoneFrame } from './components/layout/IPhoneFrame';
import { BottomNavBar } from './components/layout/BottomNavBar';
import type { ActiveTab } from './components/layout/BottomNavBar';
import { SearchHub } from './components/search/SearchHub';
import { ScanningOverlay } from './components/search/ScanningOverlay';
import { DossierView } from './components/dossier/DossierView';
import { DreamcatcherGraph } from './components/dreamcatcher/DreamcatcherGraph';
import { BreachExplorer } from './components/breaches/BreachExplorer';
import { CyberTerminal } from './components/terminal/CyberTerminal';
import { SettingsView } from './components/settings/SettingsView';
import type { Dossier, SearchQuery, Relative } from './types/dossier';
import {
  loadActiveCase,
  loadAllCases,
  saveOrUpdateCase,
  createVerifiedDossierFromQuery,
  SAMPLE_INVESTIGATION_CASE,
  saveAllCases,
  setActiveCaseId,
} from './utils/caseStorage';
import { sound } from './utils/sound';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('search');
  const [currentDossier, setCurrentDossier] = useState<Dossier | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [pendingTargetName, setPendingTargetName] = useState('');
  const [isFrameEnabled, setIsFrameEnabled] = useState(true);
  const [isSoundEnabled, setIsSoundEnabled] = useState(sound.isEnabled());

  // Load initial case from persistent storage
  useEffect(() => {
    const active = loadActiveCase();
    setCurrentDossier(active);
  }, []);

  // Handle Initiating Search & Real Dossier Construction
  const handleSearch = (query: SearchQuery) => {
    let targetName = query.fio || '';
    if (!targetName && query.lastName) {
      targetName = `${query.lastName} ${query.firstName || ''} ${query.middleName || ''}`.trim();
    }
    if (!targetName && query.phone) {
      targetName = `Абонент ${query.phone}`;
    }
    if (!targetName && query.passport) {
      targetName = `Паспорт ${query.passport}`;
    }
    if (!targetName && query.carPlate) {
      targetName = `ТС ${query.carPlate}`;
    }
    if (!targetName) {
      targetName = 'Объект X (Комплексный профиль)';
    }

    setPendingTargetName(targetName);
    setIsScanning(true);

    // Check existing stored cases
    const allCases = loadAllCases();
    const matchingCase = allCases.find(
      (p) =>
        (query.fio && p.fio.full.toLowerCase().includes(query.fio.toLowerCase())) ||
        (query.phone && p.telecom.some((t) => t.number.includes(query.phone!))) ||
        (query.passport && p.documents.some((d) => d.number.includes(query.passport!))) ||
        (query.carPlate && p.assets.vehicles.some((v) => v.plate.includes(query.carPlate!)))
    );

    setTimeout(() => {
      if (matchingCase) {
        setCurrentDossier(matchingCase);
        setActiveCaseId(matchingCase.id);
      } else {
        const generated = createVerifiedDossierFromQuery(query);
        setCurrentDossier(generated);
      }
    }, 450);
  };

  const handleSelectPreset = (dossier: Dossier) => {
    setPendingTargetName(dossier.fio.full);
    setIsScanning(true);
    saveOrUpdateCase(dossier);
    setTimeout(() => {
      setCurrentDossier(dossier);
    }, 350);
  };

  const handleScanComplete = () => {
    setIsScanning(false);
    setActiveTab('dossier');
    sound.playTotemResonance();
  };

  const handleOpenRelativeDossier = (rel: Relative) => {
    const query: SearchQuery = {
      fio: rel.fio,
      birthDate: rel.birthDate,
      phone: rel.phone,
      inn: rel.inn,
      depth: 'DEEP_TOTEM',
    };
    handleSearch(query);
  };

  const handleResetData = () => {
    saveAllCases([SAMPLE_INVESTIGATION_CASE]);
    setActiveCaseId(SAMPLE_INVESTIGATION_CASE.id);
    setCurrentDossier(SAMPLE_INVESTIGATION_CASE);
    setActiveTab('search');
    sound.playSuccessChime();
  };

  const handleToggleSound = () => {
    const next = sound.toggle();
    setIsSoundEnabled(next);
  };

  return (
    <div className="app-shell text-white overflow-x-hidden selection:bg-[#d26f57] selection:text-white">
      <ShamanBackground />

      {/* Responsive product shell — no device mockup, consistent on every platform. */}
      <IPhoneFrame
        isFrameEnabled={isFrameEnabled}
        onToggleFrame={() => setIsFrameEnabled(!isFrameEnabled)}
        isSoundEnabled={isSoundEnabled}
        onToggleSound={handleToggleSound}
      >
        <div className="relative flex min-h-[min(78vh,980px)] w-full flex-col overflow-hidden">
          {/* Main scrollable workspace. Device chrome is intentionally omitted. */}
          <main className="main-viewport flex-1 w-full overflow-y-auto px-4 pt-7 no-scrollbar z-20">
            {activeTab === 'search' && (
              <SearchHub
                onSearch={handleSearch}
                onSelectPreset={handleSelectPreset}
              />
            )}

            {activeTab === 'dossier' && (
              currentDossier ? (
                <DossierView
                  dossier={currentDossier}
                  onOpenRelativeDossier={handleOpenRelativeDossier}
                  onBackToSearch={() => setActiveTab('search')}
                />
              ) : (
                <div className="text-center py-20 text-muted">
                  <p>Досье не выбрано. Выполните поиск.</p>
                  <button
                    onClick={() => setActiveTab('search')}
                    className="mt-4 px-4 py-2 bg-clay text-white rounded-xl text-xs font-bold"
                  >
                    Перейти к поиску
                  </button>
                </div>
              )
            )}

            {activeTab === 'graph' && (
              currentDossier ? (
                <DreamcatcherGraph dossier={currentDossier} />
              ) : (
                <div className="text-center py-20 text-muted">
                  Сначала выполните поиск объекта.
                </div>
              )
            )}

            {activeTab === 'breaches' && <BreachExplorer />}

            {activeTab === 'terminal' && (
              <CyberTerminal
                currentDossier={currentDossier}
                onRunScan={(name) => handleSearch({ fio: name, depth: 'DEEP_TOTEM' })}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                isSoundEnabled={isSoundEnabled}
                onToggleSound={handleToggleSound}
                isFrameEnabled={isFrameEnabled}
                onToggleFrame={() => setIsFrameEnabled(!isFrameEnabled)}
                onResetData={handleResetData}
                onSelectCase={(cs) => {
                  setCurrentDossier(cs);
                  setActiveTab('dossier');
                }}
              />
            )}
          </main>

          {/* Bottom Floating iOS Navigation Bar */}
          <div className="w-full shrink-0 z-40">
            <BottomNavBar
              activeTab={activeTab}
              onTabChange={setActiveTab}
              hasDossier={Boolean(currentDossier)}
            />
          </div>

          {/* Fullscreen Scanning Hologram Overlay */}
          {isScanning && (
            <ScanningOverlay
              targetName={pendingTargetName}
              onComplete={handleScanComplete}
            />
          )}
        </div>
      </IPhoneFrame>
    </div>
  );
}

export default App;
