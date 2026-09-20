/**
 * TOMAHAWK OSINT ENGINE — typed event stream
 * ---------------------------------------------------------------------------
 * The engine is a black box that can run for minutes. Rather than forcing the
 * host to poll, it publishes a typed event for every meaningful step, so the UI
 * can render a live "thinking" view (which module is running, what was found,
 * when a pivot was queued, how risk evolved) without touching internals.
 *
 * The bus is intentionally tiny and dependency-free: `on` returns an
 * unsubscribe function, handlers never run on the hot path of a request, and a
 * throwing handler cannot break an investigation (errors are swallowed and
 * reported as a `warning` event).
 */

import type { Entity, Pivot, EntityType } from './entity';
import type { Evidence } from './evidence';
import type { ModuleRunRecord, RiskAssessment } from './report';

export type EngineEventType =
  | 'run.started'
  | 'run.phase'
  | 'input.parsed'
  | 'module.started'
  | 'module.completed'
  | 'entity.discovered'
  | 'evidence.added'
  | 'pivot.queued'
  | 'risk.updated'
  | 'warning'
  | 'run.completed'
  | 'run.failed';

export type RunPhase = 'parse' | 'plan' | 'collect' | 'expand' | 'fuse' | 'analyse' | 'report' | 'persist';

export interface EngineEventMap {
  'run.started': { runId: string; query: string; profile: string; plannedModules: string[] };
  'run.phase': { phase: RunPhase; detail?: string };
  'input.parsed': { entities: Array<{ type: EntityType; value: string }> };
  'module.started': { moduleId: string; entityId: string; category: string };
  'module.completed': { record: ModuleRunRecord };
  'entity.discovered': { entity: Entity; viaModule: string };
  'evidence.added': { evidence: Evidence };
  'pivot.queued': { entityType: EntityType; value: string; viaModule: string; depth: number; pivot?: Pivot };
  'risk.updated': { risk: RiskAssessment };
  warning: { message: string; moduleId?: string };
  'run.completed': { runId: string; durationMs: number; entities: number; evidence: number; risk: number };
  'run.failed': { runId: string; error: string };
}

export interface EngineEventOf<K extends EngineEventType> {
  type: K;
  payload: EngineEventMap[K];
  /** Unix ms, stamped by the bus when the event is published. */
  timestamp: number;
  runId?: string;
}

/**
 * Discriminated union so `switch (event.type)` narrows `event.payload` — the
 * difference between a typed event stream and `any` with extra steps.
 */
export type EngineEvent = { [K in EngineEventType]: EngineEventOf<K> }[EngineEventType];

export type EngineEventHandler = (event: EngineEvent) => void;

export class EventBus {
  private readonly handlers = new Set<EngineEventHandler>();

  on(handler: EngineEventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  off(handler: EngineEventHandler): void {
    this.handlers.delete(handler);
  }

  /** Fire once for a specific event type. Returns an unsubscribe handle. */
  once(type: EngineEventType, handler: EngineEventHandler): () => void {
    const wrapper: EngineEventHandler = (event) => {
      if (event.type !== type) return;
      this.off(wrapper);
      handler(event);
    };
    return this.on(wrapper);
  }

  emit<K extends EngineEventType>(type: K, payload: EngineEventMap[K], runId?: string): void {
    const event = { type, payload, timestamp: Date.now(), runId } as EngineEvent;
    for (const handler of [...this.handlers]) {
      try {
        handler(event);
      } catch (error) {
        // A broken listener must never break an investigation.
        if (handler !== undefined) {
          const message = error instanceof Error ? error.message : String(error);
          for (const other of [...this.handlers]) {
            if (other === handler) continue;
            try {
              other({ type: 'warning', payload: { message: `Обработчик событий вызвал ошибку: ${message}` }, timestamp: Date.now(), runId } as EngineEvent);
            } catch {
              /* ignore nested failures */
            }
          }
        }
      }
    }
  }

  /** Subscribe to a subset of event types. */
  onTypes(types: EngineEventType[], handler: EngineEventHandler): () => void {
    const wanted = new Set(types);
    return this.on((event) => {
      if (wanted.has(event.type)) handler(event);
    });
  }

  clear(): void {
    this.handlers.clear();
  }

  get size(): number {
    return this.handlers.size;
  }
}

/** Human-readable RU labels for progress UI. */
export const EVENT_LABELS_RU: Record<EngineEventType, string> = {
  'run.started': 'Расследование запущено',
  'run.phase': 'Этап выполнения',
  'input.parsed': 'Входные данные разобраны',
  'module.started': 'Модуль запущен',
  'module.completed': 'Модуль завершён',
  'entity.discovered': 'Обнаружена сущность',
  'evidence.added': 'Добавлено наблюдение',
  'pivot.queued': 'Поставлен новый шаг расследования',
  'risk.updated': 'Оценка риска обновлена',
  warning: 'Предупреждение',
  'run.completed': 'Расследование завершено',
  'run.failed': 'Расследование прервано',
};

export const PHASE_LABELS_RU: Record<RunPhase, string> = {
  parse: 'Разбор входных данных',
  plan: 'Планирование сбора',
  collect: 'Сбор данных',
  expand: 'Расширение связей',
  fuse: 'Сведение наблюдений',
  analyse: 'Анализ графа и рисков',
  report: 'Формирование отчёта',
  persist: 'Сохранение результата',
};
