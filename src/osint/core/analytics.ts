/**
 * TOMAHAWK OSINT ENGINE — graph analytics & temporal analysis
 * ---------------------------------------------------------------------------
 * This is where raw collection turns into intelligence:
 *   • centrality (degree / harmonic / eigenvector) → who or what is the pivot
 *   • label-propagation communities → the subject's natural groupings
 *   • Adamic–Adar link prediction → *hidden connections the analyst hasn't
 *     queried yet*, ranked and explained (the engine proposes the next pivots)
 *   • burst detection on the evidence timeline → moments when the subject's
 *     activity spiked (a compromise, a campaign, a life event)
 *   • cross-platform identity clustering via shared usernames/avatars
 */

import type { Edge, Entity, EntityId } from '../types/entity';
import type { Evidence } from '../types/evidence';
import type { Community, GraphMetrics, PredictedLink, TimelineEvent } from '../types/report';
import type { EntityGraph } from './graph';

export interface AnalyticsOptions {
  /** Skip O(V·E) betweenness/harmonic on very large graphs. */
  maxNodesForBetweenness?: number;
  maxPredictedLinks?: number;
}

/** Union–find connected components. */
function components(nodes: EntityId[], adjacency: Map<EntityId, Set<EntityId>>): EntityId[][] {
  const parent = new Map<EntityId, EntityId>();
  const find = (id: EntityId): EntityId => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root) as EntityId;
    let cursor = id;
    while (parent.get(cursor) !== root) {
      const next = parent.get(cursor) as EntityId;
      parent.set(cursor, root);
      cursor = next;
    }
    return root;
  };
  for (const node of nodes) parent.set(node, node);
  for (const [from, neighbours] of adjacency) {
    for (const to of neighbours) {
      const rootA = find(from);
      const rootB = find(to);
      if (rootA !== rootB) parent.set(rootA, rootB);
    }
  }
  const groups = new Map<EntityId, EntityId[]>();
  for (const node of nodes) {
    const root = find(node);
    const list = groups.get(root) ?? [];
    list.push(node);
    groups.set(root, list);
  }
  return [...groups.values()].sort((a, b) => b.length - a.length);
}

/** Label propagation community detection (deterministic ordering). */
function labelPropagation(
  nodes: EntityId[],
  adjacency: Map<EntityId, Set<EntityId>>,
  entityById: Map<EntityId, Entity>,
  iterations = 12,
): Community[] {
  const labels = new Map<EntityId, number>();
  nodes.forEach((node, index) => labels.set(node, index));

  const ordered = [...nodes].sort((a, b) => (adjacency.get(b)?.size ?? 0) - (adjacency.get(a)?.size ?? 0) || (a < b ? -1 : 1));
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let changed = false;
    for (const node of ordered) {
      const neighbours = adjacency.get(node);
      if (!neighbours?.size) continue;
      const votes = new Map<number, number>();
      for (const neighbour of neighbours) {
        const label = labels.get(neighbour) as number;
        votes.set(label, (votes.get(label) ?? 0) + 1);
      }
      const best = [...votes.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
      if (best && labels.get(node) !== best[0]) {
        labels.set(node, best[0]);
        changed = true;
      }
    }
    if (!changed) break;
  }

  const grouped = new Map<number, EntityId[]>();
  for (const node of nodes) {
    const label = labels.get(node) as number;
    const list = grouped.get(label) ?? [];
    list.push(node);
    grouped.set(label, list);
  }

  return [...grouped.values()]
    .filter((members) => members.length > 1)
    .sort((a, b) => b.length - a.length)
    .map((members, index) => {
      const typeCounts = new Map<string, number>();
      for (const id of members) {
        const type = entityById.get(id)?.type ?? 'unknown';
        typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
      }
      const dominant = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0];
      return {
        id: index,
        entityIds: members,
        dominantType: dominant?.[0] ?? 'unknown',
        label: `Кластер #${index + 1}: ${members.length} объектов (${dominant?.[0] ?? 'unknown'})`,
      };
    });
}

/** Eigenvector centrality via power iteration (deterministic start vector). */
function eigenvectorCentrality(nodes: EntityId[], adjacency: Map<EntityId, Set<EntityId>>, iterations = 60): Map<EntityId, number> {
  const vector = new Map<EntityId, number>();
  nodes.forEach((node) => vector.set(node, 1 / Math.max(1, nodes.length)));
  const damping = 0.85;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const next = new Map<EntityId, number>();
    for (const node of nodes) next.set(node, (1 - damping) / Math.max(1, nodes.length));
    for (const [from, neighbours] of adjacency) {
      if (!neighbours.size) continue;
      const share = (vector.get(from) ?? 0) * damping / neighbours.size;
      for (const to of neighbours) next.set(to, (next.get(to) ?? 0) + share);
    }
    let norm = 0;
    for (const value of next.values()) norm += value * value;
    norm = Math.sqrt(norm) || 1;
    for (const [node, value] of next) next.set(node, value / norm);
    vector.clear();
    for (const [node, value] of next) vector.set(node, value);
  }
  return vector;
}

