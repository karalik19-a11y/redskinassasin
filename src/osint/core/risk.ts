/**
 * TOMAHAWK OSINT ENGINE — explainable risk model
 * ---------------------------------------------------------------------------
 * Risk is computed as a **noisy-OR** over weighted, evidence-backed factors:
 *
 *   exposure = 1 − Π (1 − wᵢ · sᵢ)
 *
 * Rationale: independent exposures accumulate sub-additively and saturate —
 * the 9th leaked password adds far less marginal risk than the 1st — which
 * matches how real assessments behave. Every factor keeps its own weight,
 * severity, evidence trail and remediation advice, so the score is *auditable*
 * rather than a magic number. A counterfactual (`residualAfterTopRemediation`)
 * shows the analyst which single fix lowers risk most.
 */

import type { Evidence, EvidenceDraft } from '../types/evidence';
import type { RiskAssessment, RiskFactor, RiskFactorDraft, RiskLevel } from '../types/report';

export interface RiskFactorDefinition {
  label: string;
  category: RiskFactor['category'];
  /** 0..1 maximum influence of this factor class. */
  weight: number;
  /** Default severity multiplier applied to module-supplied severity. */
  severityScale?: number;
  recommendation: string;
}

/**
 * Curated taxonomy of exposure factors. Weights are calibrated for
 * *individual/organisational digital exposure* assessment, not for credit or
 * actuarial use — documented explicitly to prevent misuse of the score.
 */
