/**
 * TOMAHAWK OSINT ENGINE — module contract
 * ---------------------------------------------------------------------------
 * A module is a *pure-ish async function* with a declared capability surface.
 * The planner reads `accepts`/`produces` to build a DAG, so before spending a
 * single request it can tell you exactly what a query will reach.
 *
 * Invariants enforced by the engine:
 *   • a module never touches the network directly — it receives `ctx.http`
 *   • a module never throws to abort a run — it returns `notes` instead
 *   • a module never invents data: unavailable sources are reported as such
 *   • `requiresNetwork: true` modules are skipped entirely in offline mode
 */

import type { EdgeDraft, Entity, EntityId, EntityDraft, EntityType, Pivot } from './entity';
import type { EvidenceDraft } from './evidence';
import type { RiskFactorDraft } from './report';

// ── HTTP contract (implemented by net/http.ts, injected into every module) ────

export interface HttpRequestOptions {
  method?: 'GET' | 'HEAD';
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** Response cache TTL; 0 disables caching for this call. */
  cacheTtlMs?: number;
  signal?: AbortSignal;
  /** Return the body for non-2xx statuses instead of throwing. */
  allowErrorStatus?: boolean;
  /** `any` disables the account-name check inside `probe()`. */
  expect?: 'any' | 'html' | 'json';
  /** Force a specific transit chain for this request. */
  transit?: string[];
}

export interface HttpProbeResult {
  url: string;
  ok: boolean;
  status: number;
  reachable: boolean;
  markers: { softNotFound: boolean; containsName?: boolean };
  elapsedMs: number;
  error?: string;
}

export interface HttpGateway {
  readonly offline: boolean;
  text(url: string, init?: HttpRequestOptions): Promise<string>;
  json<T = unknown>(url: string, init?: HttpRequestOptions): Promise<T>;
  html(url: string, init?: HttpRequestOptions): Promise<string>;
  probe(url: string, init?: HttpRequestOptions): Promise<HttpProbeResult>;
  counters(): { requests: number; failures: number; cacheHits: number };
  /** Transport that actually delivered a URL (`direct`, `allorigins`, …). */
  viaOf?(url: string): string | undefined;
}

/** Profile/catalogue grouping. Mirrors `INVESTIGATION_PROFILES.categories`. */
export type ModuleCategory =
  | 'identity'
  | 'telecom'
  | 'infrastructure'
  | 'web'
  | 'social'
  | 'exposure'
  | 'crypto'
  | 'legal'
  | 'geospatial'
  | 'media'
  | 'temporal'
  | 'finance'
  | 'fusion'
  | 'custom';

export const MODULE_CATEGORY_LABELS_RU: Record<ModuleCategory, string> = {
  identity: 'Идентификация личности',
  telecom: 'Телеком и операторы',
  infrastructure: 'Инфраструктура и DNS',
  web: 'Веб-ресурсы',
  social: 'Социальные сети',
  exposure: 'Утечки и компромат',
  crypto: 'Блокчейн и финансы',
  legal: 'Реестры и право',
  geospatial: 'Геопространство',
  media: 'Медиа и файлы',
  temporal: 'Хронология',
  finance: 'Финансы',
  fusion: 'Сведение и аналитика',
  custom: 'Пользовательские',
};

/** Neighbour entity passed as context (id + relation, not the full node). */
export interface RelatedEntity {
  id: EntityId;
  type: EntityType;
  value: string;
  relation: string;
}

export interface ModuleInput {
  /** The entity being investigated. */
  entity: Entity;
  /** Closest neighbours from the graph — lets modules cross-reference. */
  related: RelatedEntity[];
  /** Original analyst query (for context-sensitive modules). */
  query?: string;
  /** Data that cannot be fetched by URL (images, captured pages, dumps). */
  artifacts?: Record<string, unknown>;
  /** Free-form task parameters from the analyst. */
  options?: Record<string, unknown>;
}

