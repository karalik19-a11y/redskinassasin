/**
 * TOMAHAWK OSINT ENGINE — finding synthesis
 * ---------------------------------------------------------------------------
 * Raw evidence is not a report. This layer promotes observations into ranked,
 * human-readable findings by combining:
 *   claim posterior × source independence × graph salience (how central the
 *   entity is) × analyst-defined severity of the claim class.
 * Contradictions, predicted hidden links, identity clusters and activity bursts
 * are promoted too, so the analyst sees *what the engine noticed*, not a wall
 * of raw records.
 */

import type { Entity, EntityId } from '../types/entity';
import type { Evidence } from '../types/evidence';
import type { Finding, GraphMetrics, RiskFactor } from '../types/report';
import { RISK_FACTOR_LIBRARY } from './risk';
import { fnv1a64 } from './ids';
import type { Burst } from './analytics';
import type { FusedClaim } from './fusion';

export interface FindingContext {
  claims: FusedClaim[];
  evidence: Evidence[];
  entities: Entity[];
  riskFactors: RiskFactor[];
  graph: GraphMetrics;
  bursts: Burst[];
  clusters: Array<{ key: string; reason: string; entityIds: EntityId[] }>;
  offline: boolean;
}

/** Severity of a claim class, derived from the risk taxonomy + key patterns. */
const CLAIM_SEVERITY: Array<{ pattern: RegExp; severity: Finding['severity']; base: number; recommendation?: string }> = [
  { pattern: /plaintext|cleartext|password$/i, severity: 'critical', base: 1, recommendation: 'Немедленная смена пароля и всех повторов; проверить журналы доступа' },
  { pattern: /sanction|watchlist|pep/i, severity: 'high', base: 0.9, recommendation: 'Провести ручную верификацию совпадения и при подтверждении — комплаенс-процедуры' },
  { pattern: /darknet|mixer|ransom/i, severity: 'critical', base: 0.95, recommendation: 'Зафиксировать транзакционный путь и подготовить отчёт для комплаенса' },
  { pattern: /breach|leak|exposed/i, severity: 'high', base: 0.8, recommendation: 'Оценить объём утёкших данных и срок давности, включить мониторинг' },
  { pattern: /checksum|invalid|failed|error/i, severity: 'medium', base: 0.6, recommendation: 'Перепроверить источник: данные могут быть сфабрикованы или испорчены' },
  { pattern: /dmarc|spf|dkim|mail/i, severity: 'medium', base: 0.55, recommendation: 'Настроить почтовую защиту домена (SPF/DKIM/DMARC/MTA-STS)' },
  { pattern: /certificate|tls|ssl/i, severity: 'medium', base: 0.5 },
  { pattern: /dga|typosquat|homoglyph|suspicious/i, severity: 'high', base: 0.75, recommendation: 'Проверить домен на мошенническую инфраструктуру и подать на блокировку' },
  { pattern: /geolocation|gps|coordinates|address/i, severity: 'medium', base: 0.6, recommendation: 'Сопоставить геоданные с другими источниками до использования в выводах' },
  { pattern: /operator|carrier|region/i, severity: 'info', base: 0.3 },
  { pattern: /dns|mx|ns|txt/i, severity: 'low', base: 0.35 },
  { pattern: /balance|transaction|volume/i, severity: 'high', base: 0.7 },
];

function severityFor(key: string, confidence: number): { severity: Finding['severity']; base: number; recommendation?: string } {
  for (const entry of CLAIM_SEVERITY) {
    if (entry.pattern.test(key)) {
      const downgraded = confidence < 0.5 && (entry.severity === 'critical' || entry.severity === 'high');
      return { severity: downgraded ? (entry.severity === 'critical' ? 'high' : 'medium') : entry.severity, base: entry.base, recommendation: entry.recommendation };
    }
  }
  return { severity: confidence > 0.8 ? 'medium' : 'low', base: 0.4 };
}

