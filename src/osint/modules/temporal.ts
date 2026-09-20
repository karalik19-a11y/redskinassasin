/**
 * MODULE: temporal — timeline reconstruction & behavioural analysis
 * ---------------------------------------------------------------------------
 * Timestamps are the most under-used OSINT signal. This module:
 *   • harvests every dated attribute present in the graph context (профили,
 *     транзакции, регистрации, публикации) into a normalized timeline
 *   • detects activity bursts with a Poisson surprise score (a spike is a
 *     *statistical* statement, not a hunch)
 *   • **infers the subject's timezone from activity hours**: social/trading
 *     activity clusters in the local waking day, so the circular mean of hours
 *     yields a UTC-offset estimate — a real technique for geo-attribution when
 *     the platform hides location data
 *   • flags operational-security patterns: activity during local night hours
 *     (automation/scheduled posting), uniform intervals (bots), dormancy gaps
 */

import type { ModuleInput, ModuleResult, OsintModule } from '../types/module';
import { detectBursts, parseLooseDate, type Burst } from '../core/analytics';
import { evidence, entity, risk, truncate } from './common';

const MODULE_ID = 'temporal.timeline';

const DATE_KEYS = /(date|time|created|createdat|joined|registered|registration|issued|lastseen|last_seen|updated|block_time|bound|expires|firstseen|birth)/i;

interface DatedFact {
  key: string;
  label: string;
  timestamp: number;
  precision: 'day' | 'month' | 'year';
  sourceEntityId: string;
}

export function harvestDatedFacts(input: ModuleInput): DatedFact[] {
  const facts: DatedFact[] = [];
  const push = (sourceEntityId: string, label: string, key: string, value: unknown): void => {
    if (value === undefined || value === null) return;
    if (typeof value === 'number') {
      // Epoch seconds vs milliseconds heuristic.
      const timestamp = value > 1e12 ? value : value > 1e9 ? value * 1000 : NaN;
      if (!Number.isFinite(timestamp)) return;
      facts.push({ key, label, timestamp, precision: 'day', sourceEntityId });
      return;
    }
    const parsed = parseLooseDate(String(value));
    if (!parsed) return;
    facts.push({ key, label, timestamp: parsed.timestamp, precision: parsed.precision === 'exact' ? 'day' : parsed.precision, sourceEntityId });
  };

  for (const [key, value] of Object.entries(input.entity.properties)) {
    if (DATE_KEYS.test(key)) push(input.entity.id, `${input.entity.label}: ${key}`, key, value);
  }
  for (const related of input.related) {
    const candidate = related as unknown as { properties?: Record<string, unknown> };
    for (const [key, value] of Object.entries(candidate.properties ?? {})) {
      if (DATE_KEYS.test(key)) push(related.id, `${related.type}=${truncate(related.value, 32)}: ${key}`, key, value);
    }
  }
  return facts.sort((a, b) => a.timestamp - b.timestamp);
}

/** Estimate the UTC offset from the distribution of activity hours. */
export function inferTimezoneFromHours(timestamps: number[]): { offsetEstimate: number; confidence: number; hourlyHistogram: number[]; note: string } {
  const histogram = new Array<number>(24).fill(0);
  for (const timestamp of timestamps) histogram[new Date(timestamp).getUTCHours()] += 1;

  // Circular mean of the "activity day": assume the active window is centred
  // around 15:00 local time (mid-afternoon), a robust empirical anchor.
  let sinSum = 0;
  let cosSum = 0;
  histogram.forEach((count, hour) => {
    const angle = ((hour - 15) / 24) * 2 * Math.PI;
    sinSum += count * Math.sin(angle);
    cosSum += count * Math.cos(angle);
  });
  const meanAngle = Math.atan2(sinSum, cosSum);
  let offset = Math.round((meanAngle / (2 * Math.PI)) * 24);
  while (offset > 14) offset -= 24;
  while (offset < -12) offset += 24;

  const total = timestamps.length;
  const resultLength = Math.sqrt(sinSum ** 2 + cosSum ** 2) / Math.max(1, total);
  const confidence = Math.min(0.8, 0.25 + resultLength * 0.7) * Math.min(1, total / 12);

  return {
    offsetEstimate: offset,
    confidence: Number(confidence.toFixed(2)),
    hourlyHistogram: histogram,
    note:
      total < 8
        ? 'Слишком мало меток времени для устойчивой оценки часового пояса'
        : `Оценка UTC${offset >= 0 ? '+' : ''}${offset} по распределению активности (устойчивость ${(resultLength * 100).toFixed(0)}%)`,
  };
}