export const RISK_FACTOR_LIBRARY: Record<string, RiskFactorDefinition> = {
  // ── Identity ─────────────────────────────────────────────────────────────
  'identity.pii-in-breaches': { label: 'Персональные данные в утечках', category: 'exposure', weight: 0.55, recommendation: 'Сменить компрометирующие пароли, включить 2FA, отследить использование ПДн для кредитного мошенничества' },
  'identity.documents-exposed': { label: 'Скан/номер документа в открытом доступе', category: 'identity', weight: 0.7, severityScale: 1.2, recommendation: 'Зафиксировать факт утечки, ограничить использование документа, проверить займы/регистрации на него' },
  'identity.biometric-exposure': { label: 'Биометрический отпечаток доступен', category: 'identity', weight: 0.75, recommendation: 'Проверить систему распознавания лица: возможна подмена биометрии при доступе' },
  'identity.full-profile-triangulated': { label: 'Полный профиль собран из открытых источников', category: 'identity', weight: 0.4, recommendation: 'Сократить публичный след: ФИО+ДР+адрес достаточно для 90% социальной инженерии' },

  // ── Cyber / infrastructure ───────────────────────────────────────────────
  'cyber.plaintext-credentials': { label: 'Пароль в открытом виде в дампе', category: 'cyber', weight: 0.95, recommendation: 'Немедленная смена пароля и всех повторов; проверить журналы входов' },
  'cyber.password-hash-exposed': { label: 'Хэш пароля скомпрометирован', category: 'cyber', weight: 0.6, recommendation: 'Считать пароль скомпрометированным, если он слабый или переиспользуется' },
  'cyber.reused-credentials': { label: 'Переиспользование учётных данных', category: 'cyber', weight: 0.7, recommendation: 'Развести пароли по сервисам, внедрить менеджер паролей' },
  'cyber.domain-spoofable': { label: 'Домен допускает подделку отправителя', category: 'cyber', weight: 0.6, recommendation: 'Настроить SPF -all, DKIM и DMARC p=reject' },
  'cyber.mail-security-weak': { label: 'Слабая почтовая защита домена', category: 'cyber', weight: 0.35, recommendation: 'Внедрить MTA-STS, TLS-RPT и BIMI' },
  'cyber.typosquat-or-homoglyph': { label: 'Домен-двойник (гомоглиф/опечатка)', category: 'cyber', weight: 0.8, recommendation: 'Проверить регистрацию домена-двойника и поданные заявки на его блокировку' },
  'cyber.dga-domain': { label: 'Домен похож на алгоритмически сгенерированный', category: 'cyber', weight: 0.7, recommendation: 'Проверить домен на признаки C2-инфраструктуры (DGA)' },
  'cyber.anonymity-infrastructure': { label: 'Инфраструктура анонимизации (VPN/Tor/proxy)', category: 'cyber', weight: 0.45, recommendation: 'Учесть, что источник мог маскировать реальный IP; искать коррелирующие временные метки' },
  'cyber.infrastructure-adversarial': { label: 'Bulletproof/офшорный хостинг, privacy-регистратор', category: 'infrastructure', weight: 0.5, recommendation: 'Проверить репутацию ASN и историю abuse-жалоб' },
  'cyber.expired-or-weak-tls': { label: 'Проблемы TLS-сертификатов', category: 'cyber', weight: 0.3, recommendation: 'Проверить цепочку сертификатов и историю перевыпусков (признак компрометации)' },
  'cyber.exposed-service': { label: 'Открытые административные сервисы', category: 'cyber', weight: 0.65, recommendation: 'Закрыть панели управления, внедрить VPN и WAF' },
  'cyber.dns-divergence': { label: 'Расхождение ответов DNS между резолверами', category: 'cyber', weight: 0.35, recommendation: 'Возможен split-horizon/гео-таргетинг: сравнить ответы из разных стран' },
  'cyber.shared-infrastructure': { label: 'Общая инфраструктура с другими активами', category: 'infrastructure', weight: 0.35, recommendation: 'Построить карту владения: общий TLS-сертификат/хостинг связывает активы одного оператора' },
  'cyber.privacy-registrar': { label: 'Приватная регистрация домена / скрытый владелец', category: 'infrastructure', weight: 0.3, recommendation: 'Определить владельца по косвенным признакам: DNS-провайдер, TLS-сертификаты, аналитика, хостинг' },

  // ── Financial ────────────────────────────────────────────────────────────
  'fin.sanctions-hit': { label: 'Совпадение с санкционным списком', category: 'legal', weight: 0.95, severityScale: 1.15, recommendation: 'Верифицировать совпадение вручную (омонимия), при подтверждении — блокирующие меры' },
  'fin.pep-exposure': { label: 'Публичное должностное лицо / PEP', category: 'legal', weight: 0.4, recommendation: 'Применить расширенную проверку (EDD) и мониторинг аффилированности' },
  'fin.crypto-mixer-exposure': { label: 'Связь с миксером/анонимайзером', category: 'financial', weight: 0.75, recommendation: 'Оценить источники средств; проверить контрагентов адреса' },
  'fin.crypto-darknet-exposure': { label: 'Связь с даркнет-сервисом', category: 'financial', weight: 0.9, recommendation: 'Зафиксировать транзакционный путь, подготовить отчёт для комплаенса' },
  'fin.high-value-flows': { label: 'Значительные транзакционные объёмы', category: 'financial', weight: 0.45, recommendation: 'Сопоставить объёмы с заявленными доходами' },
  'fin.offshore-structure': { label: 'Офшорная/сложная корпоративная структура', category: 'financial', weight: 0.5, recommendation: 'Раскрыть цепочку владения до бенефициара (UBO)' },

  // ── Legal / regulatory ───────────────────────────────────────────────────
  'legal.enforcement-proceedings': { label: 'Исполнительные производства', category: 'legal', weight: 0.55, recommendation: 'Проверить актуальность и суммы взысканий, риск ареста счетов' },
  'legal.court-cases': { label: 'Судебные дела (ответчик/истец)', category: 'legal', weight: 0.35, recommendation: 'Изучить предмет спора — часто раскрывает связи и активы' },
  'legal.bankruptcy': { label: 'Банкротство / ликвидация', category: 'legal', weight: 0.6, recommendation: 'Оценить риск субсидиарной ответственности и оспаривания сделок' },
  'legal.disqualified': { label: 'Дисквалификация должностного лица', category: 'legal', weight: 0.6, recommendation: 'Проверить участие в органах управления других юрлиц' },
  'legal.tax-debt': { label: 'Налоговая задолженность', category: 'legal', weight: 0.45, recommendation: 'Учесть риск блокировки счетов и требования ФНС' },

  // ── Operational security ─────────────────────────────────────────────────
  'opsec.username-reuse': { label: 'Переиспользование никнейма', category: 'opsec', weight: 0.5, recommendation: 'Корреляция аккаунтов: единый псевдоним связывает цифровые следы' },
  'opsec.avatar-reuse': { label: 'Идентичный аватар на разных платформах', category: 'opsec', weight: 0.45, recommendation: 'Провести обратный поиск изображения по всем найденным профилям' },
  'opsec.precise-geolocation': { label: 'Точная геолокация в метаданных', category: 'opsec', weight: 0.65, recommendation: 'Сопоставить координаты с адресом регистрации, оценить приватность публикаций' },
  'opsec.movement-infeasible': { label: 'Физически невозможное перемещение', category: 'opsec', weight: 0.55, recommendation: 'Проверить подмену GPS, общий аккаунт или сбой часового пояса' },
  'opsec.timezone-mismatch': { label: 'Несовпадение часовых поясов активности', category: 'opsec', weight: 0.35, recommendation: 'Использовать при установлении реального местоположения' },
  'opsec.identity-mismatch': { label: 'Противоречие между источниками', category: 'opsec', weight: 0.5, recommendation: 'Разрешить конфликт вручную: возможна подмена личности или омонимия' },

  // ── Reputation ───────────────────────────────────────────────────────────
  'reputation.negative-media': { label: 'Негативные публикации в СМИ', category: 'reputation', weight: 0.35, recommendation: 'Оценить достоверность источника и наличие опровержений' },
  'reputation.scam-reports': { label: 'Жалобы на мошенничество', category: 'reputation', weight: 0.8, recommendation: 'Проверить паттерн: множественные жалобы от независимых лиц' },
  'reputation.forum-mentions': { label: 'Упоминания на форумах/в сообществах', category: 'reputation', weight: 0.25, recommendation: 'Собрать контекст упоминаний и оценить давность' },
};

