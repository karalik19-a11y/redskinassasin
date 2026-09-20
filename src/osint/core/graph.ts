/**
 * TOMAHAWK OSINT ENGINE — entity graph
 * ---------------------------------------------------------------------------
 * The graph is the single source of truth for a run. Modules never mutate it
 * directly: they return drafts, the engine merges them. Merging is
 * *idempotent* and *order-independent* (union of aliases/tags, monotonic
 * confidence, minimum depth), so results are reproducible regardless of the
 * order in which concurrent modules finish — a requirement for evidence that
 * may end up in court or a regulatory filing.
 *
 * Includes an alias index (skeleton-based) so the same phone/e-mail/name
 * written differently resolves to one node instead of fragmenting the graph.
 */

import type { Edge, EdgeDraft, Entity, EntityDraft, EntityId, EntityType } from '../types/entity';
import { entityIdOf, edgeIdOf } from './ids';
import { skeletonize } from '../algo/stringdistance';

export interface MergeOptions {
  moduleId: string;
  depth?: number;
  evidenceId?: string;
  viaEntity?: EntityId;
  /** Overrides the default confidence for drafts that do not carry one. */
  defaultConfidence?: number;
  tags?: string[];
}

export interface EntityGraphOptions {
  maxEntities?: number;
}

export class EntityGraph {
  private readonly nodes = new Map<EntityId, Entity>();
  private readonly adjacency = new Map<EntityId, Set<EntityId>>();
  private readonly edgesByPair = new Map<string, Edge>();
  private readonly aliasIndex = new Map<string, EntityId>();
  private readonly maxEntities: number;
  /** True when the graph hit its capacity guard and stopped accepting nodes. */
  truncated = false;

  constructor(options: EntityGraphOptions = {}) {
    this.maxEntities = options.maxEntities ?? 500;
  }

  get size(): number {
    return this.nodes.size;
  }

  get edgeCount(): number {
    return this.edgesByPair.size;
  }

  has(id: EntityId): boolean {
    return this.nodes.has(id);
  }

  get(id: EntityId): Entity | undefined {
    return this.nodes.get(id);
  }

  entityList(): Entity[] {
    return [...this.nodes.values()];
  }

  edgeList(): Edge[] {
    return [...this.edgesByPair.values()];
  }

  /** Merge a draft (or return `undefined` when the graph is at capacity). */
  merge(draft: EntityDraft, options: MergeOptions): Entity | undefined {
    const canonical = resolveCanonical(draft.type, draft.value);
    const id = entityIdOf(draft.type, canonical);
    const now = Date.now();
    const existing = this.nodes.get(id);

    const skeleton = skeletonize(canonical);
    const aliasHit = this.aliasIndex.get(`${draft.type}:${skeleton}`);
    if (!existing && aliasHit && aliasHit !== id) {
      // The skeleton collided with an existing node of the same type: this is
      // the same real-world object written differently → merge into it.
      const target = this.nodes.get(aliasHit);
      if (target) {
        if (!target.aliases.includes(draft.value)) target.aliases.push(draft.value);
        if (options.evidenceId) target.evidenceIds.push(options.evidenceId);
        target.lastSeen = now;
        return target;
      }
    }

    if (!existing) {
      if (this.nodes.size >= this.maxEntities) {
        this.truncated = true;
        return undefined;
      }
      const entity: Entity = {
        id,
        type: draft.type,
        value: canonical,
        label: draft.label ?? draft.value,
        properties: { ...(draft.properties ?? {}) },
        aliases: [...new Set([draft.value, ...(draft.aliases ?? [])])].filter((alias) => alias !== canonical),
        confidence: draft.confidence ?? options.defaultConfidence ?? 0.75,
        sources: [options.moduleId],
        evidenceIds: options.evidenceId ? [options.evidenceId] : [],
        depth: options.depth ?? 0,
        firstSeen: now,
        lastSeen: now,
        tags: [...new Set([...(draft.tags ?? []), ...(options.tags ?? [])])],
        notes: [...(draft.notes ?? [])],
      };
      this.nodes.set(id, entity);
      this.aliasIndex.set(`${draft.type}:${skeleton}`, id);
      return entity;
    }

    // ── Merge into an existing node ─────────────────────────────────────────
    if (!existing.sources.includes(options.moduleId)) existing.sources.push(options.moduleId);
    if (options.evidenceId && !existing.evidenceIds.includes(options.evidenceId)) existing.evidenceIds.push(options.evidenceId);
    for (const alias of [draft.value, ...(draft.aliases ?? [])]) {
      if (alias !== existing.value && !existing.aliases.includes(alias)) existing.aliases.push(alias);
    }
    for (const tag of [...(draft.tags ?? []), ...(options.tags ?? [])]) {
      if (!existing.tags.includes(tag)) existing.tags.push(tag);
    }
    for (const note of draft.notes ?? []) if (!existing.notes.includes(note)) existing.notes.push(note);

    for (const [key, value] of Object.entries(draft.properties ?? {})) {
      const current = existing.properties[key];
      // Never overwrite richer data with a placeholder; do overwrite undefined.
      if (current === undefined || current === null || current === '' || (typeof value === 'string' && value.length > String(current).length)) {
        existing.properties[key] = value;
      }
    }

    existing.confidence = Math.max(existing.confidence, draft.confidence ?? options.defaultConfidence ?? 0.75);
    existing.depth = Math.min(existing.depth, options.depth ?? existing.depth);
    existing.lastSeen = now;
    return existing;
  }

