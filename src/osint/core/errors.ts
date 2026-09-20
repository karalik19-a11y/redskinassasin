/**
 * TOMAHAWK OSINT ENGINE — error taxonomy & result helpers
 * Errors are typed so the UI can distinguish "no data" from "blocked by CORS"
 * from "budget exhausted" — a core requirement for honest reporting.
 */

export type OsintErrorCode =
  | 'INVALID_INPUT'
  | 'NETWORK_UNAVAILABLE'
  | 'HTTP_ERROR'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'BLOCKED'
  | 'AUTH_REQUIRED'
  | 'PARSE_ERROR'
  | 'BUDGET_EXHAUSTED'
  | 'CANCELLED'
  | 'MODULE_FAILED'
  | 'INTERNAL';

export class OsintError extends Error {
  readonly code: OsintErrorCode;
  readonly moduleId?: string;
  readonly url?: string;
  readonly retryable: boolean;
  readonly cause?: unknown;

  constructor(
    code: OsintErrorCode,
    message: string,
    options: { moduleId?: string; url?: string; retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message);
    this.name = 'OsintError';
    this.code = code;
    this.moduleId = options.moduleId;
    this.url = options.url;
    this.retryable = options.retryable ?? RETRYABLE.has(code);
    this.cause = options.cause;
  }

  toJSON(): Record<string, unknown> {
    return { name: this.name, code: this.code, message: this.message, moduleId: this.moduleId, url: this.url, retryable: this.retryable };
  }
}

const RETRYABLE = new Set<OsintErrorCode>(['NETWORK_UNAVAILABLE', 'TIMEOUT', 'RATE_LIMITED', 'INTERNAL']);

export function isOsintError(value: unknown): value is OsintError {
  return value instanceof OsintError;
}

export function errorMessage(value: unknown): string {
  if (isOsintError(value)) return `[${value.code}] ${value.message}`;
  if (value instanceof Error) return value.message;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function errorCode(value: unknown): OsintErrorCode {
  if (isOsintError(value)) return value.code;
  if (value instanceof DOMException && value.name === 'AbortError') return 'CANCELLED';
  return 'INTERNAL';
}

/** Explicit result type for operations where failure is an expected outcome. */
export type Result<T, E = OsintError> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function fail<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