function entityLabel(entities: Map<EntityId, Entity>, id?: EntityId): string {
  if (!id) return 'объект исследования';
  return entities.get(id)?.label ?? id;
}

export function generateFindings(context: FindingContext): Finding[] {
  const entityById = new Map(context.entities.map((entity) => [entity.id, entity]));
  const evidenceById = new Map(context.evidence.map((record) => [record.id, record]));
  const findings: Finding[] = [];

  const centralityOf = (id?: EntityId): number => (id ? (context.graph.centrality[id]?.score ?? 0) : 0);

  // ── 1. Evidence-backed claims ────────────────────────────────────────────
  for (const claim of context.claims) {
    const { severity, base, recommendation } = severityFor(claim.key, claim.posterior);
    if (claim.posterior < 0.35 && severity === 'info') continue;

    const sample = claim.evidenceIds.map((id) => evidenceById.get(id)).find(Boolean);
    const salience = centralityOf(claim.entityId);
    const score = Math.round((base * 0.45 + claim.posterior * 0.35 + salience * 0.1 + Math.min(1, claim.corroboration / 3) * 0.1) * 100);

    findings.push({
      id: `FND-${fnv1a64(`${claim.key}|${claim.entityId ?? ''}`).slice(0, 10)}`,
      title: `${entityLabel(entityById, claim.entityId)}: ${humaniseKey(claim.key)}`,
      detail: buildClaimDetail(claim, sample, entityById),
      score,
      severity,
      confidence: Number(claim.posterior.toFixed(3)),
      moduleId: sample?.moduleId ?? 'fusion',
      category: (sample?.key.split('.')[0] as Finding['category']) ?? 'fusion',
      entityIds: claim.entityId ? [claim.entityId] : [],
      evidenceIds: claim.evidenceIds,
      tags: sample?.tags ?? [],
      recommendation: claim.disputed
        ? 'Источники противоречат друг другу — требуется ручная верификация перед выводами'
        : recommendation,
    });
  }

  // ── 2. Contradictions between sources ────────────────────────────────────
  for (const claim of context.claims.filter((candidate) => candidate.disputed)) {
    const alternatives = claim.alternatives.map((alternative) => String(alternative.value).slice(0, 60)).join(' | ');
    findings.push({
      id: `FND-CONFLICT-${fnv1a64(claim.key).slice(0, 8)}`,
      title: `Противоречие источников: ${humaniseKey(claim.key)}`,
      detail: `По показателю «${humaniseKey(claim.key)}» получены конкурирующие значения: «${String(claim.value).slice(0, 60)}» против «${alternatives}». Энтропия неопределённости ${(claim.uncertainty * 100).toFixed(0)}%, источники: ${claim.sourceNames.join(', ') || '—'}.`,
      score: Math.round(60 + claim.uncertainty * 30),
      severity: 'medium',
      confidence: Number((1 - claim.uncertainty).toFixed(3)),
      moduleId: 'fusion',
      category: 'fusion',
      entityIds: claim.entityId ? [claim.entityId] : [],
      evidenceIds: claim.evidenceIds,
      tags: ['dispute', 'verification-required'],
      recommendation: 'Сопоставить первоисточники и зафиксировать расхождение в материалах дела',
    });
  }

  // ── 3. Risk drivers (explainable, mapped to the taxonomy) ───────────────
  for (const factor of context.riskFactors.filter((candidate) => candidate.contribution >= 0.03)) {
    const definition = RISK_FACTOR_LIBRARY[factor.id];
    findings.push({
      id: `FND-RISK-${fnv1a64(factor.id).slice(0, 8)}`,
      title: factor.label,
      detail: `${factor.explain} Вклад фактора в итоговую оценку: ${(factor.contribution * 100).toFixed(2)} п.п. (категория ${factor.category}, вес ${factor.weight}, серьёзность ${(factor.severity * 100).toFixed(0)}%).`,
      score: Math.round(Math.min(100, factor.contribution * 180 + factor.severity * 30)),
      severity: factor.severity > 0.75 ? 'critical' : factor.severity > 0.5 ? 'high' : factor.severity > 0.3 ? 'medium' : 'low',
      confidence: Number(Math.min(1, factor.severity).toFixed(3)),
      moduleId: factor.moduleId,
      category: factor.category,
      entityIds: [],
      evidenceIds: factor.evidenceIds,
      tags: ['risk', factor.category],
      recommendation: definition?.recommendation,
    });
  }

  // ── 4. Predicted hidden links (candidate next steps) ────────────────────
  for (const prediction of context.graph.predictions.slice(0, 6)) {
    if (prediction.score < 0.45) continue;
    findings.push({
      id: `FND-LINK-${fnv1a64(`${prediction.from}|${prediction.to}`).slice(0, 8)}`,
      title: `Предполагаемая скрытая связь: ${entityLabel(entityById, prediction.from)} ↔ ${entityLabel(entityById, prediction.to)}`,
      detail: `${prediction.reason}. Оценка силы связи (Adamic–Adar): ${(prediction.score * 100).toFixed(0)}%. Связь не подтверждена источником — это гипотеза для проверки.`,
      score: Math.round(35 + prediction.score * 35),
      severity: 'low',
      confidence: Number((0.35 + prediction.score * 0.35).toFixed(3)),
      moduleId: 'analytics',
      category: 'fusion',
      entityIds: [prediction.from, prediction.to],
      evidenceIds: [],
      tags: ['hypothesis', 'link-prediction'],
      recommendation: 'Проверить гипотезу прямым запросом к реестру/аккаунту либо сопоставлением метаданных',
    });
  }

  // ── 5. Identity clusters (same person, many accounts) ───────────────────
  for (const cluster of context.clusters) {
    if (cluster.entityIds.length < 2) continue;
    findings.push({
      id: `FND-CLUSTER-${fnv1a64(cluster.key).slice(0, 8)}`,
      title: `Единая личность на нескольких платформах (${cluster.entityIds.length})`,
      detail: `${cluster.reason}. Объекты: ${cluster.entityIds.map((id) => entityLabel(entityById, id)).join(', ')}.`,
      score: Math.round(45 + Math.min(cluster.entityIds.length, 6) * 8),
      severity: 'medium',
      confidence: 0.7,
      moduleId: 'analytics',
      category: 'opsec',
      entityIds: cluster.entityIds,
      evidenceIds: [],
      tags: ['identity-cluster', 'opsec'],
      recommendation: 'Провести обратный поиск аватара и проверить переиспользование паролей между платформами',
    });
  }

  // ── 6. Activity bursts ──────────────────────────────────────────────────
  for (const burst of context.bursts) {
    findings.push({
      id: `FND-BURST-${burst.day}`,
      title: `Всплеск активности: ${burst.day} (${burst.count} событий)`,
      detail: `Наблюдений в этот день: ${burst.count} при среднем ${burst.expected}. Статистическая неожиданность ${burst.surprise} (шкала -log10 p). Примеры: ${burst.sampleLabels.join('; ')}.`,
      score: Math.round(30 + Math.min(burst.surprise, 6) * 8),
      severity: burst.surprise > 3 ? 'high' : 'medium',
      confidence: 0.6,
      moduleId: 'analytics',
      category: 'temporal',
      entityIds: burst.entityIds,
      evidenceIds: [],
      tags: ['timeline', 'burst'],
      recommendation: 'Сопоставить дату всплеска с внешними событиями (регистрации, публикации, транзакции)',
    });
  }

  // ── 7. Centrality / structural insight ──────────────────────────────────
  const hubs = context.graph.hubs.slice(0, 2);
  for (const hub of hubs) {
    const entity = entityById.get(hub);
    if (!entity) continue;
    const metrics = context.graph.centrality[hub];
    if (!metrics || metrics.score < 0.3) continue;
    findings.push({
      id: `FND-HUB-${fnv1a64(hub).slice(0, 8)}`,
      title: `Ключевой узел: ${entity.label}`,
      detail: `Сущность «${entity.label}» (${entity.type}) имеет наивысшую структурную значимость в графе: степень ${(metrics.degree * 100).toFixed(0)}%, гармоническая центральность ${(metrics.harmonic * 100).toFixed(0)}%, собственный вектор ${(metrics.eigenvector * 100).toFixed(0)}%. Это наиболее вероятная точка дальнейшего сбора.`,
      score: Math.round(40 + metrics.score * 40),
      severity: 'info',
      confidence: 0.75,
      moduleId: 'analytics',
      category: 'fusion',
      entityIds: [hub],
      evidenceIds: entity.evidenceIds,
      tags: ['graph', 'pivot'],
      recommendation: 'Сосредоточить дальнейшую проверку на этом узле — он связывает наибольшее число контекстов',
    });
  }

  // ── 8. Coverage caveats become findings when collection was degraded ────
  if (context.offline) {
    findings.push({
      id: 'FND-OFFLINE',
      title: 'Сетевые источники не использовались (офлайн-режим)',
      detail: 'Отчёт построен исключительно на локальных алгоритмах и офлайн-наборах данных: контрольные суммы, парсинг идентификаторов, метаданные, геоанализ. Онлайн-источники (реестры, DNS, блокчейн-обозреватели) не опрашивались.',
      score: 20,
      severity: 'info',
      confidence: 1,
      moduleId: 'engine',
      category: 'fusion',
      entityIds: [],
      evidenceIds: [],
      tags: ['coverage', 'offline'],
      recommendation: 'Для полноты картины повторить запуск с включённым сетевым доступом',
    });
  }

  const severityRank: Partial<Record<Finding['severity'], number>> = { critical: 5, severe: 4.5, high: 4, elevated: 3.5, moderate: 3, medium: 3, low: 2, minimal: 1.5, info: 1 };
  const rank = (severity: Finding['severity']): number => severityRank[severity] ?? 0;
  return findings
    .sort((a, b) => rank(b.severity) - rank(a.severity) || b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, 120);
}