  /** Insert or strengthen an edge; duplicate (from,to,relation) triples merge. */
  link(draft: EdgeDraft, options: { evidenceId?: string; moduleId?: string } = {}): Edge | undefined {
    const from = typeof draft.from === 'string' ? draft.from : entityIdOf(draft.from.type, resolveCanonical(draft.from.type, draft.from.value));
    const to = typeof draft.to === 'string' ? draft.to : entityIdOf(draft.to.type, resolveCanonical(draft.to.type, draft.to.value));
    if (!this.nodes.has(from) || !this.nodes.has(to)) return undefined;
    if (from === to) return undefined;

    const id = edgeIdOf(from, to, draft.relation);
    const existing = this.edgesByPair.get(id);
    if (existing) {
      existing.weight = Math.max(existing.weight, draft.weight ?? 0.5);
      existing.confidence = Math.max(existing.confidence, draft.confidence ?? 0.7);
      if (options.evidenceId && !existing.evidenceIds.includes(options.evidenceId)) existing.evidenceIds.push(options.evidenceId);
      return existing;
    }

    const edge: Edge = {
      id,
      from,
      to,
      relation: draft.relation,
      weight: draft.weight ?? 0.5,
      confidence: draft.confidence ?? 0.7,
      evidenceIds: options.evidenceId ? [options.evidenceId] : [],
      directed: draft.directed ?? true,
      createdAt: Date.now(),
    };
    this.edgesByPair.set(id, edge);
    this.adjacencyGet(from).add(to);
    this.adjacencyGet(to).add(from);
    return edge;
  }

  private adjacencyGet(id: EntityId): Set<EntityId> {
    let set = this.adjacency.get(id);
    if (!set) {
      set = new Set<EntityId>();
      this.adjacency.set(id, set);
    }
    return set;
  }

  neighbours(id: EntityId): EntityId[] {
    return [...(this.adjacency.get(id) ?? [])];
  }

  degreeMap(): Map<EntityId, number> {
    const degrees = new Map<EntityId, number>();
    for (const [id, neighbours] of this.adjacency) degrees.set(id, neighbours.size);
    return degrees;
  }

  findByType(type: EntityType): Entity[] {
    return this.entityList().filter((entity) => entity.type === type);
  }

  /**
   * Context passed to modules: the entity itself plus its closest neighbours.
   * Ordering by edge confidence keeps the most trustworthy context first.
   */
  contextFor(id: EntityId, limit = 12): Array<{ id: string; type: EntityType; value: string; relation: string }> {
    const self = this.nodes.get(id);
    if (!self) return [];
    const neighbours = this.neighbours(id)
      .map((neighbourId) => {
        const entity = this.nodes.get(neighbourId);
        const edge = this.edgeList().find((candidate) => (candidate.from === id && candidate.to === neighbourId) || (candidate.to === id && candidate.from === neighbourId));
        return entity ? { id: entity.id, type: entity.type, value: entity.value, relation: String(edge?.relation ?? 'related_to'), confidence: edge?.confidence ?? 0.5 } : undefined;
      })
      .filter((entry): entry is { id: string; type: EntityType; value: string; relation: string; confidence: number } => Boolean(entry))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
    return neighbours.map(({ id: neighbourId, type, value, relation }) => ({ id: neighbourId, type, value, relation }));
  }

