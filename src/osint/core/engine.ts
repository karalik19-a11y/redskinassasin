/**
 * TOMAHAWK OSINT ENGINE — orchestrator
 * ---------------------------------------------------------------------------
 * `createOsintEngine()` returns a self-contained, importable investigation
 * engine. One call to `investigate()` performs the whole cycle:
 *
 *   1. auto-triage the input (identifiers validated by real checksums)
 *   2. plan a module DAG from the declared capability contracts
 *   3. collect concurrently under a hard wall-clock budget, following
 *      discovered pivots breadth-first (recursive OSINT expansion)
 *   4. fuse every claim in log-odds space with source-correlation damping
 *   5. run graph analytics (centrality, communities, link prediction) and
 *      temporal burst detection
 *   6. score explainable risk via a noisy-OR factor model
 *   7. emit a reproducible, hash-sealed report that exports to
 *      JSON / CSV / GraphML / STIX 2.1 / Markdown
 *
 * The engine has no DOM, Node or React dependencies in its core, so the same
 * instance runs in a browser SPA, a Web Worker, Node, Deno, Bun, an edge
 * runtime or a mobile app.
 */

import type { Entity, EntityDraft, EntityType, Pivot } from '../types/entity';
import type { ModuleResult, OsintModule, EngineSettings, HttpGateway, HttpRequestOptions, HttpProbeResult } from '../types/module';
import { DEFAULT_SETTINGS } from '../types/module';
import type { Evidence } from '../types/evidence';
import type { CoverageReport, Finding, InvestigationReport, ModuleRunRecord, RunTrace } from '../types/report';
import { ENGINE_VERSION } from '../types/report';
import { EventBus, type EngineEvent, type EngineEventHandler } from '../types/events';

import { EntityGraph, resolveCanonical } from './graph';
import { EvidenceLedger } from './fusion';
import { RiskModel } from './risk';
import { computeGraphMetrics, buildTimeline, detectBursts, clusterIdentities } from './analytics';
import { generateFindings } from './findings';
import { ModuleRegistry, Planner } from './planner';
import { Cache, MemoryCacheStore } from './cache';
import { HttpClient } from '../net/http';
import { RunController, Semaphore, Stopwatch, sleep } from './concurrency';
import { OsintError, errorMessage } from './errors';
import { entityIdOf, runId as newRunId, sha256AsyncSafe, stableStringify } from './ids';
import { parseSeeds, seedHeadline, extractObservables } from './seeds';
import { exportReport, type ExportFormat } from './export';
import { resolveProfile, INVESTIGATION_PROFILES } from '../presets/profiles';
import type { InvestigationStore, StoredInvestigation } from './store';
import { toStoredInvestigation } from './store';
import { createDefaultModules } from '../modules';

export interface EngineOptions {
  settings?: Partial<EngineSettings>;
  /** Investigation profile id (see `INVESTIGATION_PROFILES`); overrides `settings.profile`. */
  profile?: string;
  /** Custom module set. When omitted the built-in catalogue is registered. */
  modules?: readonly OsintModule[];
  cache?: Cache;
  store?: InvestigationStore;
  /** Override fetch (tests, proxies, instrumented clients). */
  fetchImpl?: typeof fetch;
  onEvent?: EngineEventHandler;
  /** Register the built-in module catalogue (default `true`). */
  includeBuiltins?: boolean;
}

export interface InvestigateOptions {
  /** Raw analyst input — anything: phone, ИНН, name, domain, address, dump. */
  input?: string;
  /** Pre-parsed seed entities (bypasses auto-triage). */
  entities?: EntityDraft[];
  /** Raw payloads (e.g. an uploaded image) handed to media modules. */
  artifacts?: Record<string, unknown>;
  profile?: string;
  settings?: Partial<EngineSettings>;
  /** Progress callback equivalent to `engine.events.on(...)`. */
  onEvent?: EngineEventHandler;
  signal?: AbortSignal;
  /** Persist the result through the configured store. */
  persist?: boolean;
}

export interface PlanPreview {
  profile: string;
  seeds: EntityDraft[];
  notes: string[];
  rejected: Array<{ value: string; type: EntityType; reason: string }>;
  modules: Array<{ id: string; name: string; category: string; network: boolean }>;
  skipped: { offline: string[]; profile: string[] };
  estimatedRequests: number;
}