export interface ModuleContext {
  /** Unique id of the current run (for correlating logs/events). */
  runId?: string;
  http: HttpGateway;
  settings: Readonly<EngineSettings>;
  signal?: AbortSignal;
  /** Absolute wall-clock deadline (Unix ms) for the whole run. */
  deadline?: number;
  /** Emit progress/insight events visible to the UI. */
  emit?: (type: string, payload: Record<string, unknown>) => void;
  /** Structured logger that lands in the run trace. */
  log?: (message: string, data?: unknown) => void;
  /** Cache helper: `cached('key', ttlMs, producer)`. */
  cached?: <T>(key: string, ttlMs: number, producer: () => Promise<T>) => Promise<T>;
}

export interface ModuleResult {
  evidence?: EvidenceDraft[];
  entities?: EntityDraft[];
  edges?: EdgeDraft[];
  riskFactors?: RiskFactorDraft[];
  pivots?: Pivot[];
  /** Warnings / caveats shown to the analyst ("источник недоступен", …). */
  notes?: string[];
  /** Set when the module failed in a way worth reporting explicitly. */
  error?: string;
  /** Numeric summary for the trace (record counts, regions…). */
  metrics?: Record<string, number | string | boolean>;
}

export interface OsintModule {
  /** Stable id, `domain.capability`, e.g. `infrastructure.certificates`. */
  id: string;
  name: string;
  category: ModuleCategory;
  description: string;
  accepts: EntityType[];
  produces: EntityType[];
  requiresNetwork: boolean;
  /** Rough cost units (1 ≈ one HTTP request) used for budget planning. */
  cost?: number;
  /** 0..100 tie-breaker when several modules can process the same entity. */
  priority?: number;
  cacheTtlMs?: number;
  tags?: string[];
  dataSources?: string[];
  run(input: ModuleInput, ctx: ModuleContext): Promise<ModuleResult> | ModuleResult;
}

export interface EngineSettings {
  /** Transit backends for CORS-restricted requests, in order of preference. */
  transit: string[];
  /** Include heuristic/statistical inferences (disable for strict compliance). */
  includeHeuristics: boolean;
  /** Hard cap on graph size — prevents runaway expansion. */
  maxEntities: number;
  cacheMaxEntries: number;
  cacheTtlMs: number;
  requestTimeoutMs: number;
  userAgent: string;
  /** Parallel module executions. */
  concurrency: number;
  /** BFS depth of pivot expansion. */
  maxDepth: number;
  /** Wall-clock budget for the whole run. */
  budgetMs: number;
  /** Offline: only local algorithms and datasets, zero network requests. */
  offline: boolean;
  /** Active investigation profile id. */
  profile: string;
  /** Max pivots enqueued per level. */
  maxPivotsPerLevel?: number;
  /** Optional API keys — features are *gated*, never silently degraded. */
  apiKeys: {
    hibp?: string;
    shodan?: string;
    hunter?: string;
    [key: string]: string | undefined;
  };
}

export const DEFAULT_SETTINGS: EngineSettings = {
  transit: ['direct', 'allorigins', 'codetabs', 'jina'],
  includeHeuristics: true,
  maxEntities: 400,
  cacheMaxEntries: 600,
  cacheTtlMs: 10 * 60_000,
  requestTimeoutMs: 15_000,
  userAgent: 'TOMAHAWK-OSINT/1.0 (+https://github.com/karalik19-a11y/redskinassasin)',
  concurrency: 5,
  maxDepth: 2,
  budgetMs: 120_000,
  offline: false,
  profile: 'full-spectrum',
  maxPivotsPerLevel: 24,
  apiKeys: {},
};

/** Which entity types the catalogue can accept/produce overall. */
export function moduleCapabilities(modules: readonly OsintModule[]): { accepts: EntityType[]; produces: EntityType[] } {
  const accepts = new Set<EntityType>();
  const produces = new Set<EntityType>();
  for (const module of modules) {
    module.accepts.forEach((type) => accepts.add(type));
    module.produces.forEach((type) => produces.add(type));
  }
  return { accepts: [...accepts], produces: [...produces] };
}
