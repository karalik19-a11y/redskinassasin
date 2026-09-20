/**
 * TOMAHAWK OSINT ENGINE — report model
 * ---------------------------------------------------------------------------
 * The report is the *product*: a self-contained, reproducible document with an
 * integrity seal (SHA-256 over canonical JSON plus an evidence digest), an
 * explainable risk assessment, findings (synthesised conclusions), the entity
 * graph, a timeline, coverage gaps and a full run trace. Everything is plain
 * serialisable data — no classes, no cycles, no DOM.
 */

import type { Edge, Entity, EntityId } from './entity';
import type { Evidence, SourceKind } from './evidence';

export const ENGINE_VERSION = '1.0.0';

export type RiskLevel =
  | 'info'
  | 'minimal'
  | 'low'
  | 'medium'
  | 'moderate'
  | 'elevated'
  | 'high'
  | 'severe'
  | 'critical';

export const RISK_LEVEL_LABELS_RU: Record<RiskLevel, string> = {
  info: 'справочный',
  minimal: 'минимальный',
  low: 'низкий',
  medium: 'средний',
  moderate: 'умеренный',
  elevated: 'повышенный',
  high: 'высокий',
  severe: 'серьёзный',
  critical: 'критический',
};

/** Category buckets used by the noisy-OR breakdown. */
export type RiskCategory = 'identity' | 'legal' | 'financial' | 'cyber' | 'exposure' | 'opsec' | 'reputation' | 'infrastructure';

export interface RiskFactorDraft {
  id: string;
  label?: string;
  /** 0..1 severity of the observed signal *before* the library weight. */
  severity: number;
  /** 0..1 override of the library weight for this factor class. */
  weight?: number;
  category?: RiskCategory;
  explain?: string;
  entityIds?: string[];
  evidenceIds?: string[];
  recommendation?: string;
  tags?: string[];
}

export interface RiskFactor {
  id: string;
  label: string;
  category: RiskCategory;
  severity: number;
  weight: number;
  /** Marginal contribution to the noisy-OR total (0..1). */
  contribution: number;
  explain: string;
  moduleId: string;
  evidenceIds: string[];
}

export interface RiskAssessment {
  /** 0..100 exposure score. */
  score: number;
  level: RiskLevel;
  factors: RiskFactor[];
  /** Highest-contribution factors, ordered. */
  drivers: RiskFactor[];
  /** 0..1 — how much evidence underpins the score. */
  confidence: number;
  /** Score if the single biggest factor were remediated (counterfactual). */
  residualAfterTopRemediation: number;
  /** Contribution per category, in points. */
  breakdown: Record<RiskCategory, number>;
}

export interface Finding {
  id: string;
  /** Short headline for lists. */
  title: string;
  /** Evidence-grounded explanation. */
  detail: string;
  /** 0..100 ranking score (severity × confidence × salience). */
  score: number;
  severity: RiskLevel;
  /** 0..1 posterior confidence. */
  confidence: number;
  /** Module that produced the underlying evidence (or 'fusion'). */
  moduleId: string;
  category: string;
  entityIds: string[];
  evidenceIds: string[];
  tags: string[];
  recommendation?: string;
}

export interface TimelineEvent {
  timestamp: number;
  label: string;
  category: string;
  /** Entity the event belongs to (`undefined` for run-level events). */
  entityId: EntityId | undefined;
  evidenceId: string | undefined;
  precision: 'exact' | 'day' | 'month' | 'year';
}

export interface CentralityScore {
  degree: number;
  harmonic: number;
  eigenvector: number;
  /** Weighted composite used for ranking (0.4·degree + 0.3·harmonic + 0.3·eigen). */
  score: number;
}

export interface Community {
  id: number;
  /** Number of members (derived from `entityIds` when not set explicitly). */
  size?: number;
  entityIds: EntityId[];
  /** Most frequent entity type inside the community. */
  dominantType: string;
  /** Human-readable label for reports. */
  label: string;
}