export class OsintEngine {
  readonly events = new EventBus();
  private readonly registry = new ModuleRegistry();
  private settings: EngineSettings;
  private readonly cache: Cache;
  private readonly store?: InvestigationStore;
  private readonly fetchImpl?: typeof fetch;

  constructor(options: EngineOptions = {}) {
    this.settings = { ...DEFAULT_SETTINGS, ...(options.settings ?? {}) };
    if (options.profile) this.settings.profile = options.profile;
    const profile = resolveProfile(this.settings.profile);
    this.settings = { ...this.settings, maxDepth: options.settings?.maxDepth ?? profile.maxDepth, budgetMs: options.settings?.budgetMs ?? profile.budgetMs };
    this.cache = options.cache ?? new Cache(new MemoryCacheStore(this.settings.cacheMaxEntries));
    this.store = options.store;
    this.fetchImpl = options.fetchImpl;
    if (options.includeBuiltins !== false) this.registry.registerMany(createDefaultModules());
    if (options.modules) this.registry.registerMany(options.modules);
    if (options.onEvent) this.events.on(options.onEvent);
  }

  // ── Capability management ────────────────────────────────────────────────

  register(module: OsintModule): this {
    this.registry.register(module);
    return this;
  }

  unregister(moduleId: string): boolean {
    return this.registry.unregister(moduleId);
  }

  modules(): OsintModule[] {
    return this.registry.all();
  }

  capabilities(): ReturnType<ModuleRegistry['capabilityMatrix']> {
    return this.registry.capabilityMatrix();
  }

  profiles(): typeof INVESTIGATION_PROFILES {
    return INVESTIGATION_PROFILES;
  }

  subscribe(handler: EngineEventHandler): () => void {
    return this.events.on(handler);
  }

  getSettings(): Readonly<EngineSettings> {
    return { ...this.settings };
  }