/** Harmonic centrality (closeness variant that tolerates disconnected graphs). */
function harmonicCentrality(nodes: EntityId[], adjacency: Map<EntityId, Set<EntityId>>): Map<EntityId, number> {
  const scores = new Map<EntityId, number>();
  for (const source of nodes) {
    const distance = new Map<EntityId, number>([[source, 0]]);
    const queue: EntityId[] = [source];
    while (queue.length) {
      const current = queue.shift() as EntityId;
      const currentDistance = distance.get(current) as number;
      for (const neighbour of adjacency.get(current) ?? []) {
        if (distance.has(neighbour)) continue;
        distance.set(neighbour, currentDistance + 1);
        queue.push(neighbour);
      }
    }
    let sum = 0;
    for (const [node, value] of distance) if (node !== source && value > 0) sum += 1 / value;
    scores.set(source, sum / Math.max(1, nodes.length - 1));
  }
  return scores;
}

/**
 * Adamic–Adar link prediction over the 2-hop neighbourhood. Returns pairs that
 * share rare neighbours — statistically the strongest hint of an unobserved
 * relationship (same owner, same device, same operator, same crew).
 */
function predictLinks(graph: EntityGraph, adjacency: Map<EntityId, Set<EntityId>>, entityById: Map<EntityId, Entity>, limit: number): PredictedLink[] {
  const existing = new Set(graph.edgeList().map((edge) => `${edge.from}|${edge.to}`));
  const isConnected = (a: EntityId, b: EntityId): boolean => existing.has(`${a}|${b}`) || existing.has(`${b}|${a}`);
  const candidates = new Map<string, { from: EntityId; to: EntityId; shared: EntityId[]; score: number }>();

  for (const neighbours of adjacency.values()) {
    if (neighbours.size > 60) continue; // hubs would explode the candidate set
    const list = [...neighbours];
    for (let i = 0; i < list.length; i += 1) {
      const a = list[i] as EntityId;
      for (let j = i + 1; j < list.length; j += 1) {
        const b = list[j] as EntityId;
        if (a === b || isConnected(a, b)) continue;
        // Only consider "reasonable" pairings: infra↔infra or person↔asset etc.
        const typeA = entityById.get(a)?.type;
        const typeB = entityById.get(b)?.type;
        if (!typeA || !typeB) continue;
        const shared = [...(adjacency.get(a) ?? [])].filter((neighbour) => adjacency.get(b)?.has(neighbour));
        if (!shared.length) continue;
        const score = shared.reduce((sum, neighbour) => sum + 1 / Math.log(2 + (adjacency.get(neighbour)?.size ?? 1)), 0);
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        const existingCandidate = candidates.get(key);
        if (!existingCandidate || score > existingCandidate.score) {
          candidates.set(key, { from: a, to: b, shared, score });
        }
      }
    }
  }

  const ranked = [...candidates.values()].sort((a, b) => b.score - a.score).slice(0, limit);
  const maxScore = ranked[0]?.score ?? 1;
  return ranked.map((candidate) => ({
    from: candidate.from,
    to: candidate.to,
    score: Number((candidate.score / maxScore).toFixed(3)),
    sharedNeighbours: candidate.shared,
    reason: `Общие соседи (${candidate.shared.length}): ${candidate.shared
      .slice(0, 3)
      .map((id) => entityById.get(id)?.label ?? id)
      .join(', ')}${candidate.shared.length > 3 ? '…' : ''}`,
  }));
}

/** Two-sweep BFS approximation of the diameter of the largest component. */
function approximateDiameter(component: EntityId[], adjacency: Map<EntityId, Set<EntityId>>): number {
  if (component.length <= 1) return 0;
  const bfs = (start: EntityId): { far: EntityId; distance: number } => {
    const distance = new Map<EntityId, number>([[start, 0]]);
    const queue: EntityId[] = [start];
    let far = start;
    while (queue.length) {
      const current = queue.shift() as EntityId;
      const currentDistance = distance.get(current) as number;
      if (currentDistance > (distance.get(far) as number)) far = current;
      for (const neighbour of adjacency.get(current) ?? []) {
        if (distance.has(neighbour)) continue;
        distance.set(neighbour, currentDistance + 1);
        queue.push(neighbour);
      }
    }
    return { far, distance: distance.get(far) as number };
  };
  const first = bfs(component[0] as EntityId);
  return bfs(first.far).distance;
}