export interface PredictedLink {
  from: EntityId;
  to: EntityId;
  /** 0..1 Adamic–Adar-style score. */
  score: number;
  reason: string;
  /** Neighbours shared by both endpoints (the evidence for the prediction). */
  sharedNeighbours?: EntityId[];
}

export interface GraphMetrics {
  entityCount: number;
  edgeCount: number;
  density: number;
  componentCount: number;
  largestComponentSize: number;
  centrality: Record<EntityId, CentralityScore>;
  communities: Community[];
  predictions: PredictedLink[];
  approximateDiameter: number;
  /** Most central nodes, ordered. */
  hubs: EntityId[];
  /** Nodes linking distinct communities (likely key figures/infrastructure). */
  bridges: EntityId[];
}

export type ModuleRunStatus = 'ok' | 'empty' | 'error' | 'skipped' | 'timeout' | 'offline';

export interface ModuleRunRecord {
  moduleId: string;
  /** Entity the module ran against. */
  entityId: EntityId;
  status: ModuleRunStatus;
  startedAt: number;
  durationMs: number;
  evidenceCount: number;
  entityCount: number;
  error?: string;
  /** Transport that delivered the module's data, when a single one dominated. */
  via?: string;
}

export interface RunTrace {
  runId: string;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  modules: ModuleRunRecord[];
  counters: {
    tasksPlanned: number;
    tasksExecuted: number;
    tasksSkipped: number;
    requests: number;
    requestFailures: number;
    cacheHits: number;
    entitiesDiscovered: number;
    evidenceCollected: number;
    pivotsExpanded: number;
  };
  budgetExhausted: boolean;
  truncated: boolean;
  /** Human-readable warnings collected during the run. */
  caveats: string[];
}

export interface CoverageSheet {
  ran: number;
  ok: number;
  failed: number;
  skipped: number;
}

export interface CoverageReport {
  byModule: Record<string, CoverageSheet>;
  /** 0..1 share of planned capabilities actually executed. */
  capabilitiesExercised: number;
  /** Evidence count per source class. */
  sourceKinds: Partial<Record<SourceKind, number>>;
}

/** Unresolved questions / recommended next steps for the analyst. */
export interface Workaround {
  id: string;
  label: string;
  detail: string;
  url?: string;
}

export interface SettingsDigest {
  offline: boolean;
  maxDepth: number;
  budgetMs: number;
  concurrency: number;
  transit: string[];
}

export interface Narrative {
  headline: string;
  summary: string;
  keyPoints: string[];
  caveats: string[];
}

export interface IntegritySeal {
  algorithm: 'SHA-256';
  /** Digest over the evidence chain (ids, keys, values, confidences). */
  evidenceDigest: string;
  /** Digest over the canonical report payload (includes run timestamps). */
  reportDigest: string;
  /**
   * Digest over the timestamp-free content projection (entities, edges,
   * evidence, findings, risk). Two runs over the same data produce the same
   * contentDigest even though generatedAt/durations differ — this is the seal
   * to publish or compare when verifying a shared report.
   */
  contentDigest: string;
  generatedBy: string;
  engineVersion: string;
}

export interface InvestigationReport {
  id: string;
  version: string;
  generatedAt: number;
  query: string;
  profile: string;
  settingsDigest: SettingsDigest;
  entities: Entity[];
  edges: Edge[];
  evidence: Evidence[];
  findings: Finding[];
  risk: RiskAssessment;
  timeline: TimelineEvent[];
  graph: GraphMetrics;
  trace: RunTrace;
  coverage: CoverageReport;
  narrative: Narrative;
  integrity: IntegritySeal;
}

/** Lightweight history record (no full report) for lists. */
export interface StoredInvestigation {
  id: string;
  createdAt: number;
  query: string;
  profile: string;
  riskScore: number;
  riskLevel: RiskLevel;
  entityCount: number;
  evidenceCount: number;
  headline: string;
  report: InvestigationReport;
}
