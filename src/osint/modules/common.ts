/**
 * TOMAHAWK OSINT ENGINE — module authoring helpers
 * Keeps every module short and honest: one line per fact, with its source,
 * delivery path and reliability — the shape the fusion engine expects.
 */

import type { EdgeDraft, EntityDraft, EntityId, EntityType, Pivot } from '../types/entity';
import type { EvidenceDraft, SourceKind, SourceRef } from '../types/evidence';
import type { RiskFactorDraft } from '../types/report';

export interface SourceSpec {
  name: string;
  kind: SourceKind;
  url?: string;
  via?: string;
  license?: string;
}

export function evidence(
  key: string,
  claim: string,
  value: unknown,
  source: SourceSpec,
  extra: Partial<EvidenceDraft> = {},
): EvidenceDraft {
  return {
    key,
    claim,
    value,
    source: source as SourceRef,
    tags: extra.tags ?? [],
    ...extra,
  };
}

export function entity(type: EntityType, value: string, options: Partial<EntityDraft> = {}): EntityDraft {
  return { type, value, ...options };
}

export function edge(from: EntityId | EntityDraft, to: EntityId | EntityDraft, relation: string, weight = 0.6, confidence = 0.7): EdgeDraft {
  return { from, to, relation, weight, confidence };
}

export function pivot(type: EntityType, value: string, options: Partial<Pivot> = {}): Pivot {
  return { type, value, confidence: 0.6, ...options };
}

export function risk(id: string, severity: number, explain: string, evidenceIds: string[] = [], extra: Partial<RiskFactorDraft> = {}): RiskFactorDraft {
  return { id, severity: Math.max(0, Math.min(1, severity)), explain, evidenceIds, ...extra };
}

/** Related entities of a given type already present in the graph context. */
export function relatedOf(
  related: ReadonlyArray<{ id: string; type: EntityType; value: string; relation: string }>,
  type: EntityType,
): Array<{ id: string; type: EntityType; value: string; relation: string }> {
  return related.filter((entry) => entry.type === type);
}

/** Sniff the transport that actually delivered a payload (for provenance). */
export function viaOf(response: unknown): string | undefined {
  const candidate = response as { via?: string } | undefined;
  return candidate?.via;
}

export function truncate(value: string, length = 160): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

export function isAborted(signal: AbortSignal): boolean {
  return signal.aborted;
}

/** Human labels for the messenger/directory links used across modules. */
export const DIRECTORY_LINKS = {
  rusprofile: (query: string) => `https://www.rusprofile.ru/search?query=${encodeURIComponent(query)}`,
  listOrg: (query: string) => `https://www.list-org.com/search?type=all&val=${encodeURIComponent(query)}`,
  spark: (query: string) => `https://spark-interfax.ru/search?query=${encodeURIComponent(query)}`,
  egrul: (query: string) => `https://egrul.nalog.ru/index.html?query=${encodeURIComponent(query)}`,
  fssp: () => 'https://fssp.gov.ru/iss/ip',
  kadArbitr: (query: string) => `https://kad.arbitr.ru/?query=${encodeURIComponent(query)}`,
  sudrf: (query: string) => `https://sudrf.ru/index.php?query=${encodeURIComponent(query)}`,
  rosreestr: (query: string) => `https://pkk.rosreestr.ru/#/search/${encodeURIComponent(query)}`,
  gibdd: () => 'https://гибдд.рф/check/auto',
  hibp: (email: string) => `https://haveibeenpwned.com/account/${encodeURIComponent(email)}`,
  dehashed: (query: string) => `https://dehashed.com/search?query=${encodeURIComponent(query)}`,
  intelx: (query: string) => `https://intelx.io/?s=${encodeURIComponent(query)}`,
  leakcheck: (query: string) => `https://leakcheck.io/?query=${encodeURIComponent(query)}`,
  gravatar: (hash: string) => `https://www.gravatar.com/avatar/${hash}?d=404`,
  yandexImages: (url: string) => `https://yandex.ru/images/search?rpt=imageview&url=${encodeURIComponent(url)}`,
  googleLens: (url: string) => `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(url)}`,
  tineye: (url: string) => `https://tineye.com/search?url=${encodeURIComponent(url)}`,
  pimeyes: () => 'https://pimeyes.com/en',
  opensecrets: (query: string) => `https://opencorporates.com/companies?q=${encodeURIComponent(query)}`,
  openSanctions: (query: string) => `https://www.opensanctions.org/search/?q=${encodeURIComponent(query)}`,
  gleif: (query: string) => `https://search.gleif.org/#/record/${encodeURIComponent(query)}`,
  wikidata: (query: string) => `https://www.wikidata.org/w/index.php?search=${encodeURIComponent(query)}`,
} as const;
