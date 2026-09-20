/**
 * TOMAHAWK OSINT ENGINE — persistence
 * ---------------------------------------------------------------------------
 * Runs are persisted through a tiny pluggable interface so the same engine can
 * run in a browser (IndexedDB/localStorage), a Node service (filesystem, Redis,
 * Postgres) or a test harness (memory). Nothing in the engine requires storage —
 * this is purely for case management.
 */

import type { InvestigationReport } from '../types/report';
import { stableStringify } from './ids';

export interface StoredInvestigation {
  id: string;
  createdAt: number;
  query: string;
  profile: string;
  riskScore: number;
  riskLevel: string;
  entityCount: number;
  report: InvestigationReport;
}

export interface InvestigationStore {
  save(record: StoredInvestigation): Promise<void>;
  list(): Promise<Array<Omit<StoredInvestigation, 'report'> & { report?: InvestigationReport }>>;
  load(id: string): Promise<StoredInvestigation | undefined>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

export class MemoryStore implements InvestigationStore {
  private readonly records = new Map<string, StoredInvestigation>();

  async save(record: StoredInvestigation): Promise<void> {
    this.records.set(record.id, record);
  }

  async list(): Promise<Array<Omit<StoredInvestigation, 'report'>>> {
    return [...this.records.values()]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(({ report: _report, ...meta }) => meta);
  }

  async load(id: string): Promise<StoredInvestigation | undefined> {
    return this.records.get(id);
  }

  async remove(id: string): Promise<void> {
    this.records.delete(id);
  }

  async clear(): Promise<void> {
    this.records.clear();
  }
}

/** Browser adapter over `localStorage` (or any compatible key-value store). */
export class KeyValueStore implements InvestigationStore {
  private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;
  private readonly prefix: string;

  constructor(storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>, prefix = 'tomahawk_osint_run') {
    if (storage) this.storage = storage;
    else if (typeof localStorage !== 'undefined') this.storage = localStorage;
    else throw new Error('KeyValueStore требует localStorage или совместимое хранилище');
    this.prefix = prefix;
  }

  private keyOf(id: string): string {
    return `${this.prefix}:${id}`;
  }

  async save(record: StoredInvestigation): Promise<void> {
    try {
      this.storage.setItem(this.keyOf(record.id), stableStringify(record));
    } catch {
      /* quota exceeded — persistence is best-effort */
    }
  }

  async list(): Promise<Array<Omit<StoredInvestigation, 'report'>>> {
    const out: Array<Omit<StoredInvestigation, 'report'>> = [];
    for (let index = 0; index < this.storage.length; index += 1) {
      const key = this.storage.key(index);
      if (!key?.startsWith(`${this.prefix}:`)) continue;
      const raw = this.storage.getItem(key);
      if (!raw) continue;
      try {
        const record = JSON.parse(raw) as StoredInvestigation;
        const { report: _report, ...meta } = record;
        out.push(meta);
      } catch {
        /* skip corrupt entries */
      }
    }
    return out.sort((a, b) => b.createdAt - a.createdAt);
  }

  async load(id: string): Promise<StoredInvestigation | undefined> {
    const raw = this.storage.getItem(this.keyOf(id));
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as StoredInvestigation;
    } catch {
      return undefined;
    }
  }

  async remove(id: string): Promise<void> {
    this.storage.removeItem(this.keyOf(id));
  }

  async clear(): Promise<void> {
    const doomed: string[] = [];
    for (let index = 0; index < this.storage.length; index += 1) {
      const key = this.storage.key(index);
      if (key?.startsWith(`${this.prefix}:`)) doomed.push(key);
    }
    for (const key of doomed) this.storage.removeItem(key);
  }
}

/** Compacts a report for storage (drops transient per-run traces). */
export function toStoredInvestigation(report: InvestigationReport): StoredInvestigation {
  return {
    id: report.id,
    createdAt: report.generatedAt,
    query: report.query,
    profile: report.profile,
    riskScore: report.risk.score,
    riskLevel: report.risk.level,
    entityCount: report.entities.length,
    report,
  };
}
