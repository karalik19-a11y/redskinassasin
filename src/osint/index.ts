/**
 * TOMAHAWK OSINT ENGINE — public API
 * ===========================================================================
 * Профессиональный, новаторский OSINT-движок с нулевыми зависимостями, который
 * импортируется в любое приложение (React/Vue/Svelte SPA, Web Worker, Node,
 * Deno, Bun, edge runtime, React Native).
 *
 * Быстрый старт:
 *
 * ```ts
 * import { createOsintEngine } from './osint';
 *
 * const engine = createOsintEngine({
 *   settings: { profile: 'person-fast', offline: false },
 *   onEvent: (event) => console.log(event.type, event.payload),
 * });
 *
 * const report = await engine.investigate({
 *   input: 'Соколов Михаил Андреевич, +7 916 402-91-88, m.sokolov@example.com',
 * });
 *
 * console.log(report.risk.level, report.risk.score);
 * console.log(engine.export(report, 'markdown'));
 * console.log(engine.export(report, 'stix2'));
 * ```
 *
 * Что делает движок:
 *   1. Авто-триаж входных данных: распознаёт и валидирует идентификаторы
 *      (ИНН/СНИЛС/ОГРН/БИК/паспорт/ГРЗ/VIN/IBAN/IMEI/криптоадреса/…) реальными
 *      контрольными суммами.
 *   2. Планирует сбор: модули декларируют `accepts`/`produces`, планировщик
 *      строит DAG и рекурсивно идёт по найденным пивотам (frontier BFS).
 *   3. Собирает данные параллельно под жёстким бюджетом времени, с кэшем,
 *      rate-limit, ретраями и цепочкой CORS-транзитов (каждая запись знает,
 *      каким путём получена).
 *   4. Фьюзит наблюдения в логарифмических шансах с поправкой на корреляцию
 *      источников и явной фиксацией противоречий.
 *   5. Считает графовую аналитику (центральность, сообщества, предсказание
 *      скрытых связей) и темпоральные всплески.
 *   6. Оценивает объяснимый риск по модели noisy-OR с контрфактикой.
 *   7. Отдаёт воспроизводимый отчёт с SHA-256 печатью и экспортом в
 *      JSON/CSV/GraphML/STIX 2.1/Markdown.
 */

// ── Core ─────────────────────────────────────────────────────────────────────
export { createOsintEngine, OsintEngine } from './core/engine';
export type { EngineOptions, InvestigateOptions, PlanPreview } from './core/engine';

export { EntityGraph, resolveCanonical } from './core/graph';
export type { MergeOptions } from './core/graph';
export { EvidenceLedger, fuseClaim, logit, sigmoid, reliabilityToLikelihoodRatio } from './core/fusion';
export type { FusedClaim, ClaimValueGroup } from './core/fusion';
export { RiskModel, RISK_FACTOR_LIBRARY } from './core/risk';
export type { RiskFactorDefinition } from './core/risk';
export { generateFindings } from './core/findings';
export {
  computeGraphMetrics,
  buildTimeline,
  detectBursts,
  poissonSurprise,
  clusterIdentities,
  parseLooseDate,
} from './core/analytics';
export type { Burst } from './core/analytics';
export { ModuleRegistry, Planner } from './core/planner';
export { Cache, MemoryCacheStore, KeyValueCacheStore } from './core/cache';
export type { CacheStore, CacheEntry } from './core/cache';
export { MemoryStore, KeyValueStore, toStoredInvestigation } from './core/store';
export type { InvestigationStore, StoredInvestigation } from './core/store';
export { parseSeeds, extractObservables, seedHeadline, seedsToPivots, looksLikePersonName } from './core/seeds';
export type { SeedParseResult } from './core/seeds';
export { exportReport, toJson, toJsonl, toCsv, toGraphML, toStixBundle, toMarkdown, deterministicUuid } from './core/export';
export type { ExportFormat } from './core/export';
export { OsintError, isOsintError, errorMessage, errorCode, ok, fail } from './core/errors';
export type { OsintErrorCode, Result } from './core/errors';
export { EventBus } from './types/events';
export type { EngineEvent, EngineEventType, EngineEventHandler } from './types/events';
export { DEFAULT_SETTINGS } from './types/module';
export { ENGINE_VERSION, RISK_LEVEL_LABELS_RU } from './types/report';
export { SOURCE_KIND_LABELS_RU, DEFAULT_RELIABILITY } from './types/evidence';
export { ENTITY_LABEL_RU, ENTITY_FAMILY, RELATION_LABELS_RU } from './types/entity';
export { MODULE_CATEGORY_LABELS_RU, moduleCapabilities } from './types/module';

// ── Network layer ────────────────────────────────────────────────────────────
export { HttpClient } from './net/http';
export type { HttpClientOptions, HttpMetrics } from './net/http';
export { TRANSIT_PROVIDERS, resolveTransitChain } from './net/transit';
export type { TransitProvider } from './net/transit';
export { DNS_RESOLVERS, resolveRecords, queryResolver, assessMailSecurity, parseDkimRecord, reverseDns, isPrivateIp } from './net/dns';
export type { RecordSet, MailSecurityPosture, DnsResponse } from './net/dns';

