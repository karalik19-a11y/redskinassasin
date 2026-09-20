import { useState, useEffect, useMemo, useRef } from 'react';
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
import { OsintLiveReport } from './components/osint/OsintLiveReport';
import type { Dossier, SearchQuery, Relative } from './types/dossier';
import type { InvestigationReport } from './osint/types/report';
import { createOsintEngine } from './osint';
import { investigationToDossier } from './utils/reportToDossier';
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

type ExtendedTab = ActiveTab | 'report';

function buildInputFromQuery(query: SearchQuery): string {
  const parts: string[] = [];
  if (query.fio) parts.push(query.fio);
  else if (query.lastName || query.firstName) {
    parts.push([query.lastName, query.firstName, query.middleName].filter(Boolean).join(' '));
  }
  if (query.birthDate) parts.push(query.birthDate);
  if (query.phone) parts.push(query.phone);
  if (query.passport) parts.push(query.passport);
  if (query.inn) parts.push(query.inn);
  if (query.snils) parts.push(query.snils);
  if (query.carPlate) parts.push(query.carPlate);
  if ((query as unknown as { vin?: string }).vin) parts.push((query as unknown as { vin?: string }).vin as string);
  if (query.email) parts.push(query.email);
  if (query.telegram) parts.push(query.telegram);
  // если ничего — хотя бы фио
  const joined = parts.filter(Boolean).join(', ').trim();
  return joined || query.fio || '';
}

function depthToProfile(depth?: string): string {
  if (depth === 'DARKNET_FULL') return 'person-deep';
  if (depth === 'FAST') return 'person-fast';
  return 'full-spectrum';
}