export interface RiskModelOptions {
  /** Override or extend the built-in library. */
  library?: Record<string, RiskFactorDefinition>;
  includeHeuristics?: boolean;
}

export class RiskModel {
  private readonly factors: RiskFactor[] = [];
  private readonly library: Record<string, RiskFactorDefinition>;
  private readonly includeHeuristics: boolean;

  constructor(options: RiskModelOptions = {}) {
    this.library = { ...RISK_FACTOR_LIBRARY, ...(options.library ?? {}) };
    this.includeHeuristics = options.includeHeuristics ?? true;
  }

  /** Register a module-supplied factor (severity 0..1), returning its record. */
  add(draft: RiskFactorDraft, context: { moduleId: string; evidenceIds?: string[] }): RiskFactor {
    const definition = this.library[draft.id];
    const weight = draft.weight ?? definition?.weight ?? 0.4;
    const severity = Math.max(0, Math.min(1, draft.severity * (definition?.severityScale ?? 1)));
    const factor: RiskFactor = {
      id: draft.id,
      label: draft.label ?? definition?.label ?? draft.id,
      category: draft.category ?? definition?.category ?? 'reputation',
      severity: Number(severity.toFixed(3)),
      weight,
      contribution: 0,
      moduleId: context.moduleId,
      evidenceIds: [...new Set([...(draft.evidenceIds ?? []), ...(context.evidenceIds ?? [])])],
      explain: draft.explain ?? definition?.recommendation ?? 'Фактор риска, выявленный модулем сбора',
    };
    this.factors.push(factor);
    this.recomputeContributions();
    return factor;
  }

