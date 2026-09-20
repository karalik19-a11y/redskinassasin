/**
 * TOMAHAWK OSINT ENGINE — investigation profiles
 * ---------------------------------------------------------------------------
 * A profile is a *policy*, not a hard-coded flow: it decides which capability
 * classes run, how deep the engine pivots, and how aggressively modules are
 * allowed to spend the time budget. Hosts can register their own profiles
 * (e.g. a bank's KYC profile) without touching the engine.
 */

import type { ModuleCategory } from '../types/module';

export interface ProfileDefinition {
  id: string;
  label: string;
  description: string;
  /** Module categories included in this profile. */
  categories: ModuleCategory[];
  maxDepth: number;
  budgetMs: number;
  concurrency: number;
  maxPivotsPerLevel: number;
  /** Profiles that must never run network modules (e.g. air-gapped review). */
  offlineByDefault?: boolean;
}

export const INVESTIGATION_PROFILES: Record<string, ProfileDefinition> = {
  'full-spectrum': {
    id: 'full-spectrum',
    label: 'Полный спектр',
    description: 'Все модули: идентификаторы, инфраструктура, утечки, крипто, гео, связи. Максимальная глубина пивотов.',
    categories: ['identity', 'telecom', 'infrastructure', 'web', 'social', 'finance', 'crypto', 'legal', 'exposure', 'media', 'geospatial', 'temporal', 'fusion'],
    maxDepth: 2,
    budgetMs: 60_000,
    concurrency: 6,
    maxPivotsPerLevel: 32,
  },
  'person-fast': {
    id: 'person-fast',
    label: 'Персона — быстрая проверка',
    description: 'Идентификаторы, телефон, соцсети и утечки. Оптимально для экспресс-проверки кандидата или контрагента.',
    categories: ['identity', 'telecom', 'social', 'exposure', 'temporal', 'fusion'],
    maxDepth: 1,
    budgetMs: 25_000,
    concurrency: 6,
    maxPivotsPerLevel: 16,
  },
  'person-deep': {
    id: 'person-deep',
    label: 'Персона — глубокое исследование',
    description: 'Расширенный сбор по человеку: документы, транспорт, недвижимость, финансы, юридические следы, медиа.',
    categories: ['identity', 'telecom', 'infrastructure', 'social', 'exposure', 'finance', 'crypto', 'legal', 'geospatial', 'media', 'temporal', 'fusion'],
    maxDepth: 3,
    budgetMs: 120_000,
    concurrency: 8,
    maxPivotsPerLevel: 48,
  },
  'corporate-due-diligence': {
    id: 'corporate-due-diligence',
    label: 'Компания — проверка контрагента',
    description: 'Реестры, санкции, почтовая безопасность домена, корпоративные связи, TLS-история.',
    categories: ['identity', 'infrastructure', 'finance', 'legal', 'web', 'temporal', 'fusion'],
    maxDepth: 2,
    budgetMs: 60_000,
    concurrency: 6,
    maxPivotsPerLevel: 24,
  },
  'infrastructure-recon': {
    id: 'infrastructure-recon',
    label: 'Инфраструктура',
    description: 'DNS, сертификаты, ASN, технологический стек, поддомены, почтовые записи.',
    categories: ['infrastructure', 'web', 'geospatial', 'temporal', 'fusion'],
    maxDepth: 2,
    budgetMs: 60_000,
    concurrency: 8,
    maxPivotsPerLevel: 40,
  },
  'crypto-investigation': {
    id: 'crypto-investigation',
    label: 'Крипто-расследование',
    description: 'Мультичейн-валидация, балансы, кластеризация адресов, экспозиция на миксеры и даркнет.',
    categories: ['crypto', 'finance', 'exposure', 'infrastructure', 'temporal', 'fusion'],
    maxDepth: 3,
    budgetMs: 90_000,
    concurrency: 6,
    maxPivotsPerLevel: 40,
  },
  'kyc-screening': {
    id: 'kyc-screening',
    label: 'KYC / комплаенс-скрининг',
    description: 'Санкционные списки, PEP, юридические регистры, аффилированность. Минимум вторжения в приватность.',
    categories: ['identity', 'legal', 'finance', 'fusion'],
    maxDepth: 2,
    budgetMs: 45_000,
    concurrency: 5,
    maxPivotsPerLevel: 20,
  },
  'offline-forensics': {
    id: 'offline-forensics',
    label: 'Офлайн-разбор (air-gap)',
    description: 'Только локальные вычисления: контрольные суммы, метаданные изображений, алгоритмы, анализ дампов. Сеть запрещена.',
    categories: ['identity', 'media', 'crypto', 'temporal', 'fusion'],
    maxDepth: 2,
    budgetMs: 30_000,
    concurrency: 4,
    maxPivotsPerLevel: 20,
    offlineByDefault: true,
  },
};

export function resolveProfile(id: string | undefined): ProfileDefinition {
  if (id && INVESTIGATION_PROFILES[id]) return INVESTIGATION_PROFILES[id] as ProfileDefinition;
  return INVESTIGATION_PROFILES['full-spectrum'] as ProfileDefinition;
}
