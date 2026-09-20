/**
 * TOMAHAWK OSINT ENGINE — React-адаптер (необязательный слой)
 * ---------------------------------------------------------------------------
 * Движок не зависит от React: ядро — чистый TypeScript, который работает в
 * браузере, веб-воркере, Node, Deno, Bun и edge-рантаймах. Этот файл — тонкая
 * обёртка для приложений на React, показывающая рекомендуемый способ
 * импорта: движок создаётся один раз, подписка на события даёт живой прогресс,
 * отмена делается через AbortController.
 *
 * ```tsx
 * function SearchPanel() {
 *   const { run, cancel, running, phase, progress, report, error, reset } = useOsint({ profile: 'person-fast' });
 *   return (
 *     <>
 *       <button onClick={() => run('+7 916 402-91-88')} disabled={running}>Искать</button>
 *       {running && <p>{phase} — {progress.modulesDone}/{progress.modulesStarted} модулей</p>}
 *       {report && <p>Риск: {report.risk.score}/100 ({report.risk.level})</p>}
 *     </>
 *   );
 * }
 * ```
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createOsintEngine, type EngineEvent, type OsintEngine, type InvestigateOptions } from '../index';
import type { EngineSettings, ModuleCategory } from '../types/module';
import type { InvestigationReport, RiskLevel } from '../types/report';
import { PHASE_LABELS_RU, type RunPhase } from '../types/events';
import type { EntityType } from '../types/entity';

export interface OsintHookOptions {
  /** Профиль расследования: 'person-fast' | 'company-full' | 'domain-infra' | 'full-spectrum' | … */
  profile?: string;
  settings?: Partial<EngineSettings>;
  /** Категории модулей, которые нужно отключить в конкретном приложении. */
  disableCategories?: ModuleCategory[];
  /** Подменённый fetch (тесты, прокси, инструментированный клиент). */
  fetchImpl?: typeof fetch;
  onEvent?: (event: EngineEvent) => void;
}

export interface OsintProgress {
  phase: RunPhase;
  modulesStarted: number;
  modulesDone: number;
  modulesFailed: number;
  entities: number;
  evidence: number;
  pivots: number;
  /** Последние сообщения журнала — готовы к выводу в UI. */
  log: Array<{ at: number; text: string; kind: 'info' | 'warn' | 'module' }>;
}

export interface OsintHookResult {
  run: (input: string, options?: Omit<InvestigateOptions, 'input'>) => Promise<InvestigationReport | undefined>;
  runEntities: (entities: NonNullable<InvestigateOptions['entities']>) => Promise<InvestigationReport | undefined>;
  cancel: () => void;
  reset: () => void;
  running: boolean;
  phase: RunPhase;
  progress: OsintProgress;
  report?: InvestigationReport;
  error?: string;
  /** Экспорт текущего отчёта в нужный формат (json/csv/graphml/stix2/markdown). */
  exportAs: (format: 'json' | 'jsonl' | 'csv' | 'graphml' | 'stix2' | 'markdown', section?: 'entities' | 'edges' | 'evidence' | 'findings' | 'timeline') => string | undefined;
  /** Сколько сущностей каждого типа найдено — для чипов в интерфейсе. */
  entityCounts: Partial<Record<EntityType, number>>;
  riskLevel?: RiskLevel;
}

const EMPTY_PROGRESS: OsintProgress = {
  phase: 'parse',
  modulesStarted: 0,
  modulesDone: 0,
  modulesFailed: 0,
  entities: 0,
  evidence: 0,
  pivots: 0,
  log: [],
};