export function computeGraphMetrics(graph: EntityGraph, options: AnalyticsOptions = {}): GraphMetrics {
  const nodes = graph.entityList().map((entity) => entity.id);
  const entityById = new Map<EntityId, Entity>(graph.entityList().map((entity) => [entity.id, entity]));
  const adjacency = new Map<EntityId, Set<EntityId>>();
  for (const edge of graph.edgeList()) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, new Set());
    if (!adjacency.has(edge.to)) adjacency.set(edge.to, new Set());
    (adjacency.get(edge.from) as Set<EntityId>).add(edge.to);
    (adjacency.get(edge.to) as Set<EntityId>).add(edge.from);
  }

  const degrees = graph.degreeMap();
  const maxDegree = Math.max(1, ...degrees.values());
  const harmonic = options.maxNodesForBetweenness && nodes.length > options.maxNodesForBetweenness ? new Map<EntityId, number>() : harmonicCentrality(nodes, adjacency);
  const eigenvector = nodes.length > 1500 ? new Map<EntityId, number>() : eigenvectorCentrality(nodes, adjacency);
  const maxHarmonic = Math.max(1e-9, ...harmonic.values());
  const maxEigen = Math.max(1e-9, ...eigenvector.values());

  const centrality: GraphMetrics['centrality'] = {};
  for (const node of nodes) {
    const degree = (degrees.get(node) ?? 0) / maxDegree;
    const harmonicScore = (harmonic.get(node) ?? 0) / maxHarmonic;
    const eigenScore = (eigenvector.get(node) ?? 0) / maxEigen;
    centrality[node] = {
      degree: Number(degree.toFixed(4)),
      harmonic: Number(harmonicScore.toFixed(4)),
      eigenvector: Number(eigenScore.toFixed(4)),
      score: Number((0.4 * degree + 0.3 * harmonicScore + 0.3 * eigenScore).toFixed(4)),
    };
  }

  const groups = components(nodes, adjacency);
  const communities = labelPropagation(nodes, adjacency, entityById);
  const predictions = predictLinks(graph, adjacency, entityById, options.maxPredictedLinks ?? 12);

  const hubs = Object.entries(centrality)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 8)
    .map(([id]) => id);

  const bridges = [...degrees.entries()]
    .filter(([id]) => {
      const neighbours = adjacency.get(id) ?? new Set();
      if (neighbours.size < 2) return false;
      // A bridge node whose removal disconnects its neighbours (approximate:
      // neighbours come from ≥2 distinct communities).
      const labels = new Set([...neighbours].map((neighbour) => communities.find((community) => community.entityIds.includes(neighbour))?.id ?? -1));
      return labels.size >= 2;
    })
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([id]) => id);

  const edgeCount = graph.edgeCount;
  const density = nodes.length > 1 ? (2 * edgeCount) / (nodes.length * (nodes.length - 1)) : 0;

  return {
    entityCount: nodes.length,
    edgeCount,
    density: Number(density.toFixed(5)),
    componentCount: groups.length,
    largestComponentSize: groups[0]?.length ?? 0,
    centrality,
    communities,
    predictions,
    approximateDiameter: approximateDiameter(groups[0] ?? [], adjacency),
    hubs,
    bridges,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Temporal analysis
// ─────────────────────────────────────────────────────────────────────────────

export interface Burst {
  day: string;
  count: number;
  expected: number;
  /** Surprise = -log10 P(X ≥ k | Poisson λ) — how improbable this spike is. */
  surprise: number;
  entityIds: EntityId[];
  sampleLabels: string[];
}

const DAY_MS = 86_400_000;

/** Build a chronological timeline from timestamped evidence. */
export function buildTimeline(evidence: Evidence[], entityById: Map<EntityId, Entity>): TimelineEvent[] {
  const timeline: TimelineEvent[] = [];

  // 1. Retrieval events — every observation is a point on the timeline.
  for (const record of evidence) {
    if (!Number.isFinite(record.timestamp)) continue;
    timeline.push({
      timestamp: record.timestamp,
      label: record.claim,
      category: record.key.split('.')[0] ?? 'general',
      entityId: record.entityId,
      evidenceId: record.id,
      precision: 'exact',
    });
  }

  // 2. Claims that *carry* a date (registration, issue, expiry, birth) — these
  //    are historical facts, not retrieval events, and are parsed separately.
  for (const record of evidence) {
    if (!record.entityId || !/date|birthdate|registered|issued|expir|created/i.test(record.key)) continue;
    const parsed = parseLooseDate(String(record.value));
    if (!parsed) continue;
    const entity = entityById.get(record.entityId);
    timeline.push({
      timestamp: parsed.timestamp,
      label: `${record.claim}${entity ? ` — ${entity.label}` : ''}`,
      category: 'registry',
      entityId: record.entityId,
      evidenceId: record.id,
      precision: parsed.precision,
    });
  }

  return timeline.sort((a, b) => a.timestamp - b.timestamp);
}

/** Parse DD.MM.YYYY, YYYY-MM-DD and YYYY-only dates used by registries. */
export function parseLooseDate(input: string): { timestamp: number; precision: TimelineEvent['precision'] } | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(input);
  if (iso) return { timestamp: Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])), precision: 'day' };
  const ru = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(input);
  if (ru) return { timestamp: Date.UTC(Number(ru[3]), Number(ru[2]) - 1, Number(ru[1])), precision: 'day' };
  const month = /^(\d{2})\.(\d{4})$/.exec(input);
  if (month) return { timestamp: Date.UTC(Number(month[2]), Number(month[1]) - 1, 1), precision: 'month' };
  const year = /^(\d{4})$/.exec(input);
  if (year) return { timestamp: Date.UTC(Number(year[1]), 0, 1), precision: 'year' };
  if (/^\d{5}$/.test(input.slice(0, 5))) return { timestamp: Number(input.slice(0, 5)) * DAY_MS, precision: 'day' };
  return null;
}