  configure(settings: Partial<EngineSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  clearCache(): void {
    this.cache.clear();
  }

  cacheStats(): ReturnType<Cache['counters']> {
    return this.cache.counters();
  }

  /** Preview what the engine would do with an input, without any collection. */
  plan(input: string, profileId?: string): PlanPreview {
    const profile = resolveProfile(profileId ?? this.settings.profile);
    const seeds = parseSeeds(input);
    const effective = { ...this.settings, offline: profile.offlineByDefault === true || this.settings.offline };
    const planner = new Planner(this.registry, effective);
    const diagnostics = planner.diagnose(profile);

    const involvedModules = this.registry.all().filter((module) => module.accepts.some((type) => seeds.entities.some((seed) => seed.type === type)) || module.accepts.includes('image') || module.accepts.includes('person'));
    const allowed = involvedModules.filter((module) => profile.categories.includes(module.category));
    const runnable = allowed.filter((module) => !(effective.offline && module.requiresNetwork));

    return {
      profile: profile.id,
      seeds: seeds.entities,
      notes: seeds.notes,
      rejected: seeds.rejected,
      modules: runnable.map((module) => ({ id: module.id, name: module.name, category: module.category, network: Boolean(module.requiresNetwork) })),
      skipped: { offline: diagnostics.skippedOffline, profile: diagnostics.skippedProfile },
      estimatedRequests: runnable.filter((module) => module.requiresNetwork).length * 3,
    };
  }

  // ── Investigation ────────────────────────────────────────────────────────

  async investigate(options: InvestigateOptions): Promise<InvestigationReport> {
    const profile = resolveProfile(options.profile ?? this.settings.profile);
    const settings: EngineSettings = {
      ...this.settings,
      ...options.settings,
      profile: profile.id,
      maxDepth: options.settings?.maxDepth ?? profile.maxDepth,
      budgetMs: options.settings?.budgetMs ?? profile.budgetMs,
      offline: options.settings?.offline ?? (profile.offlineByDefault === true ? true : this.settings.offline),
    };

    const runId = newRunId('TOM');
    const startedAt = Date.now();
    const controller = new RunController(settings.budgetMs);
    const abortExternal = (): void => controller.cancel('внешний вызов abort()');
    options.signal?.addEventListener('abort', abortExternal, { once: true });

    const graph = new EntityGraph({ maxEntities: settings.maxEntities });
    const ledger = new EvidenceLedger();
    const risk = new RiskModel({ includeHeuristics: settings.includeHeuristics });
    const caveats: string[] = [];
    const moduleRecords: ModuleRunRecord[] = [];
    const counters: RunTrace['counters'] = {
      tasksPlanned: 0, tasksExecuted: 0, tasksSkipped: 0, requests: 0, requestFailures: 0,
      cacheHits: 0, entitiesDiscovered: 0, evidenceCollected: 0, pivotsExpanded: 0,
    };

    const emit = (event: EngineEvent): void => this.events.emit(event.type, event.payload as never);
    const http: HttpGateway = new HttpClient({
      cache: this.cache,
      transit: settings.transit,
      offline: settings.offline,
      timeoutMs: settings.requestTimeoutMs,
      userAgent: settings.userAgent,
      deadline: startedAt + settings.budgetMs,
      signal: controller.signal,
      fetchImpl: this.fetchImpl,
      maxRequests: 500,
      onRequest: () => {
        counters.requests += 1;
      },
    });

    const solver = new Semaphore(settings.concurrency);
    const query = options.input ?? options.entities?.map((entity) => entity.value).join('; ') ?? '';

    emit({ type: 'run.started', payload: { runId, query, profile: profile.id, plannedModules: this.registry.all().map((module) => module.id) }, timestamp: startedAt });
    emit({ type: 'run.phase', payload: { phase: 'parse' }, timestamp: Date.now() });

    try {
      // ── Phase 1: seeds ───────────────────────────────────────────────────
      const seedResult = options.entities
        ? { entities: options.entities, notes: ['Сущности переданы хост-приложением'], rejected: [] as PlanPreview['rejected'], unrecognized: [] as string[] }
        : parseSeeds(options.input ?? '');
      if (!seedResult.entities.length && options.input) {
        const harvested = extractObservables(options.input);
        seedResult.entities.push(...harvested.entities);
        seedResult.rejected.push(...harvested.rejected);
      }
      if (!seedResult.entities.length) {
        caveats.push('Входные данные не распознаны: движок не нашёл ни одного индикатора для исследования');
      }

      const seedEntities = seedResult.entities
        .map((draft) => graph.merge(draft, { moduleId: 'input', depth: 0, defaultConfidence: draft.confidence ?? 0.85, tags: ['seed'] }))
        .filter((entity): entity is NonNullable<typeof entity> => Boolean(entity));
      for (const note of seedResult.notes) caveats.push(note);
      emit({ type: 'input.parsed', payload: { entities: seedEntities }, timestamp: Date.now() });

      // ── Phase 2/3: frontier expansion ────────────────────────────────────
      emit({ type: 'run.phase', payload: { phase: 'collect' }, timestamp: Date.now() });
      const planner = new Planner(this.registry, settings);
      const visited = new Set<string>();
      const queue: Array<{ entityId: string; depth: number }> = seedEntities.map((entity) => ({ entityId: entity.id, depth: 0 }));
      // Entities already scheduled for expansion this run. Deduplication must be
      // against the *queue*, not the graph: a module typically creates the node
      // it wants investigated next (domain → IP node + "investigate this IP"
      // pivot), so filtering on `graph.has()` would silently disable expansion.
      const scheduled = new Set<string>(seedEntities.map((entity) => entity.id));

      for (let level = 0; level <= settings.maxDepth; level += 1) {
        if (controller.aborted) break;
        const current = queue.filter((entry) => entry.depth === level);
        if (!current.length) continue;

        const entities = current.map((entry) => graph.get(entry.entityId)).filter((entity): entity is NonNullable<typeof entity> => Boolean(entity));
        const tasksAll = planner.plan(entities, level, profile);
        const tasks = tasksAll.filter((task) => {
          const key = `${task.module.id}|${task.entity.id}`;
          if (visited.has(key)) return false;
          visited.add(key);
          return true;
        });
        counters.tasksPlanned += tasks.length;

        const levelPivots: Pivot[] = [];

        await Promise.all(
          tasks.map((task) =>
            solver.use(async () => {
              if (controller.aborted) {
                counters.tasksSkipped += 1;
                moduleRecords.push({ moduleId: task.module.id, entityId: task.entity.id, status: 'skipped', startedAt: Date.now(), durationMs: 0, evidenceCount: 0, entityCount: 0, error: 'бюджет исчерпан' });
                return;
              }
              const stopwatch = Stopwatch.start();
              emit({ type: 'module.started', payload: { moduleId: task.module.id, entityId: task.entity.id, category: task.module.category }, timestamp: Date.now() });

              try {
                const result = await this.runModule(task.module, task.entity, { runId, graph, http, settings, deadline: startedAt + settings.budgetMs, signal: controller.signal, artifacts: options.artifacts });
                counters.tasksExecuted += 1;
                stampTransports(result, http);

                const discovered = this.applyResult(result, { graph, ledger, risk, moduleId: task.module.id, depth: level + 1 });
                counters.entitiesDiscovered += discovered.entities;
                counters.evidenceCollected += discovered.evidence;
                for (const note of result.notes ?? []) caveats.push(`${task.module.id}: ${note}`);
                for (const pivot of result.pivots ?? []) levelPivots.push(pivot);

                moduleRecords.push({
                  moduleId: task.module.id,
                  entityId: task.entity.id,
                  status: discovered.entities + discovered.evidence > 0 ? 'ok' : 'empty',
                  startedAt: Date.now() - stopwatch.elapsed(),
                  durationMs: Math.round(stopwatch.elapsed()),
                  evidenceCount: discovered.evidence,
                  entityCount: discovered.entities,
                  error: result.error,
                  via: discovered.via,
                });
                emit({ type: 'module.completed', payload: { record: moduleRecords[moduleRecords.length - 1] as ModuleRunRecord }, timestamp: Date.now() });
              } catch (error) {
                const aborted = controller.aborted;
                const status: ModuleRunRecord['status'] = aborted ? 'timeout' : errorMessage(error).includes('offline') ? 'offline' : 'error';
                counters.tasksExecuted += 1;
                counters.requestFailures += error instanceof OsintError && error.code === 'NETWORK_UNAVAILABLE' ? 1 : 0;
                moduleRecords.push({
                  moduleId: task.module.id,
                  entityId: task.entity.id,
                  status,
                  startedAt: Date.now() - stopwatch.elapsed(),
                  durationMs: Math.round(stopwatch.elapsed()),
                  evidenceCount: 0,
                  entityCount: 0,
                  error: errorMessage(error).slice(0, 300),
                });
                if (!aborted) emit({ type: 'warning', payload: { message: `${task.module.id}: ${errorMessage(error)}`, moduleId: task.module.id }, timestamp: Date.now() });
              }
            }),
          ),
        );

        // ── Pivot selection for the next level ────────────────────────────
        if (level < settings.maxDepth && levelPivots.length && !controller.aborted) {
          const candidates = levelPivots
            .map((pivot) => ({
              ...pivot,
              confidence: pivot.confidence ?? 0.6,
            }))
            .filter((pivot) => {
              if (!pivot.value.trim()) return false;
              return !scheduled.has(entityIdOf(pivot.type, resolveCanonical(pivot.type, pivot.value)));
            });
          const selected = planner.selectPivots(candidates, profile);
          counters.pivotsExpanded += selected.length;

          for (const pivot of selected) {
            scheduled.add(entityIdOf(pivot.type, resolveCanonical(pivot.type, pivot.value)));
            const merged = graph.merge(
              { type: pivot.type, value: pivot.value, label: pivot.label, tags: ['pivot'], confidence: pivot.confidence },
              { moduleId: 'pivot', depth: level + 1, defaultConfidence: pivot.confidence ?? 0.6 },
            );
            if (!merged) break;
            queue.push({ entityId: merged.id, depth: level + 1 });
            if (pivot.from) {
              graph.link({ from: pivot.from, to: merged.id, relation: pivot.relation ?? 'derived_from', weight: 0.6, confidence: pivot.confidence ?? 0.6 }, { moduleId: 'pivot' });
            }
            emit({ type: 'pivot.queued', payload: { entityType: pivot.type, value: pivot.value, viaModule: 'planner', depth: level + 1 }, timestamp: Date.now() });
          }
        }

        emit({ type: 'run.phase', payload: { phase: level === settings.maxDepth ? 'fuse' : 'expand', detail: `Уровень ${level} завершён` }, timestamp: Date.now() });
      }

      if (controller.aborted && controller.budgetExhausted) {
        caveats.push(`Бюджет времени ${(settings.budgetMs / 1000).toFixed(0)} с исчерпан — сбор остановлен, результаты частичные`);
      }
      if (graph.truncated) caveats.push(`Достигнут лимит ${settings.maxEntities} сущностей — граф усечён, часть связей не собрана`);
      if (settings.offline) caveats.push('Офлайн-режим: сетевые модули не выполнялись, отчёт построен на локальных алгоритмах');

      // Graceful cancellation window for in-flight work.
      await sleep(0);

      // ── Phase 4: fusion ─────────────────────────────────────────────────
      emit({ type: 'run.phase', payload: { phase: 'fuse' }, timestamp: Date.now() });
      const fusion = ledger.fuse();

      // ── Phase 5: analytics ──────────────────────────────────────────────
      emit({ type: 'run.phase', payload: { phase: 'analyse' }, timestamp: Date.now() });
      const entities = graph.entityList();
      const edges = graph.edgeList();
      const graphMetrics = computeGraphMetrics(graph, { maxPredictedLinks: 12 });
      const entityById = new Map(entities.map((entity) => [entity.id, entity]));
      const timeline = buildTimeline(ledger.all(), entityById);
      const bursts = detectBursts(timeline);
      const clusters = clusterIdentities(entities, edges);

      risk.addFromEvidence(ledger.all());
      const riskAssessment = risk.assess({
        evidenceCoverage: Math.min(1, ledger.size() / 25),
        averageConfidence: fusion.averageConfidence,
        includeHeuristics: settings.includeHeuristics,
      });
      emit({ type: 'risk.updated', payload: { risk: riskAssessment }, timestamp: Date.now() });

      const findings = generateFindings({
        claims: fusion.claims,
        evidence: ledger.all(),
        entities,
        riskFactors: riskAssessment.factors,
        graph: graphMetrics,
        bursts,
        clusters,
        offline: settings.offline,
      });

      // ── Phase 6: report + integrity seal ────────────────────────────────
      emit({ type: 'run.phase', payload: { phase: 'report' }, timestamp: Date.now() });
      const finishedAt = Date.now();
      const httpMetrics = (http as HttpClient).counters();
      const trace: RunTrace = {
        runId,
        startedAt,
        finishedAt,
        durationMs: finishedAt - startedAt,
        modules: moduleRecords,
        counters: { ...counters, requests: httpMetrics.requests, requestFailures: httpMetrics.failures, cacheHits: httpMetrics.cacheHits },
        budgetExhausted: controller.budgetExhausted,
        truncated: graph.truncated,
        caveats: dedupe(caveats).slice(0, 40),
      };

      const coverage = buildCoverage(moduleRecords, ledger.all(), graph.truncated || controller.budgetExhausted || settings.offline);
      const evidenceDigest = await sha256AsyncSafe(stableStringify(ledger.all().map((record) => [record.id, record.key, record.value, record.confidence, record.source.name]).sort()));
      const headline = seedHeadline(seedResult.entities, query);

      const reportBase: Omit<InvestigationReport, 'integrity'> = {
        id: runId,
        version: ENGINE_VERSION,
        generatedAt: finishedAt,
        query,
        profile: profile.id,
        settingsDigest: {
          offline: settings.offline,
          maxDepth: settings.maxDepth,
          budgetMs: settings.budgetMs,
          concurrency: settings.concurrency,
          transit: settings.transit,
        },
        entities,
        edges,
        evidence: ledger.all(),
        findings,
        risk: riskAssessment,
        timeline,
        graph: graphMetrics,
        trace,
        coverage,
        narrative: {
          headline,
          summary: buildSummary({ headline, profile, risk: riskAssessment, findings, entities, edges, evidence: ledger.all(), graph: graphMetrics, trace }),
          keyPoints: findings.slice(0, 6).map((finding) => `${finding.title} (уверенность ${(finding.confidence * 100).toFixed(0)}%)`),
          caveats: trace.caveats,
        },
      };

      const reportDigest = await sha256AsyncSafe(stableStringify(reportBase));
      const report: InvestigationReport = {
        ...reportBase,
        integrity: {
          algorithm: 'SHA-256',
          evidenceDigest,
          reportDigest,
          generatedBy: 'TOMAHAWK OSINT Engine',
          engineVersion: ENGINE_VERSION,
        },
      };

      if (options.persist && this.store) await this.store.save(toStoredInvestigation(report));

      emit({ type: 'run.completed', payload: { runId, durationMs: trace.durationMs, entities: entities.length, evidence: ledger.size(), risk: riskAssessment.score }, timestamp: finishedAt });
      return report;
    } catch (error) {
      emit({ type: 'run.failed', payload: { runId, error: errorMessage(error) }, timestamp: Date.now() });
      throw error;
    } finally {
      controller.dispose();
      options.signal?.removeEventListener('abort', abortExternal);
    }
  }

  /** Execute a single module with caching, deadline and telemetry. */
  private async runModule(
    module: OsintModule,
    entity: Entity,
    context: {
      runId: string;
      graph: EntityGraph;
      http: HttpGateway;
      settings: EngineSettings;
      deadline: number;
      signal: AbortSignal;
      artifacts?: Record<string, unknown>;
    },
  ): Promise<ModuleResult> {
    const related = context.graph.contextFor(entity.id);
    const cacheKey = `module:${module.id}:${entity.type}:${entity.value}`;
    const ttl = module.cacheTtlMs ?? context.settings.cacheTtlMs;

    const execute = async (): Promise<ModuleResult> =>
      module.run(
        { entity, related, query: context.graph.get(entity.id)?.label ?? entity.value, artifacts: context.artifacts },
        {
          runId: context.runId,
          signal: context.signal,
          http: context.http,
          deadline: context.deadline,
          settings: context.settings,
          log: () => undefined,
          cached: <T>(key: string, ttlMs: number, producer: () => Promise<T>) => this.cache.remember(`mod:${module.id}:${key}`, ttlMs, producer),
        },
      );

    if (module.requiresNetwork && ttl > 0) {
      const cached = this.cache.get<ModuleResult>(cacheKey);
      if (cached) return cached;
      const result = await execute();
      this.cache.set(cacheKey, result, ttl);
      return result;
    }
    return execute();
  }

  /** Merge a module result into the graph, ledger and risk model. */
  private applyResult(
    result: ModuleResult,
    target: { graph: EntityGraph; ledger: EvidenceLedger; risk: RiskModel; moduleId: string; depth: number },
  ): { entities: number; evidence: number; via?: string } {
    const { graph, ledger, risk, moduleId, depth } = target;
    const sourceEntity = result.entities?.[0] ?? undefined;
    let entityCount = 0;
    let evidenceCount = 0;
    let via: string | undefined;

    const idByDraft = new Map<EntityDraft, string>();
    for (const draft of result.entities ?? []) {
      const merged = graph.merge(draft, { moduleId, depth, defaultConfidence: draft.confidence ?? 0.7 });
      if (!merged) continue;
      idByDraft.set(draft, merged.id);
      entityCount += 1;
      this.events.emit('entity.discovered', { entity: merged, viaModule: moduleId });
    }

    for (const draft of result.evidence ?? []) {
      const entityId = draft.entityId ?? (sourceEntity ? `${sourceEntity.type}:${sourceEntity.value}` : undefined);
      const evidence = ledger.add(draft, { moduleId, entityId });
      evidenceCount += 1;
      if (draft.source.via) via = draft.source.via;
      this.events.emit('evidence.added', { evidence });
    }

    for (const edgeDraft of result.edges ?? []) {
      graph.link(edgeDraft, { moduleId });
    }

    for (const factor of result.riskFactors ?? []) {
      risk.add(factor, { moduleId });
    }

    return { entities: entityCount, evidence: evidenceCount, via };
  }

  /** Serialise a report to an interoperable format. */
  export(report: InvestigationReport, format: ExportFormat, section?: 'entities' | 'edges' | 'evidence' | 'findings' | 'timeline'): string {
    return exportReport(report, format, section);
  }

  /** Convenience: run and return the stored record. */
  async investigateToStore(options: InvestigateOptions): Promise<StoredInvestigation> {
    const report = await this.investigate({ ...options, persist: true });
    return toStoredInvestigation(report);
  }

  async history(): Promise<Array<Omit<StoredInvestigation, 'report'>>> {
    return this.store ? this.store.list() : [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function dedupe(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

/**
 * Attach the delivery path to every observation whose source URL went through
 * the HTTP gateway. This is what makes `evidence.source.via` trustworthy: a
 * relayed payload can never masquerade as a direct API response.
 */
function stampTransports(result: ModuleResult, http: HttpGateway): void {
  if (typeof http.viaOf !== 'function') return;
  for (const draft of result.evidence ?? []) {
    if (draft.source.via || !draft.source.url) continue;
    const via = http.viaOf(draft.source.url);
    if (via) draft.source.via = via;
  }
}

function buildCoverage(records: ModuleRunRecord[], evidence: Evidence[], degraded: boolean): CoverageReport {
  const byModule: CoverageReport['byModule'] = {};
  for (const record of records) {
    const entry = (byModule[record.moduleId] ??= { ran: 0, ok: 0, failed: 0, skipped: 0 });
    entry.ran += 1;
    if (record.status === 'ok') entry.ok += 1;
    else if (record.status === 'error' || record.status === 'timeout' || record.status === 'offline') entry.failed += 1;
    else if (record.status === 'skipped') entry.skipped += 1;
  }
  const sourceKinds: Record<string, number> = {};
  for (const record of evidence) sourceKinds[record.source.kind] = (sourceKinds[record.source.kind] ?? 0) + 1;

  const executed = new Set(records.filter((record) => record.status !== 'skipped').map((record) => record.moduleId)).size;
  return {
    byModule,
    capabilitiesExercised: Number((degraded ? executed / Math.max(1, executed + 1) : executed / Math.max(1, Object.keys(byModule).length)).toFixed(3)),
    sourceKinds,
  };
}

function buildSummary(input: {
  headline: string;
  profile: { label: string; id: string };
  risk: InvestigationReport['risk'];
  findings: Finding[];
  entities: Array<{ type: string }>;
  edges: unknown[];
  evidence: Evidence[];
  graph: InvestigationReport['graph'];
  trace: RunTrace;
}): string {
  const typeBreakdown = new Map<string, number>();
  for (const entity of input.entities) typeBreakdown.set(entity.type, (typeBreakdown.get(entity.type) ?? 0) + 1);
  const topTypes = [...typeBreakdown.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => `${type}×${count}`)
    .join(', ');

  const critical = input.findings.filter((finding) => finding.severity === 'critical' || finding.severity === 'high').length;
  const independentSources = new Set(input.evidence.map((record) => record.source.name)).size;
  const predictions = input.graph.predictions.length;

  return [
    `Профиль «${input.profile.label}»: собрано ${input.entities.length} сущностей (${topTypes || '—'}) и ${input.edges.length} связей на основе ${input.evidence.length} наблюдений из ${independentSources} источников за ${(input.trace.durationMs / 1000).toFixed(1)} с.`,
    `Итоговый уровень риска — ${input.risk.level} (${input.risk.score}/100) при уверенности ${(input.risk.confidence * 100).toFixed(0)}%. Критичных и высоких находок: ${critical}.`,
    predictions ? `Аналитика графа предложила ${predictions} непроверенных скрытых связей — это гипотезы для следующего шага расследования, а не установленные факты.` : 'Скрытых связей для проверки не выявлено.',
    input.trace.budgetExhausted ? 'Внимание: сбор завершился по исчерпанию бюджета времени, охват источников неполный.' : 'Бюджет времени не исчерпан: охват источников соответствует выбранному профилю.',
  ].join(' ');
}

/**
 * Factory — the single entry point consumers import.
 *
 * ```ts
 * import { createOsintEngine } from 'tomahawk-osint';
 * const engine = createOsintEngine({ settings: { offline: false } });
 * const report = await engine.investigate({ input: '+7 916 402-91-88', profile: 'person-fast' });
 * ```
 */
export function createOsintEngine(options: EngineOptions = {}): OsintEngine {
  return new OsintEngine(options);
}

export type { InvestigationStore, StoredInvestigation };
export type { HttpGateway, HttpRequestOptions, HttpProbeResult };