export function useOsint(options: OsintHookOptions = {}): OsintHookResult {
  const { profile, settings, disableCategories, fetchImpl, onEvent } = options;
  // Один движок на жизненный цикл компонента: ленивая инициализация состояния —
  // единственный способ создать его без обращения к ref во время рендера.
  const [engine] = useState<OsintEngine>(() =>
    createOsintEngine({
      settings: { ...(settings ?? {}), ...(profile ? { profile } : {}) },
      fetchImpl,
    }),
  );
  const abortRef = useRef<AbortController | undefined>(undefined);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<RunPhase>('parse');
  const [progress, setProgress] = useState<OsintProgress>(EMPTY_PROGRESS);
  const [report, setReport] = useState<InvestigationReport | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  // Актуальный колбэк без пересоздания подписки на каждое изменение пропсов.
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  // Отключение нежелательных категорий модулей на уровне приложения.
  const disabledKey = (disableCategories ?? []).join('|');
  useEffect(() => {
    if (!disabledKey) return;
    const disabled = new Set(disabledKey.split('|'));
    for (const module of engine.modules()) {
      if (disabled.has(module.category)) engine.unregister(module.id);
    }
  }, [engine, disabledKey]);

  // Подписка на события движка → живой прогресс и журнал.
  useEffect(() => {
    const unsubscribe = engine.subscribe((event) => {
      onEventRef.current?.(event);
      switch (event.type) {
        case 'run.phase':
          setPhase(event.payload.phase);
          break;
        case 'module.started':
          setProgress((current) => ({ ...current, modulesStarted: current.modulesStarted + 1, log: push(current.log, `→ ${event.payload.moduleId}`, 'module') }));
          break;
        case 'module.completed':
          setProgress((current) => ({
            ...current,
            modulesDone: current.modulesDone + (event.payload.record.status === 'ok' || event.payload.record.status === 'empty' ? 1 : 0),
            modulesFailed: current.modulesFailed + (event.payload.record.status === 'error' ? 1 : 0),
            evidence: current.evidence + event.payload.record.evidenceCount,
            entities: current.entities + event.payload.record.entityCount,
            log: push(current.log, `✓ ${event.payload.record.moduleId} (${event.payload.record.evidenceCount} наблюдений)`, 'info'),
          }));
          break;
        case 'entity.discovered':
          setProgress((current) => ({ ...current, entities: current.entities + 1 }));
          break;
        case 'pivot.queued':
          setProgress((current) => ({ ...current, pivots: current.pivots + 1 }));
          break;
        case 'warning':
          setProgress((current) => ({ ...current, log: push(current.log, event.payload.message, 'warn') }));
          break;
        default:
          break;
      }
    });
    return unsubscribe;
  }, [engine]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = useCallback(async (input: string, runOptions: Omit<InvestigateOptions, 'input'> = {}): Promise<InvestigationReport | undefined> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setError(undefined);
    setProgress(EMPTY_PROGRESS);
    try {
      const result = await engine.investigate({ input, signal: controller.signal, ...runOptions });
      setReport(result);
      return result;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return undefined;
    } finally {
      setRunning(false);
    }
  }, [engine]);

  const runEntities = useCallback(
    (entities: NonNullable<InvestigateOptions['entities']>) => run('', { entities }),
    [run],
  );

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  const reset = useCallback(() => {
    setReport(undefined);
    setError(undefined);
    setProgress(EMPTY_PROGRESS);
  }, []);

  const exportAs = useCallback<OsintHookResult['exportAs']>(
    (format, section) => (report ? engine.export(report, format, section) : undefined),
    [engine, report],
  );

  const entityCounts = useMemo(() => {
    const counts: Partial<Record<EntityType, number>> = {};
    for (const entity of report?.entities ?? []) counts[entity.type] = (counts[entity.type] ?? 0) + 1;
    return counts;
  }, [report]);

  return {
    run,
    runEntities,
    cancel,
    reset,
    running,
    phase,
    progress,
    report,
    error,
    exportAs,
    entityCounts,
    riskLevel: report?.risk.level,
  };
}

function push<T extends { at: number; text: string; kind: 'info' | 'warn' | 'module' }>(log: T[], text: string, kind: 'info' | 'warn' | 'module'): T[] {
  return [...log.slice(-60), { at: Date.now(), text, kind } as T];
}

/** Готовый человекочитаемый статус для строки прогресса. */
export function describeProgress(progress: OsintProgress): string {
  const label = PHASE_LABELS_RU[progress.phase] ?? progress.phase;
  return `${label}: модулей ${progress.modulesDone}/${progress.modulesStarted}, сущностей ${progress.entities}, наблюдений ${progress.evidence}`;
}
