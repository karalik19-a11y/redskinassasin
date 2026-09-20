/**
 * TOMAHAWK OSINT ENGINE — deterministic identifiers
 * Stable, content-addressed ids keep the graph merge-able across runs and
 * across processes (same input ⇒ same node id ⇒ cache/dedup/audit work).
 */

import type { EntityDraft, EntityId, EntityType } from '../types/entity';
import { sha256Async, sha256 } from '../algo/hashes';

/** FNV-1a 64-bit over UTF-16 code units, returned as 16-char hex. */
export function fnv1a64(input: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, '0');
}

/** Deterministic entity id from type + canonical value. */
export function entityIdOf(type: EntityType, value: string): EntityId {
  return `${type}:${value}`;
}

export function entityIdOfDraft(draft: EntityDraft): EntityId {
  return entityIdOf(draft.type, draft.value);
}

/** Deterministic evidence id — identical claims from the same module collapse. */
export function evidenceIdOf(moduleId: string, entityId: string | undefined, key: string, value: unknown): string {
  const payload = `${moduleId}|${entityId ?? '_'}|${key}|${stableStringify(value)}`;
  return `ev_${fnv1a64(payload)}`;
}

export function edgeIdOf(from: string, to: string, relation: string): string {
  return `eg_${fnv1a64(`${from}->${relation}->${to}`)}`;
}

export function runId(prefix = 'RUN'): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${stamp}-${rand}`;
}

/**
 * Stable JSON serialisation with sorted keys — required for reproducible
 * digests (integrity hashing) and cache keys.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

/** Deep-clone that is structuredClone-aware but works everywhere. */
export function deepClone<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    try {
      return globalThis.structuredClone(value) as T;
    } catch {
      /* fall through to JSON clone */
    }
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

/** SHA-256 that never throws — falls back to the pure-JS implementation. */
export async function sha256AsyncSafe(input: string): Promise<string> {
  try {
    return await sha256Async(input);
  } catch {
    return sha256(input);
  }
}