  addFromEvidence(evidence: Evidence[], moduleOf: (record: Evidence) => string = (record) => record.moduleId): void {
    for (const record of evidence) {
      const factorId = typeof record.value === 'object' && record.value && 'riskFactor' in (record.value as Record<string, unknown>)
        ? String((record.value as Record<string, unknown>).riskFactor)
        : undefined;
      if (!factorId) continue;
      this.add(
        {
          id: factorId,
          label: this.library[factorId]?.label ?? factorId,
          severity: Number((record.value as Record<string, unknown>).severity ?? record.confidence * 0.8),
          evidenceIds: [record.id],
          explain: record.claim,
        },
        { moduleId: moduleOf(record) },
      );
    }
  }

  /** Contribution of each factor in the current noisy-OR aggregate. */
  private recomputeContributions(): void {
    // Sort so that the strongest factors are applied first — this makes the
    // per-factor attribution stable and intuitive for analysts.
    const ordered = [...this.factors].sort((a, b) => b.weight * b.severity - a.weight * a.severity);
    let remaining = 1;
    for (const factor of ordered) {
      const risk = Math.min(1, factor.weight * factor.severity);
      const contribution = remaining * risk;
      factor.contribution = Number(contribution.toFixed(4));
      remaining *= 1 - risk;
    }
  }

  /** Raw noisy-OR aggregate 0..1. */
  aggregate(excludedIndex = -1): number {
    let remaining = 1;
    this.factors.forEach((factor, index) => {
      if (index === excludedIndex) return;
      remaining *= 1 - Math.min(1, factor.weight * factor.severity);
    });
    return 1 - remaining;
  }

  /**
   * Band mapping for the exposure score. Bands are documented, monotonic and
   * deliberately conservative: 35 = "moderate" means a third of the model's
   * maximum exposure has been observed with evidence.
   */
  private level(score: number): RiskLevel {
    if (score < 8) return 'minimal';
    if (score < 20) return 'low';
    if (score < 35) return 'moderate';
    if (score < 50) return 'elevated';
    if (score < 65) return 'high';
    if (score < 82) return 'severe';
    return 'critical';
  }

  assess(meta: { evidenceCoverage?: number; averageConfidence?: number; includeHeuristics?: boolean } = {}): RiskAssessment {
    const includeHeuristics = meta.includeHeuristics ?? this.includeHeuristics;
    const factors = (includeHeuristics ? this.factors : this.factors.filter((factor) => factor.category !== 'reputation')).sort(
      (a, b) => b.contribution - a.contribution,
    );
    const score = Number((this.aggregate() * 100).toFixed(1));

    const breakdown: RiskAssessment['breakdown'] = {
      identity: 0, legal: 0, financial: 0, cyber: 0, exposure: 0, opsec: 0, reputation: 0, infrastructure: 0,
    };
    for (const factor of factors) breakdown[factor.category] += factor.contribution;
    for (const key of Object.keys(breakdown) as Array<keyof typeof breakdown>) {
      breakdown[key] = Number((breakdown[key] * 100).toFixed(2));
    }

    const topIndex = this.factors.reduce((best, factor, index) => (factor.contribution > (this.factors[best]?.contribution ?? -1) ? index : best), 0);
    const coverage = meta.evidenceCoverage ?? Math.min(1, factors.length / 8);
    const confidence = Number(Math.min(1, 0.35 + coverage * 0.4 + (meta.averageConfidence ?? 0.5) * 0.25).toFixed(3));

    return {
      score,
      level: this.level(score),
      factors,
      drivers: factors.slice(0, 6),
      confidence,
      residualAfterTopRemediation: Number((this.aggregate(topIndex) * 100).toFixed(1)),
      breakdown,
    };
  }

  get size(): number {
    return this.factors.length;
  }

  definitions(): Record<string, RiskFactorDefinition> {
    return { ...this.library };
  }
}

/** Convenience: build risk factor drafts straight from evidence payloads. */
export function riskFactorFromEvidence(draft: EvidenceDraft, factorId: string, severity: number, explain?: string): RiskFactorDraft {
  return { id: factorId, label: RISK_FACTOR_LIBRARY[factorId]?.label ?? factorId, severity, explain: explain ?? draft.claim };
}
