/**
 * TOMAHAWK OSINT ENGINE — planner & module registry
 * ---------------------------------------------------------------------------
 * The planner turns "what we know" into "what to do next". Because modules
 * declare `accepts` / `produces`, the engine can expand its own investigation
 * frontier: a phone number produces a person candidate, which produces social
 * profiles, which produce an avatar image, which produces a geolocation — all
 * without hard-coded chains. Depth, fan-out, cost and offline policy are
 * enforced centrally, so a run can never spiral out of control.
 */

import type { EngineSettings, OsintModule } from '../types/module';
import type { Entity, EntityType, Pivot } from '../types/entity';
import type { ProfileDefinition } from '../presets/profiles';

export interface PlannedTask {
  module: OsintModule;
  entity: Entity;
  depth: number;
  /** Deterministic ordering key so runs are reproducible. */
  order: number;
  reason: string;
}

export class ModuleRegistry {
  private readonly modules = new Map<string, OsintModule>();

  register(module: OsintModule): this {
    if (!module.id) throw new Error('Модуль должен иметь уникальный id');
    if (this.modules.has(module.id)) throw new Error(`Модуль «${module.id}» уже зарегистрирован`);
    this.modules.set(module.id, module);
    return this;
  }

  registerMany(modules: readonly OsintModule[]): this {
    for (const module of modules) this.register(module);
    return this;
  }

  unregister(id: string): boolean {
    return this.modules.delete(id);
  }

  get(id: string): OsintModule | undefined {
    return this.modules.get(id);
  }

  all(): OsintModule[] {
    return [...this.modules.values()].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.id.localeCompare(b.id));
  }

  byCategory(category: string): OsintModule[] {
    return this.all().filter((module) => module.category === category);
  }

  /** Capability matrix for documentation and UI display. */
  capabilityMatrix(): Array<{ id: string; name: string; category: string; accepts: EntityType[]; produces: EntityType[]; network: boolean }> {
    return this.all().map((module) => ({
      id: module.id,
      name: module.name,
      category: module.category,
      accepts: module.accepts,
      produces: module.produces,
      network: Boolean(module.requiresNetwork),
    }));
  }

  /** Modules able to consume a given entity type under the active profile. */
  forEntity(entity: Entity, settings: EngineSettings, profile: ProfileDefinition): OsintModule[] {
    return this.all().filter((module) => {
      if (!module.accepts.includes(entity.type)) return false;
      if (!profile.categories.includes(module.category)) return false;
      if (settings.offline && module.requiresNetwork) return false;
      return true;
    });
  }
}

export interface PlannerDiagnostics {
  plannedModules: string[];
  skippedOffline: string[];
  skippedProfile: string[];
}

export class Planner {
  private readonly registry: ModuleRegistry;
  private readonly settings: EngineSettings;

  constructor(registry: ModuleRegistry, settings: EngineSettings) {
    this.registry = registry;
    this.settings = settings;
  }

  /** Explain *why* a module will or will not run — surfaced as run caveats. */
  diagnose(profile: ProfileDefinition): PlannerDiagnostics {
    const diagnostics: PlannerDiagnostics = { plannedModules: [], skippedOffline: [], skippedProfile: [] };
    for (const module of this.registry.all()) {
      if (!profile.categories.includes(module.category)) diagnostics.skippedProfile.push(module.id);
      else if (this.settings.offline && module.requiresNetwork) diagnostics.skippedOffline.push(module.id);
      else diagnostics.plannedModules.push(module.id);
    }
    return diagnostics;
  }

  /**
   * Build the task list for one frontier level, ordered by module priority and
   * cost so the highest-value collection happens before the budget runs out.
   */
  plan(entities: Entity[], depth: number, profile: ProfileDefinition): PlannedTask[] {
    const tasks: PlannedTask[] = [];
    let order = 0;

    for (const entity of entities) {
      const candidates = this.registry
        .forEntity(entity, this.settings, profile)
        .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || (a.cost ?? 1) - (b.cost ?? 1) || a.id.localeCompare(b.id));

      for (const module of candidates) {
        tasks.push({
          module,
          entity,
          depth,
          order: order++,
          reason: `${module.name} ⇐ ${entity.type}`,
        });
      }
    }

    return tasks;
  }

  /**
   * Choose which discovered pivots to expand. Ranking favours high-confidence,
   * type-diverse pivots (a domain adds more than the fifth phone number) and
   * caps fan-out per level to prevent combinatorial explosion.
   */
  selectPivots(candidates: readonly Pivot[], profile: ProfileDefinition): Pivot[] {
    const limit = Math.min(this.settings.maxPivotsPerLevel ?? 24, profile.maxPivotsPerLevel ?? 24);
    const perType = new Map<EntityType, number>();
    const typeQuota = Math.max(3, Math.ceil(limit / 4));

    const sorted = [...candidates].sort((a, b) => b.confidence - a.confidence);
    const selected: Pivot[] = [];
    for (const candidate of sorted) {
      if (selected.length >= limit) break;
      const used = perType.get(candidate.type) ?? 0;
      if (used >= typeQuota) continue;
      perType.set(candidate.type, used + 1);
      selected.push(candidate);
    }
    // If quotas left the level under-filled, backfill by confidence.
    for (const candidate of sorted) {
      if (selected.length >= limit) break;
      if (!selected.includes(candidate)) selected.push(candidate);
    }
    return selected;
  }
}