// ── Algorithms (usable standalone) ───────────────────────────────────────────
export { md5, sha1, sha256, sha256Async, doubleSha256Bytes, bytesToHex, hexToBytes, utf8ToBytes, concatBytes } from './algo/hashes';
export { keccak256, keccak256Bytes, toEip55Address, verifyEip55, evmFunctionSelector, KNOWN_SELECTORS } from './algo/keccak';
export { base58Encode, base58Decode, decodeBase58Check, encodeBase58Check, validateBitcoinBase58, validateTronAddress, validateSolanaAddress, validateMoneroAddressFormat } from './algo/base58';
export { bech32Decode, bech32Encode, validateBech32Address, witnessProgramToScriptPubKey } from './algo/bech32';
export { isValidLuhn, luhnCheckDigit, validateIban, validateEan, validateImei, validateIccid, mod97, isValidVerhoeff } from './algo/checksums';
export {
  validateInn,
  validateInn10,
  validateInn12,
  validateSnils,
  validateOgrn,
  validateOgrnip,
  validateKpp,
  validateBik,
  validatePassportRf,
  validateDriverLicense,
  parseRuPlate,
  decodeVin,
  validateCadastralNumber,
  canonicalPlate,
  identifyRussianDocument,
  regionByCode,
  regionByPlate,
  RU_REGIONS,
} from './algo/ruIdentifiers';
export type { IdentifierCheck, PlateCheck, VinCheck, RuRegion } from './algo/ruIdentifiers';
export {
  levenshtein,
  levenshteinRatio,
  jaro,
  jaroWinkler,
  diceCoefficient,
  tokenSetRatio,
  phoneticRu,
  transliterate,
  transliterationVariants,
  parseFullName,
  matchPersons,
  skeletonize,
  isMixedScript,
  stripDiacritics,
  genderFromPatronymic,
} from './algo/stringdistance';
export type { NameMatchResult, NameMatchSignal, NameParts } from './algo/stringdistance';
export {
  parsePhone,
  formatPhoneE164,
  parseEmail,
  detectEmailProvider,
  normalizeDomain,
  registrableDomain,
  publicSuffix,
  canonicalUrl,
  extractHostname,
  normalizeUsername,
  normalizeText,
  digitsOnly,
  compactAlnum,
  isIpAddress,
  detectMixedScriptDomain,
  COUNTRY_CALLING_CODES,
} from './algo/normalize';
export type { ParsedPhone, ParsedEmail } from './algo/normalize';
export {
  geohashEncode,
  geohashDecode,
  geohashNeighbours,
  haversineMetres,
  bearingDegrees,
  assessMovement,
  toDms,
} from './algo/geospatial';
export type { GeohashArea, MovementFeasibility } from './algo/geospatial';
export { shannonEntropy, normalizedEntropy, chiSquareUniform, dgaScore, analyzePasswordStrength, looksBase64, looksHex } from './algo/entropy';
export type { DgaScore, PasswordStrength } from './algo/entropy';
export { perceptualHash, compareHashes, hammingDistanceHex, errorLevelAnalysis, toGrayscale } from './algo/phash';
export type { PerceptualHash, HashComparison, ElaResult, RgbaImage } from './algo/phash';
export { parseImageMetadata, sniffFileType } from './algo/exif';
export type { ExtractedImageMetadata } from './algo/exif';

// ── Datasets ─────────────────────────────────────────────────────────────────
export { RU_DEF_MATRIX, identifyDefRange, FEDERAL_DISTRICTS } from './datasets/defCodes';
export type { DefEntry } from './datasets/defCodes';

// ── Profiles ─────────────────────────────────────────────────────────────────
export { INVESTIGATION_PROFILES, resolveProfile } from './presets/profiles';
export type { ProfileDefinition } from './presets/profiles';

// ── Modules ──────────────────────────────────────────────────────────────────
export { createDefaultModules } from './modules';
export { identifierModule, artifactModule } from './modules/identifier';
export { identityModule, usernameCandidates } from './modules/identity';
export { telecomModule } from './modules/telecom';
export { infrastructureModule, detectTechStack, detectSecurityHeaders } from './modules/network';
export { certificatesModule } from './modules/certificates';
export { webModule, parsePageMetadata } from './modules/web';
export type { PageMetadata } from './modules/web';
export { socialModule, huntUsername, PLATFORMS } from './modules/social';
export type { PlatformSpec, FootprintHit } from './modules/social';
export { exposureModule, checkPwnedPassword } from './modules/exposure';
export type { PwnedPasswordResult } from './modules/exposure';
export { cryptoModule } from './modules/crypto';
export { sanctionsModule, screenAgainstWatchlist } from './modules/sanctions';
export type { WatchlistMatch } from './modules/sanctions';
export { registriesModule } from './modules/registries';
export { mediaModule } from './modules/media';
export { geoModule, estimateTimezone, mappingLinks } from './modules/geo';
export { temporalModule, harvestDatedFacts, inferTimezoneFromHours } from './modules/temporal';

// ── Types ────────────────────────────────────────────────────────────────────
export * from './types';
