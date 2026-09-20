/**
 * TOMAHAWK OSINT ENGINE — evidence model
 * ---------------------------------------------------------------------------
 * Every claim the engine makes is an *evidence record*: what was observed,
 * where it came from, through which transport, when, and how reliable that class
 * of source is. No code path adds a fact without a source — that invariant is
 * what separates an intelligence engine from a generator.
 *
 * `EvidenceDraft` is emitted by modules; `EvidenceLedger.add()` stamps `id`,
 * `moduleId`, `timestamp`, resolves the source prior and stores the record.
 * `core/fusion.ts` then combines competing observations of the same claim in
 * log-odds space, producing `posterior`/`corroboration`/`disputed` back on each
 * record.
 */

export type SourceKind =
  | 'api' // machine-readable endpoint
  | 'registry' // official state register
  | 'dns' // DNS/WHOIS/RDAP
  | 'web' // page scrape
  | 'archive' // web archive / cached copy
  | 'dataset' // offline reference dataset
  | 'algorithm' // computed locally from raw data
  | 'heuristic' // statistical/behavioural inference
  | 'analyst' // human input
  | 'leak' // breach corpus
  | 'social' // social platform
  | 'media'; // file metadata

/** Default source prior per delivery class (used when a module omits one). */
export const DEFAULT_RELIABILITY: Record<SourceKind, number> = {
  registry: 0.94,
  algorithm: 0.93,
  dataset: 0.9,
  api: 0.88,
  dns: 0.86,
  leak: 0.78,
  media: 0.8,
  analyst: 0.9,
  archive: 0.7,
  web: 0.66,
  social: 0.68,
  heuristic: 0.48,
};

export const SOURCE_KIND_LABELS_RU: Record<SourceKind, string> = {
  api: 'программный интерфейс',
  registry: 'государственный реестр',
  dns: 'DNS/WHOIS/RDAP',
  web: 'веб-страница',
  archive: 'веб-архив',
  dataset: 'офлайн-набор данных',
  algorithm: 'локальный алгоритм',
  heuristic: 'эвристика/статистика',
  analyst: 'данные аналитика',
  leak: 'утечка данных',
  social: 'социальная платформа',
  media: 'метаданные файла',
};

export interface SourceRef {
  /** Human-readable source name, e.g. "ЕГРЮЛ (ФНС)" or "RDAP / RIPE". */
  name: string;
  kind: SourceKind;
  url?: string;
  /** Transport actually used: "direct" | "corsproxy.io" | "allorigins"… */
  via?: string;
  license?: string;
  /** Free-form retrieval context (query, selector, HTTP status…). */
  detail?: string;
  retrievedAt?: number;
}

export interface EvidenceDraft {
  /** Claim key — stable identifier of the assertion ("geo.city", "org.inn"). */
  key: string;
  /** What is claimed, in Russian, human-readable. */
  claim: string;
  /** Structured payload (numbers, ids, raw snippets). */
  value: unknown;
  source: SourceRef;
  /** 0..1 prior used by fusion; falls back to the source-class default. */
  prior?: number;
  /** 0..1 backwards-compatible alias of `prior` used by modules. */
  reliability?: number;
  /** 0..1 post-fusion confidence (set by the ledger). */
  confidence?: number;
  category?: string;
  tags?: string[];
  /** Entity this evidence is attached to (set by the engine). */
  entityId?: string;
  /** Observation timestamp in the source (Unix ms), when known. */
  timestamp?: number;
  observedAt?: string | number;
}

export interface Evidence extends Required<Pick<EvidenceDraft, 'key' | 'claim' | 'value'>> {
  id: string;
  moduleId: string;
  entityId?: string;
  source: SourceRef;
  /** Reliability prior implied by the source class. */
  prior: number;
  /** Posterior confidence after fusion. */
  confidence: number;
  /** Number of independent sources supporting the winning claim value. */
  corroboration: number;
  /** True when a competing value is backed by an independent source. */
  disputed: boolean;
  tags: string[];
  timestamp: number;
  category?: string;
}

/** Claim-grouping key: one claim key per entity. */
export function evidenceKey(entityId: string | undefined, key: string): string {
  return entityId ? `${entityId}|${key}` : key;
}
