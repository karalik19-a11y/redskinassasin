/**
 * TOMAHAWK OSINT ENGINE — entity model
 * ---------------------------------------------------------------------------
 * An *entity* is anything the engine can pivot on. Types are deliberately
 * coarse but each carries a canonical `value` plus structured `properties`, so
 * modules rely on data rather than on string parsing. Canonicalisation is
 * centralised in `core/graph.ts::resolveCanonical`:
 *
 *   phone     E.164 ("+79164029188")           domain    lowercase ASCII
 *   email     lowercase                        person    lowercase, ё→е, spaces collapsed
 *   crypto    chain casing preserved           location  trimmed, case-insensitive
 *
 * `EntityDraft` is what modules emit (no id — the graph assigns a stable,
 * content-addressed one, so re-running yields identical ids); `Entity` is the
 * merged, provenance-carrying node analysts receive.
 */

export type EntityId = string;

export type EntityType =
  // Identity
  | 'person'
  | 'alias'
  | 'nickname'
  | 'username'
  | 'email'
  | 'phone'
  | 'social_profile'
  | 'messenger_account'
  | 'photo'
  | 'signature'
  // Documents & identifiers
  | 'tax_id'
  | 'document'
  | 'bank_account'
  | 'payment_card'
  | 'vehicle'
  | 'imei'
  | 'iccid'
  | 'real_estate'
  | 'bank'
  // Cyber
  | 'domain'
  | 'subdomain'
  | 'url'
  | 'ip'
  | 'asn'
  | 'netblock'
  | 'certificate'
  | 'technology'
  | 'port'
  | 'hash'
  | 'breach'
  | 'credential'
  | 'password'
  // Financial
  | 'crypto_address'
  | 'crypto_tx'
  | 'wallet'
  | 'transaction'
  // Legal / organisational
  | 'organization'
  | 'watchlist_hit'
  | 'court_case'
  | 'enforcement'
  | 'license'
  | 'sanction'
  // Media & spatial
  | 'image'
  | 'video'
  | 'document_file'
  | 'location'
  | 'address'
  | 'geohash'
  // Meta
  | 'event'
  | 'service'
  | 'other';

export type EntityFamily = 'identity' | 'document' | 'cyber' | 'financial' | 'legal' | 'media' | 'spatial' | 'meta';

export const ENTITY_FAMILY: Record<EntityType, EntityFamily> = {
  person: 'identity', alias: 'identity', nickname: 'identity', username: 'identity', email: 'identity', phone: 'identity', social_profile: 'identity', messenger_account: 'identity',
  photo: 'media', signature: 'media',
  tax_id: 'document', document: 'document', bank_account: 'document', payment_card: 'document', vehicle: 'document', imei: 'document', iccid: 'document', real_estate: 'document', bank: 'document',
  domain: 'cyber', subdomain: 'cyber', url: 'cyber', ip: 'cyber', asn: 'cyber', netblock: 'cyber', certificate: 'cyber', technology: 'cyber', port: 'cyber', hash: 'cyber', breach: 'cyber', credential: 'cyber', password: 'cyber',
  crypto_address: 'financial', crypto_tx: 'financial', wallet: 'financial', transaction: 'financial',
  organization: 'legal', watchlist_hit: 'legal', court_case: 'legal', enforcement: 'legal', license: 'legal', sanction: 'legal',
  image: 'media', video: 'media', document_file: 'media',
  location: 'spatial', address: 'spatial', geohash: 'spatial',
  event: 'meta', service: 'meta', other: 'meta',
};