  /** Transitive neighbourhood used by the analytics layer. */
  subgraph(rootIds: EntityId[], depth = 2): { nodes: EntityId[]; edges: Edge[] } {
    const visited = new Set<EntityId>();
    const queue: Array<{ id: EntityId; d: number }> = rootIds.map((id) => ({ id, d: 0 }));
    while (queue.length) {
      const current = queue.shift() as { id: EntityId; d: number };
      if (visited.has(current.id)) continue;
      visited.add(current.id);
      if (current.d >= depth) continue;
      for (const neighbour of this.neighbours(current.id)) {
        if (!visited.has(neighbour)) queue.push({ id: neighbour, d: current.d + 1 });
      }
    }
    const edges = this.edgeList().filter((edge) => visited.has(edge.from) && visited.has(edge.to));
    return { nodes: [...visited], edges };
  }

  /** Shortest path (unweighted hops) — "how are these two connected?". */
  shortestPath(from: EntityId, to: EntityId, maxHops = 6): EntityId[] | null {
    if (from === to) return [from];
    const previous = new Map<EntityId, EntityId>();
    const seen = new Set<EntityId>([from]);
    let frontier: EntityId[] = [from];
    for (let hop = 0; hop < maxHops; hop += 1) {
      const next: EntityId[] = [];
      for (const id of frontier) {
        for (const neighbour of this.neighbours(id)) {
          if (seen.has(neighbour)) continue;
          seen.add(neighbour);
          previous.set(neighbour, id);
          if (neighbour === to) {
            const path = [to];
            let cursor = to;
            while (previous.has(cursor)) {
              cursor = previous.get(cursor) as EntityId;
              path.unshift(cursor);
            }
            return path;
          }
          next.push(neighbour);
        }
      }
      frontier = next;
      if (!frontier.length) break;
    }
    return null;
  }

  toJSON(): { nodes: Entity[]; edges: Edge[]; truncated: boolean } {
    return { nodes: this.entityList(), edges: this.edgeList(), truncated: this.truncated };
  }

  static fromJSON(payload: { nodes: Entity[]; edges: Edge[] }): EntityGraph {
    const graph = new EntityGraph({ maxEntities: payload.nodes.length + 100 });
    for (const node of payload.nodes) {
      graph.nodes.set(node.id, { ...node });
      graph.aliasIndex.set(`${node.type}:${skeletonize(node.value)}`, node.id);
      for (const alias of node.aliases ?? []) graph.aliasIndex.set(`${node.type}:${skeletonize(alias)}`, node.id);
    }
    for (const edge of payload.edges) {
      graph.edgesByPair.set(edge.id, { ...edge });
      graph.adjacencyGet(edge.from).add(edge.to);
      graph.adjacencyGet(edge.to).add(edge.from);
    }
    return graph;
  }
}

/**
 * Canonicalise a value per entity type so equivalent inputs collapse:
 * `+7 (916) 402-91-88` → `+79164029188`, `Example.COM` → `example.com`, etc.
 * Kept intentionally conservative: over-normalising merges distinct people.
 */
export function resolveCanonical(type: EntityType, value: string): string {
  const trimmed = value.trim();
  switch (type) {
    case 'phone':
      return trimmed.replace(/[^\d+]/g, '').replace(/^8(\d{10})$/, '+7$1');
    case 'email':
    case 'domain':
    case 'subdomain':
    case 'url':
      return trimmed.toLowerCase();
    case 'username':
    case 'alias':
      return trimmed.replace(/^@/, '').toLowerCase();
    case 'crypto_address':
      return trimmed;
    case 'tax_id':
    case 'bank_account':
    case 'document':
    case 'ip':
      return trimmed.replace(/\s+/g, '');
    case 'person':
      return trimmed.replace(/\s+/g, ' ').replace(/ё/g, 'е').toLowerCase();
    case 'location':
      return trimmed.replace(/\s+/g, ' ').toLowerCase();
    default:
      return trimmed;
  }
}