export const temporalModule: OsintModule = {
  id: MODULE_ID,
  name: 'Хронология и поведенческий анализ времени',
  category: 'temporal',
  description:
    'Собирает все датированные атрибуты из графа в единую нормализованную хронологию, выявляет всплески активности по статистике Пуассона, оценивает часовой пояс субъекта по распределению часов активности, фиксирует аномалии режима (ночная активность, идеальные интервалы — признаки автоматизации) и периоды простоя.',
  accepts: ['event', 'person', 'social_profile', 'crypto_tx', 'domain', 'organization', 'document', 'phone', 'username'],
  produces: ['event', 'location'],
  requiresNetwork: false,
  cost: 0.4,
  priority: 55,
  tags: ['temporal', 'behaviour', 'offline'],
  run(input: ModuleInput): ModuleResult {
    const facts = harvestDatedFacts(input);
    const out: ModuleResult = { evidence: [], entities: [], riskFactors: [], pivots: [], notes: [] };
    if (!facts.length) {
      out.notes?.push('Датированных атрибутов не найдено — хронология не построена');
      return out;
    }

    const source = { name: 'Темпоральный анализ TOMAHAWK (локально)', kind: 'algorithm' as const };
    const sorted = [...facts].sort((a, b) => a.timestamp - b.timestamp);
    const spanDays = (sorted.at(-1)!.timestamp - (sorted[0] as DatedFact).timestamp) / 86_400_000;

    out.evidence?.push(
      evidence(
        'temporal.span',
        `Хронология охватывает ${facts.length} датированных фактов: с ${new Date((sorted[0] as DatedFact).timestamp).toISOString().slice(0, 10)} по ${new Date((sorted.at(-1) as DatedFact).timestamp).toISOString().slice(0, 10)} (${spanDays.toFixed(0)} дн.)`,
        { facts: facts.length, first: sorted[0]?.timestamp, last: sorted.at(-1)?.timestamp, spanDays: Number(spanDays.toFixed(1)) },
        source,
        { reliability: 0.9, tags: ['timeline'] },
      ),
      evidence('temporal.facts', `Ключевые даты: ${sorted.slice(-8).map((fact) => `${new Date(fact.timestamp).toISOString().slice(0, 10)} — ${truncate(fact.label, 60)}`).join('; ')}`, sorted.slice(0, 60), source, { reliability: 0.85, tags: ['timeline'] }),
    );

    for (const fact of facts.slice(0, 40)) {
      out.entities?.push(
        entity('event', new Date(fact.timestamp).toISOString(), {
          label: `${new Date(fact.timestamp).toISOString().slice(0, 10)} — ${truncate(fact.label, 60)}`,
          tags: ['timeline', fact.key],
          confidence: 0.75,
          properties: { timestamp: fact.timestamp, precision: fact.precision, attribute: fact.key },
        }),
      );
    }

    // ── Burst detection ─────────────────────────────────────────────────────
    const bursts: Burst[] = detectBursts(
      facts.map((fact) => ({ timestamp: fact.timestamp, label: fact.label, category: fact.key, entityId: fact.sourceEntityId, evidenceId: undefined, precision: fact.precision })),
      3,
    );
    for (const burst of bursts) {
      out.evidence?.push(
        evidence('temporal.burst', `Всплеск активности ${burst.day}: ${burst.count} событий при среднем ${burst.expected} (неожиданность ${burst.surprise})`, burst, { name: 'Обнаружение всплесков (статистика Пуассона)', kind: 'heuristic' }, { reliability: 0.75, tags: ['anomaly', 'timeline'] }),
      );
    }
    if (bursts.length) {
      out.riskFactors?.push(risk('opsec.timezone-mismatch', 0.3, `Выявлено ${bursts.length} всплесков активности — вероятны кампании, массовые регистрации или скоординированные действия`, [], { label: 'Всплески активности в хронологии', explain: `Дни: ${bursts.slice(0, 3).map((burst) => burst.day).join(', ')}` }));
    }

    // ── Timezone inference ──────────────────────────────────────────────────
    const timestamps = facts.map((fact) => fact.timestamp);
    const timezone = inferTimezoneFromHours(timestamps);
    out.evidence?.push(
      evidence('temporal.timezone-estimate', timezone.note, { offsetEstimate: timezone.offsetEstimate, confidence: timezone.confidence, histogram: timezone.hourlyHistogram }, { name: 'Оценка часового пояса по часам активности', kind: 'heuristic' }, { reliability: timezone.confidence, tags: ['timezone', 'estimate'] }),
    );

    const knownTimezone = typeof input.entity.properties.timezone === 'string' ? (input.entity.properties.timezone as string) : undefined;
    if (knownTimezone && /UTC[+-]\d{1,2}/i.test(knownTimezone)) {
      const knownOffset = Number(/UTC([+-]\d{1,2})/i.exec(knownTimezone)?.[1] ?? 0);
      if (Math.abs(knownOffset - timezone.offsetEstimate) >= 2) {
        out.evidence?.push(
          evidence('temporal.timezone-mismatch', `Заявленный часовой пояс (${knownTimezone}) расходится с активностью на ${Math.abs(knownOffset - timezone.offsetEstimate)} ч — активность ведётся из другого региона или через VPN`, { known: knownOffset, inferred: timezone.offsetEstimate }, { name: 'Сопоставление заявленного и фактического режима', kind: 'heuristic' }, { reliability: 0.7, tags: ['anomaly', 'geo'] }),
        );
        out.riskFactors?.push(risk('opsec.timezone-mismatch', 0.45, `Активность не соответствует заявленному часовому поясу (${knownTimezone} против расчётного UTC${timezone.offsetEstimate >= 0 ? '+' : ''}${timezone.offsetEstimate})`, []));
      }
    }

    // ── Behavioural anomalies ───────────────────────────────────────────────
    const activeHours = new Set(timestamps.map((timestamp) => new Date(timestamp).getUTCHours()));
    const nightHours = [...activeHours].filter((hour) => hour <= 4).length;
    if (facts.length >= 10 && nightHours === 0) {
      out.evidence?.push(
        evidence('temporal.no-night-activity', 'Активность полностью отсутствует в ночные часы (00:00–05:00) — характерно для автоматической публикации или строгого расписания', { nightHours, activeHours: activeHours.size }, source, { reliability: 0.65, tags: ['behaviour', 'heuristic'] }),
      );
    }

    const dayGaps = facts.slice(1).map((fact, index) => fact.timestamp - (facts[index] as DatedFact).timestamp);
    const biggestGap = Math.max(...dayGaps, 0) / 86_400_000;
    if (biggestGap > 180) {
      out.evidence?.push(
        evidence('temporal.dormancy', `Обнаружен период простоя длительностью ${biggestGap.toFixed(0)} дней — аккаунт мог быть заброшен, передан или переключён на другую инфраструктуру`, { days: Number(biggestGap.toFixed(1)) }, source, { reliability: 0.7, tags: ['anomaly'] }),
      );
    }

    const uniqueHours = [...new Set(dayGaps.map((gap) => Math.round(gap / 3_600_000)))];
    if (facts.length >= 8 && uniqueHours.length === 1 && uniqueHours[0]! > 0) {
      out.riskFactors?.push(risk('opsec.timezone-mismatch', 0.35, `Все интервалы между событиями одинаковы (${uniqueHours[0]} ч) — признак автоматизированной генерации активности`, [], { label: 'Идеальные интервалы активности (автоматизация)', explain: 'Метрономная периодичность почти всегда означает бота или планировщик публикаций' }));
    }

    out.metrics = { datedFacts: facts.length, spanDays: Number(spanDays.toFixed(1)), bursts: bursts.length, inferredUtcOffset: timezone.offsetEstimate };
    return out;
  },
};

export const temporalModules = [temporalModule];