/** Human-readable Russian labels for UI rendering. */
export const ENTITY_LABEL_RU: Record<EntityType, string> = {
  person: 'Человек', alias: 'Псевдоним', nickname: 'Никнейм', username: 'Имя пользователя', email: 'Электронная почта', phone: 'Телефон',
  social_profile: 'Профиль в соцсети', messenger_account: 'Аккаунт в мессенджере', photo: 'Фотография', signature: 'Подпись',
  tax_id: 'ИНН', document: 'Документ', bank_account: 'Банковский счёт', payment_card: 'Платёжная карта', vehicle: 'Транспортное средство',
  imei: 'IMEI', iccid: 'ICCID', real_estate: 'Недвижимость', bank: 'Банк',
  domain: 'Домен', subdomain: 'Субдомен', url: 'URL', ip: 'IP-адрес', asn: 'Автономная система', netblock: 'Подсеть',
  certificate: 'TLS-сертификат', technology: 'Технология', port: 'Порт', hash: 'Хэш', breach: 'Утечка', credential: 'Учётные данные', password: 'Пароль',
  crypto_address: 'Криптоадрес', crypto_tx: 'Криптотранзакция', wallet: 'Кошелёк', transaction: 'Транзакция',
  organization: 'Организация', watchlist_hit: 'Совпадение с базой', court_case: 'Судебное дело', enforcement: 'Исполнительное производство',
  license: 'Лицензия', sanction: 'Санкция',
  image: 'Изображение', video: 'Видео', document_file: 'Файл документа',
  location: 'Координаты', address: 'Адрес', geohash: 'Геохэш',
  event: 'Событие', service: 'Сервис', other: 'Прочее',
};

export interface EntityDraft {
  type: EntityType;
  /** Canonical value used for identity/deduplication. */
  value: string;
  /** Display label (defaults to `value` when not canonicalised). */
  label?: string;
  /** Structured attributes contributed by modules. */
  properties?: Record<string, unknown>;
  /** Alternative spellings that resolve to this node. */
  aliases?: string[];
  tags?: string[];
  /** 0..1 — certainty that the entity exists as observed. */
  confidence?: number;
  notes?: string[];
}

export interface Entity extends EntityDraft {
  /** Stable content-addressed id: `${type}:${fnv1a64(canonical)}`. */
  id: EntityId;
  label: string;
  properties: Record<string, unknown>;
  aliases: string[];
  tags: string[];
  confidence: number;
  /** Modules that contributed to this node (deduplication audit trail). */
  sources: string[];
  /** Evidence records attached to this node. */
  evidenceIds: string[];
  /** BFS depth at which the node was first seen (seeds are 0). */
  depth: number;
  firstSeen: number;
  lastSeen: number;
  notes: string[];
}

/** A suggested next step: entity + why it is worth investigating. */
export interface Pivot {
  type: EntityType;
  value: string;
  label?: string;
  /** Relation that produced the pivot ("owns", "transacted_with", …). */
  relation?: string;
  /** 0..1 priority used by the planner to order the frontier. */
  confidence: number;
  reason?: string;
  /** Entity the pivot was discovered from. */
  from?: EntityId;
  properties?: Record<string, unknown>;
}

export interface EdgeDraft {
  from: EntityId | { type: EntityType; value: string };
  to: EntityId | { type: EntityType; value: string };
  relation: string;
  /** 0..1 observed strength of the link (how much evidence supports it). */
  weight?: number;
  /** 0..1 certainty that the link exists at all. */
  confidence?: number;
  directed?: boolean;
}

export interface Edge {
  id: string;
  from: EntityId;
  to: EntityId;
  relation: string;
  weight: number;
  confidence: number;
  evidenceIds: string[];
  directed: boolean;
  createdAt: number;
}

/** Backwards-compatible alias used in report typings. */
export type GraphEdge = Edge;

export const RELATION_LABELS_RU: Record<string, string> = {
  same_as: 'то же лицо / объект',
  alias_of: 'псевдоним',
  owns: 'владеет',
  owned_by: 'принадлежит',
  uses: 'использует',
  used_by: 'используется',
  located_at: 'находится в',
  works_at: 'работает в',
  member_of: 'входит в',
  related_to: 'связан с',
  family_of: 'родственник',
  contact_of: 'контакт',
  registered_by: 'зарегистрирован на',
  resolved_to: 'разрешается в',
  hosted_on: 'размещён на',
  transacted_with: 'совершал операции с',
  communicated_with: 'общался с',
  mentioned_in: 'упоминается в',
  derived_from: 'получен из',
  duplicates: 'дублирует',
  sanctioned_by: 'связан с санкциями',
  registered_at: 'зарегистрирован в',
  issued_by: 'выдан',
};
