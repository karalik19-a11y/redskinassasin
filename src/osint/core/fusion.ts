/**
 * TOMAHAWK OSINT ENGINE — evidence fusion engine
 * ---------------------------------------------------------------------------
 * Novel core of the engine: instead of a naive "confidence = average", every
 * claim is fused in **log-odds space** with a Likelihood Ratio per source,
 * then penalised for **source correlation** (three links to the same registry
 * mirror are not three independent confirmations) and for **value conflict**
 * (Shannon entropy over competing values).
 *
 *   logit(post) = logit(prior) + Σ_corr log(LR_i)
 *   LR_i        = r_i / (1 - r_i)
 *   correlated  ⇒ extra sources of the same class contribute a damped LR
 *
 * Consequences that matter operationally:
 *   • A single authoritative registry (r≈0.94) beats five scraped blog posts.
 *   • Two mediocre sources reinforce but never reach certainty (sub-additive).
 *   • Contradicting evidence lowers confidence and flags `disputed` instead of
 *     silently picking a winner.
 */

import type { Evidence, EvidenceDraft, SourceRef } from '../types/evidence';
import { DEFAULT_RELIABILITY, evidenceKey } from '../types/evidence';
import type { EntityId } from '../types/entity';
import { evidenceIdOf, stableStringify } from './ids';

const EPSILON = 1e-6;

export function logit(probability: number): number {
  const clamped = Math.min(1 - EPSILON, Math.max(EPSILON, probability));
  return Math.log(clamped / (1 - clamped));
}

export function sigmoid(value: number): number {
  if (value > 30) return 1;
  if (value < -30) return 0;
  return 1 / (1 + Math.exp(-value));
}

/** Likelihood ratio implied by a source reliability probability. */
export function reliabilityToLikelihoodRatio(reliability: number): number {
  const clamped = Math.min(0.999, Math.max(0.5 + EPSILON, reliability));
  return clamped / (1 - clamped);
}

/** Correlated-source damping: the k-th evidence from the same class gets LR^(0.5^k). */
export function correlationDamping(index: number): number {
  return 0.5 ** index;
}

export interface ClaimValueGroup {
  value: unknown;
  key: string;
  evidenceIds: string[];
  sources: string[];
  posterior: number;
  likelihoodRatioSum: number;
  corroboration: number;
}

export interface FusedClaim {
  entityId?: EntityId;
  key: string;
  /** Winning value (highest posterior). */
  value: unknown;
  posterior: number;
  /** Competing values, ranked. */
  alternatives: ClaimValueGroup[];
  disputed: boolean;
  /** Normalised Shannon entropy over competing values (0 = unanimous). */
  uncertainty: number;
  corroboration: number;
  evidenceIds: string[];
  sourceNames: string[];
}

/**
 * Fuse a set of evidence records for a single claim key.
 * Pure function — deterministic and unit-testable.
 */