/** Poisson surprise: how unexpected is `count` given the observed rate λ? */
export function poissonSurprise(count: number, lambda: number): number {
  if (lambda <= 0) return count > 0 ? 10 : 0;
  let cumulative = 0;
  let term = Math.exp(-lambda);
  for (let k = 0; k < count; k += 1) {
    cumulative += term;
    term *= lambda / (k + 1);
  }
  const tail = Math.max(1e-12, 1 - cumulative);
  return Number((-Math.log10(tail)).toFixed(2));
}

/** Detect activity bursts over the timeline (per-day Poisson surprise). */
export function detectBursts(timeline: TimelineEvent[], minBurst = 4): Burst[] {
  if (timeline.length < minBurst) return [];
  const buckets = new Map<string, TimelineEvent[]>();
  for (const event of timeline) {
    const day = new Date(event.timestamp).toISOString().slice(0, 10);
    const list = buckets.get(day) ?? [];
    list.push(event);
    buckets.set(day, list);
  }
  const lambda = timeline.length / Math.max(1, buckets.size);
  return [...buckets.entries()]
    .map(([day, events]) => ({
      day,
      count: events.length,
      expected: Number(lambda.toFixed(2)),
      surprise: poissonSurprise(events.length, lambda),
      entityIds: [...new Set(events.map((event) => event.entityId).filter((id): id is EntityId => Boolean(id)))],
      sampleLabels: events.slice(0, 4).map((event) => event.label),
    }))
    .filter((burst) => burst.count >= minBurst && burst.surprise >= 1.3)
    .sort((a, b) => b.surprise - a.surprise)
    .slice(0, 6);
}

/**
 * Cross-platform identity clustering: group profiles/accounts that share a
 * username skeleton or an identical avatar hash. This is the classic "same
 * person, many accounts" finding — computed, not guessed.
 */
export function clusterIdentities(entities: Entity[], edges: Edge[]): Array<{ key: string; reason: string; entityIds: EntityId[] }> {
  const clusters: Array<{ key: string; reason: string; entityIds: EntityId[] }> = [];
  const byAvatar = new Map<string, EntityId[]>();
  const byUsername = new Map<string, EntityId[]>();

  for (const entity of entities) {
    const avatar = entity.properties.avatarHash;
    if (typeof avatar === 'string' && avatar) {
      const list = byAvatar.get(avatar) ?? [];
      list.push(entity.id);
      byAvatar.set(avatar, list);
    }
    if (entity.type === 'username' || entity.type === 'social_profile') {
      const skeleton = String(entity.properties.skeleton ?? entity.value).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (skeleton.length >= 4) {
        const list = byUsername.get(skeleton) ?? [];
        list.push(entity.id);
        byUsername.set(skeleton, list);
      }
    }
  }

  for (const [hash, ids] of byAvatar) {
    if (ids.length > 1) clusters.push({ key: `avatar:${hash.slice(0, 12)}`, reason: 'Идентичный перцептивный хэш аватара на нескольких аккаунтах', entityIds: ids });
  }
  for (const [skeleton, ids] of byUsername) {
    const platforms = new Set(ids.map((id) => edges.find((edge) => edge.from === id || edge.to === id)?.relation ?? 'profile'));
    if (ids.length > 1 && platforms.size > 0) {
      clusters.push({ key: `username:${skeleton}`, reason: 'Одинаковый никнейм на нескольких платформах (reuse-паттерн)', entityIds: ids });
    }
  }
  return clusters.slice(0, 20);
}