export function App() {
  const [activeTab, setActiveTab] = useState<ExtendedTab>('search');
  const [currentDossier, setCurrentDossier] = useState<Dossier | null>(null);
  const [liveReport, setLiveReport] = useState<InvestigationReport | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [pendingTargetName, setPendingTargetName] = useState('');
  const [isFrameEnabled, setIsFrameEnabled] = useState(true);
  const [isSoundEnabled, setIsSoundEnabled] = useState(sound.isEnabled());
  const [liveProgress, setLiveProgress] = useState<string>('');
  const [investigationError, setInvestigationError] = useState<string | null>(null);

  const engine = useMemo(
    () =>
      createOsintEngine({
        settings: {
          profile: 'full-spectrum',
          budgetMs: 45_000,
        },
      }),
    [],
  );

  const abortRef = useRef<AbortController | null>(null);

  // Load initial case from persistent storage
  useEffect(() => {
    const active = loadActiveCase();
    setCurrentDossier(active);
  }, []);

  // Подписка на события движка — живой лог
  useEffect(() => {
    const unsub = engine.subscribe((ev) => {
      if (ev.type === 'run.phase') setLiveProgress(`Фаза: ${ev.payload.phase}`);
      if (ev.type === 'module.started') setLiveProgress(`→ ${ev.payload.moduleId}`);
      if (ev.type === 'module.completed') setLiveProgress(`✓ ${ev.payload.record.moduleId} (${ev.payload.record.evidenceCount})`);
      if (ev.type === 'risk.updated') setLiveProgress(`Риск ${ev.payload.risk.score}/100`);
      if (ev.type === 'warning') setLiveProgress(ev.payload.message.slice(0, 80));
    });
    return unsub;
  }, [engine]);

  // Главный поиск — теперь реальный OSINT-движок + фолбэк
  const handleSearch = async (query: SearchQuery) => {
    let targetName = query.fio || '';
    if (!targetName && query.lastName) {
      targetName = `${query.lastName} ${query.firstName || ''} ${query.middleName || ''}`.trim();
    }
    if (!targetName && query.phone) targetName = `Абонент ${query.phone}`;
    if (!targetName && query.passport) targetName = `Паспорт ${query.passport}`;
    if (!targetName && query.carPlate) targetName = `ТС ${query.carPlate}`;
    if (!targetName && query.email) targetName = query.email;
    if (!targetName && query.telegram) targetName = query.telegram;
    if (!targetName) targetName = 'Объект X (Комплексный профиль)';

    const rawInput = buildInputFromQuery(query);
    if (!rawInput) {
      setInvestigationError('Введите хотя бы один идентификатор: ФИО, телефон, ИНН, e-mail, домен, ГРЗ, VIN или никнейм.');
      return;
    }

    setPendingTargetName(targetName);
    setIsScanning(true);
    setInvestigationError(null);
    setLiveProgress('Инициализация TOMAHAWK OSINT…');
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Проверка кэшированных дел — быстрый ответ без сети
    const allCases = loadAllCases();
    const matchingCase = allCases.find(
      (p) =>
        (query.fio && p.fio.full.toLowerCase().includes(query.fio.toLowerCase())) ||
        (query.phone && p.telecom.some((t) => t.number.includes(query.phone!))) ||
        (query.passport && p.documents.some((d) => d.number.includes(query.passport!))) ||
        (query.carPlate && p.assets.vehicles.some((v) => v.plate.includes(query.carPlate!))),
    );

    try {
      const profile = depthToProfile(query.depth);
      const report = await engine.investigate({
        input: rawInput,
        profile,
        signal: controller.signal,
      });

      if (!report) throw new Error('Движок не вернул отчёт');

      setLiveReport(report);

      // Конвертируем отчёт в досье — только реальные поля
      const dossierFromReport = investigationToDossier(report);

      // Если нашли локальное дело с таким же ФИО — дополняем его реальными данными, а не перезаписываем
      let finalDossier: Dossier;
      if (matchingCase && dossierFromReport.fio.full.toLowerCase() === matchingCase.fio.full.toLowerCase()) {
        // мерджим: приоритет у живых данных для telecom/emails/documents
        finalDossier = {
          ...matchingCase,
          id: report.id,
          telecom: dossierFromReport.telecom.length ? dossierFromReport.telecom : matchingCase.telecom,
          emails: dossierFromReport.emails.length ? dossierFromReport.emails : matchingCase.emails,
          fio: dossierFromReport.fio.full !== 'Объект Неизвестен —' ? dossierFromReport.fio : matchingCase.fio,
          threatLevel: dossierFromReport.threatLevel,
          riskScore: dossierFromReport.riskScore,
          summary: dossierFromReport.summary,
        };
      } else {
        finalDossier = dossierFromReport;
      }

      // Если движок не нашёл сущностей — это не ошибка, но предупреждаем
      if (report.entities.length === 0) {
        setInvestigationError(
          'Движок не распознал ни одного идентификатора. Попробуйте формат: +7 916 402-91-88, 7707083893 (ИНН), m.sokolov@example.com, sberbank.ru, А 777 ОС 777, WP0AA2Y13MSA49201 (VIN).',
        );
        // всё равно создаём минимальное досье, чтобы не было пустого экрана
        const fallback = createVerifiedDossierFromQuery(query);
        setCurrentDossier(report.entities.length ? finalDossier : fallback);
        if (report.entities.length) setActiveTab('report');
        return;
      }

      // Сохраняем
      saveOrUpdateCase(finalDossier);
      setCurrentDossier(finalDossier);
      setActiveTab('report');
      sound.playTotemResonance();
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setLiveProgress('Отменено');
        return;
      }
      console.error('OSINT investigate failed:', err);
      setInvestigationError(
        `Живой поиск временно недоступен: ${(err as Error).message.slice(0, 180)}. Создано локальное досье — проверьте сеть и CORS-транзиты.`,
      );
      // Фолбэк — локальное досье из верифицированных чексумм
      if (matchingCase) {
        setCurrentDossier(matchingCase);
        setActiveCaseId(matchingCase.id);
        setActiveTab('dossier');
      } else {
        const generated = createVerifiedDossierFromQuery(query);
        setCurrentDossier(generated);
        setActiveTab('dossier');
      }
    } finally {
      setTimeout(() => setIsScanning(false), 600);
    }
  };

  // Прямой запуск из единого поля (строка свободного ввода)
  const handleFreeTextSearch = async (input: string, profile = 'full-spectrum') => {
    if (!input.trim()) {
      setInvestigationError('Введите данные для разведки: телефон, ИНН, домен, ФИО, e-mail, ГРЗ, VIN, криптокошелёк…');
      return;
    }
    await handleSearch({ fio: input.trim(), depth: profile as SearchQuery['depth'] });
  };

  const handleSelectPreset = (dossier: Dossier) => {
    setPendingTargetName(dossier.fio.full);
    setIsScanning(true);
    saveOrUpdateCase(dossier);
    setTimeout(() => {
      setCurrentDossier(dossier);
      setIsScanning(false);
      setActiveTab('dossier');
    }, 350);
  };

  const handleScanComplete = () => {
    setIsScanning(false);
    // если есть живой отчёт — показываем его, иначе досье
    if (liveReport) setActiveTab('report');
    else setActiveTab('dossier');
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
    void handleSearch(query);
  };

  const handleResetData = () => {
    saveAllCases([SAMPLE_INVESTIGATION_CASE]);
    setActiveCaseId(SAMPLE_INVESTIGATION_CASE.id);
    setCurrentDossier(SAMPLE_INVESTIGATION_CASE);
    setLiveReport(null);
    setActiveTab('search');
    sound.playSuccessChime();
  };

  const handleToggleSound = () => {
    const next = sound.toggle();
    setIsSoundEnabled(next);
  };

  const handleExportReport = (report: InvestigationReport, format: 'json' | 'markdown' | 'stix2' | 'graphml' | 'csv') => {
    const content = engine.export(report, format);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tomahawk-${report.id}.${format === 'stix2' ? 'json' : format === 'markdown' ? 'md' : format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    sound.playSuccessChime();
  };

  return (
    <div className="app-shell text-white overflow-x-hidden selection:bg-[#d26f57] selection:text-white">
      <ShamanBackground />

      <IPhoneFrame
        isFrameEnabled={isFrameEnabled}
        onToggleFrame={() => setIsFrameEnabled(!isFrameEnabled)}
        isSoundEnabled={isSoundEnabled}
        onToggleSound={handleToggleSound}
      >
        <div className="relative flex min-h-[min(78vh,980px)] w-full flex-col overflow-hidden">
          <main className="main-viewport flex-1 w-full overflow-y-auto px-4 pt-7 no-scrollbar z-20">
            {activeTab === 'search' && (
              <SearchHub
                onSearch={handleSearch}
                onSelectPreset={handleSelectPreset}
                onFreeTextSearch={handleFreeTextSearch}
                liveProgress={liveProgress}
                investigationError={investigationError}
                liveReport={liveReport}
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

            {activeTab === 'report' && (
              liveReport ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <button
                      onClick={() => setActiveTab('dossier')}
                      className="text-xs text-muted hover:text-white flex items-center space-x-1 py-1 px-2 rounded-lg bg-white/5 border border-hair"
                    >
                      <span>← К досье</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('search')}
                      className="text-xs text-muted hover:text-white py-1 px-2 rounded-lg bg-white/5 border border-hair"
                    >
                      Новый поиск
                    </button>
                  </div>
                  <OsintLiveReport report={liveReport} onExport={(fmt) => handleExportReport(liveReport, fmt)} />
                  {currentDossier && (
                    <div className="pt-2">
                      <button
                        onClick={() => setActiveTab('dossier')}
                        className="w-full py-2.5 bg-gradient-to-r from-[#c2664f] to-[#a8834c] text-white rounded-xl text-xs font-bold"
                      >
                        Открыть сформированное досье: {currentDossier.fio.full}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-20 text-muted space-y-3">
                  <p>Живой отчёт ещё не сформирован.</p>
                  <p className="text-xs text-muted/70">Введите телефон, ИНН, домен, e-mail, ФИО или ГРЗ на вкладке «Поиск» и запустите разведку.</p>
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
                onRunScan={(name) => void handleSearch({ fio: name, depth: 'DEEP_TOTEM' })}
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

          <div className="w-full shrink-0 z-40">
            <BottomNavBar
              activeTab={(activeTab === 'report' ? 'dossier' : activeTab) as ActiveTab}
              onTabChange={(t) => setActiveTab(t as ExtendedTab)}
              hasDossier={Boolean(currentDossier)}
            />
            {/* Второй ряд для LIVE-отчёта — когда есть живой отчёт */}
            {liveReport && (
              <div className="mx-auto max-w-[760px] px-4 pb-2 -mt-2 flex justify-center">
                <button
                  onClick={() => setActiveTab(activeTab === 'report' ? 'dossier' : 'report')}
                  className={`text-[10px] font-mono px-3 py-1 rounded-full border transition-all ${activeTab === 'report' ? 'bg-clay text-white border-clay' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'}`}
                >
                  {activeTab === 'report' ? '← Назад к досье' : `● LIVE ОТЧЁТ ${liveReport.id.slice(0, 10)} • риск ${liveReport.risk.score}`}
                </button>
              </div>
            )}
          </div>

          {isScanning && (
            <ScanningOverlay
              targetName={pendingTargetName}
              onComplete={handleScanComplete}
            />
          )}
          {/* Поверх оверлея — живой прогресс движка */}
          {isScanning && liveProgress && (
            <div className="absolute bottom-20 left-4 right-4 z-50 pointer-events-none">
              <div className="mx-auto max-w-[760px] bg-[#0e1118]/90 backdrop-blur-xl border border-hair rounded-xl px-3 py-2 flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="text-[11px] font-mono text-gold truncate">{liveProgress}</span>
              </div>
            </div>
          )}
        </div>
      </IPhoneFrame>
    </div>
  );
}

export default App;