function humaniseKey(key: string): string {
  const [namespace, ...rest] = key.split('::').pop()!.split('.');
  const label = rest.join('.');
  const dictionary: Record<string, string> = {
    checksumValid: 'контрольная сумма',
    carrier: 'оператор связи',
    region: 'регион',
    mx: 'почтовые серверы (MX)',
    spf: 'SPF-политика',
    dmarc: 'DMARC-политика',
    'mail-security': 'почтовая безопасность',
    balance: 'баланс',
    txCount: 'число транзакций',
    profile: 'публичный профиль',
    exists: 'существование',
  };
  return dictionary[label] ?? label ?? namespace ?? key;
}

function buildClaimDetail(claim: FusedClaim, sample: Evidence | undefined, entityById: Map<EntityId, Entity>): string {
  const parts: string[] = [];
  parts.push(`Установлено значение: «${String(claim.value).slice(0, 160)}».`);
  if (claim.entityId) parts.push(`Объект: ${entityById.get(claim.entityId)?.label ?? claim.entityId}.`);
  parts.push(`Достоверность после фьюжна: ${(claim.posterior * 100).toFixed(1)}% (независимых источников: ${claim.corroboration}).`);
  if (sample) parts.push(`Первоисточник: ${sample.source.name}${sample.source.url ? ` (${sample.source.url})` : ''}${sample.source.via && sample.source.via !== 'direct' ? `, доставлено через ${sample.source.via}` : ''}.`);
  if (claim.corroboration === 1) parts.push('Подтверждено единственным источником — рекомендуется перекрёстная проверка.');
  return parts.join(' ');
}