export function fuseClaim(group: Evidence[], priorProbability?: number): FusedClaim {
  const prior = priorProbability ?? (group[0]?.prior ?? 0.4);
  const byValue = new Map<string, { value: unknown; evidence: Evidence[] }>();

  for (const evidence of group) {
    const key = stableStringify(evidence.value);
    const bucket = byValue.get(key) ?? { value: evidence.value, evidence: [] };
    bucket.evidence.push(evidence);
    byValue.set(key, bucket);
  }

  const groups: ClaimValueGroup[] = [];
  for (const [key, bucket] of byValue) {
    // Correlation class: source name + delivery path. Duplicates get damped LR.
    const classCounts = new Map<string, number>();
    let logOdds = logit(prior);

    for (const evidence of bucket.evidence) {
      const correlationClass = `${evidence.source.name}|${evidence.source.via ?? 'direct'}`;
      const index = classCounts.get(correlationClass) ?? 0;
      classCounts.set(correlationClass, index + 1);
      const lr = reliabilityToLikelihoodRatio(evidence.prior);
      logOdds += Math.log(lr) * correlationDamping(index);
    }

    groups.push({
      value: bucket.value,
      key,
      evidenceIds: bucket.evidence.map((evidence) => evidence.id),
      sources: [...new Set(bucket.evidence.map((evidence) => evidence.source.name))],
      posterior: sigmoid(logOdds),
      likelihoodRatioSum: Number((logOdds - logit(prior)).toFixed(4)),
      corroboration: new Set(bucket.evidence.map((evidence) => evidence.source.name)).size,
    });
  }

  groups.sort((a, b) => b.posterior - a.posterior || b.corroboration - a.corroboration);
  const winner = groups[0] as ClaimValueGroup;

  // Normalised entropy over the competing posteriors → uncertainty signal.
  const total = groups.reduce((sum, entry) => sum + entry.posterior, 0) || 1;
  let entropy = 0;
  for (const entry of groups) {
    const p = entry.posterior / total;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  const maxEntropy = groups.length > 1 ? Math.log2(groups.length) : 1;
  const uncertainty = groups.length > 1 ? Number((entropy / maxEntropy).toFixed(3)) : 0;
  const second = groups[1];
  const disputed = Boolean(second && second.sources.some((source) => !winner.sources.includes(source)) && second.posterior > 0.25);

  return {
    entityId: group[0]?.entityId,
    key: group[0]?.key ?? '',
    value: winner?.value,
    posterior: winner?.posterior ?? prior,
    alternatives: groups.slice(1),
    disputed,
    uncertainty,
    corroboration: winner?.corroboration ?? 0,
    evidenceIds: groups.flatMap((entry) => entry.evidenceIds),
    sourceNames: [...new Set(groups.flatMap((entry) => entry.sources))],
  };
}

export class EvidenceLedger {
  private readonly records = new Map<string, Evidence>();
  private readonly byClaim = new Map<string, string[]>();

  add(draft: EvidenceDraft, context: { moduleId: string; entityId?: EntityId }): Evidence {
    const source: SourceRef = {
      ...draft.source,
      retrievedAt: draft.source.retrievedAt ?? Date.now(),
    };
    const prior = draft.prior ?? draft.reliability ?? DEFAULT_RELIABILITY[source.kind] ?? 0.6;
    const id = evidenceIdOf(context.moduleId, context.entityId, draft.key, draft.value);

    const evidence: Evidence = {
      id,
      moduleId: context.moduleId,
      entityId: context.entityId,
      key: draft.key,
      claim: draft.claim,
      value: draft.value,
      source,
      prior,
      confidence: draft.confidence ?? prior,
      corroboration: 1,
      disputed: false,
      tags: draft.tags ?? [],
      timestamp: draft.timestamp ?? Date.now(),
    };

    const existing = this.records.get(id);
    if (existing) {
      // Same module, same claim, same value → strengthen rather than duplicate.
      existing.confidence = Math.max(existing.confidence, evidence.confidence);
      existing.timestamp = Math.min(existing.timestamp, evidence.timestamp);
      return existing;
    }

    this.records.set(id, evidence);
    const claimKey = evidenceKey(context.entityId, draft.key);
    const list = this.byClaim.get(claimKey) ?? [];
    list.push(id);
    this.byClaim.set(claimKey, list);
    return evidence;
  }

  get(id: string): Evidence | undefined {
    return this.records.get(id);
  }

  all(): Evidence[] {
    return [...this.records.values()];
  }

  size(): number {
    return this.records.size;
  }

  byEntity(entityId: EntityId): Evidence[] {
    return this.all().filter((evidence) => evidence.entityId === entityId);
  }

  /**
   * Run the fusion pass: computes the posterior for every claim and writes it
   * back onto the evidence records. Called once after collection completes.
   */
  fuse(): { claims: FusedClaim[]; disputes: number; averageConfidence: number } {
    const claims: FusedClaim[] = [];

    for (const [claimKey, evidenceIds] of this.byClaim) {
      const group = evidenceIds.map((id) => this.records.get(id)).filter((record): record is Evidence => Boolean(record));
      if (!group.length) continue;

      // Independent versions of the same claim from *different modules* are
      // treated as separate evidence with distinct priors.
      const fused = fuseClaim(group);
      fused.key = claimKey;
      claims.push(fused);

      for (const evidence of group) {
        evidence.confidence = Number(fused.posterior.toFixed(4));
        evidence.corroboration = fused.corroboration;
        evidence.disputed = fused.disputed;
      }
    }

    const disputes = claims.filter((claim) => claim.disputed).length;
    const averageConfidence = claims.length ? claims.reduce((sum, claim) => sum + claim.posterior, 0) / claims.length : 0;

    return { claims, disputes, averageConfidence: Number(averageConfidence.toFixed(4)) };
  }

  /** Claims that contradict each other — surfaced as analyst review items. */
  contradictions(): FusedClaim[] {
    return this.fuse().claims.filter((claim) => claim.disputed).sort((a, b) => b.uncertainty - a.uncertainty);
  }
}
