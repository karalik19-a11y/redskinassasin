/**
 * TOMAHAWK OSINT ENGINE — CORS transit providers
 * ---------------------------------------------------------------------------
 * Browser OSINT is dominated by a single boring problem: the interesting data
 * lives behind APIs that don't send `Access-Control-Allow-Origin`. Instead of
 * shipping a mandatory backend, the engine tries a *chain* of transports and
 * reports which one served each fact (`evidence.source.via`), so the analyst
 * always knows the delivery path — and can tell "API said no" from "CORS
 * blocked us". Server-side hosts can simply set `transit: ['direct']`.
 */

export interface TransitRequest {
  url: string;
  method: 'GET' | 'HEAD';
  headers: Record<string, string>;
  body?: string;
}

export interface TransitProvider {
  id: string;
  label: string;
  /** Homepage / terms of the relay (surfaced in the report caveats). */
  origin: string;
  /** Whether this provider needs the network at all. */
  order: number;
  /** Rewrite an outbound request into a relay request. */
  rewrite(request: TransitRequest): TransitRequest;
  /** Some relays wrap JSON in an envelope; unwrap it here. */
  unwrap?(body: string, contentType: string): string;
  /** Relays that only return text/markdown (not usable for binary payloads). */
  textOnly?: boolean;
  supportsHead?: boolean;
}

const PASSTHROUGH_HEADERS = ['accept', 'accept-language', 'x-requested-with', 'authorization', 'x-api-key'];

function forwardHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (PASSTHROUGH_HEADERS.includes(key.toLowerCase()) || key.toLowerCase().startsWith('content-')) out[key] = value;
  }
  return out;
}

export const TRANSIT_PROVIDERS: Record<string, TransitProvider> = {
  /** No relay — direct fetch. Works server-side and for CORS-enabled APIs. */
  direct: {
    id: 'direct',
    label: 'Прямой запрос (CORS)',
    origin: '—',
    order: 0,
    rewrite: (request) => request,
  },

  /** Jina Reader — renders and returns text; excellent for HTML collection. */
  jina: {
    id: 'jina',
    label: 'Jina Reader (r.jina.ai)',
    origin: 'https://r.jina.ai',
    order: 10,
    textOnly: false,
    rewrite: (request) => ({
      ...request,
      url: `https://r.jina.ai/${request.url}`,
      headers: { ...forwardHeaders(request.headers), 'x-respond-with': request.headers.accept?.includes('json') ? 'text' : 'markdown' },
    }),
    unwrap: (body) => body,
  },

  /** AllOrigins — raw byte relay, supports arbitrary content types. */
  allorigins: {
    id: 'allorigins',
    label: 'AllOrigins (api.allorigins.win)',
    origin: 'https://api.allorigins.win',
    order: 20,
    rewrite: (request) => ({ ...request, url: `https://api.allorigins.win/raw?url=${encodeURIComponent(request.url)}`, headers: forwardHeaders(request.headers) }),
  },

  /** CodeTabs CORS proxy — simple `?quest=` relay. */
  codetabs: {
    id: 'codetabs',
    label: 'CodeTabs Proxy (api.codetabs.com)',
    origin: 'https://api.codetabs.com',
    order: 30,
    rewrite: (request) => ({ ...request, url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(request.url)}`, headers: forwardHeaders(request.headers) }),
  },

  /** corsproxy.io — supports method + header forwarding. */
  corsproxy: {
    id: 'corsproxy',
    label: 'corsproxy.io',
    origin: 'https://corsproxy.io',
    order: 40,
    supportsHead: true,
    rewrite: (request) => ({ ...request, url: `https://corsproxy.io/?${encodeURIComponent(request.url)}`, headers: forwardHeaders(request.headers) }),
  },

  /** thingproxy — final fallback, GET only. */
  thingproxy: {
    id: 'thingproxy',
    label: 'ThingProxy',
    origin: 'https://thingproxy.freeboard.io',
    order: 50,
    rewrite: (request) => ({ ...request, url: `https://thingproxy.freeboard.io/fetch/${request.url}`, headers: forwardHeaders(request.headers) }),
  },
};

export function resolveTransitChain(ids: readonly string[]): TransitProvider[] {
  const providers = ids
    .map((id) => TRANSIT_PROVIDERS[id.toLowerCase()])
    .filter((provider): provider is TransitProvider => Boolean(provider));
  return providers.length ? providers.sort((a, b) => a.order - b.order) : [TRANSIT_PROVIDERS.direct as TransitProvider];
}

/** Heuristics that turn a relay's error envelope into a usable signal. */
export function detectRelayError(body: string): string | undefined {
  const head = body.slice(0, 400).toLowerCase();
  if (head.includes('corsproxy') && head.includes('too many requests')) return 'relay rate-limited';
  if (head.includes('allorigins') && head.includes('error')) return 'allorigins error';
  if (head.includes('failed to fetch') || head.includes('fetch failed')) return 'upstream fetch failed';
  if (head.includes('only absolute urls are supported')) return 'invalid upstream url';
  if (head.includes('blocked') && head.includes('origin')) return 'relay blocked the origin';
  return undefined;
}
