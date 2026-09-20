/**
 * MODULE: social — cross-platform footprint with real API verification
 * ---------------------------------------------------------------------------
 * Two collection strategies, chosen per platform:
 *   1. **Authoritative API** (no scraping, no guessing): GitHub, GitLab,
 *      Codeberg, Reddit, Bluesky (AT-Proto), Keybase, Hacker News, npm, PyPI,
 *      Lichess, Chess.com, Mastodon — returns real profile fields (creation
 *      date, follower count, bio, avatar) that become graph facts.
 *   2. **Existence probe with soft-404 detection** for platforms without a
 *      public API: status codes are unreliable (many platforms answer 200 with
 *      "not found"), so the probe analyses page content and negative markers.
 *
 * Every result records how it was obtained, so an "account exists" claim is
 * never stronger than the evidence behind it.
 */

import type { ModuleInput, ModuleContext, ModuleResult, OsintModule } from '../types/module';
import { pMap } from '../core/concurrency';
import { parseEmail } from '../algo/normalize';
import { evidence, entity, edge, pivot, risk } from './common';

const MODULE_ID = 'social.footprint';

export interface PlatformSpec {
  id: string;
  name: string;
  category: string;
  /** Profile URL builder. */
  url: (username: string) => string;
  /** Public API that returns structured profile data (preferred). */
  api?: (username: string) => string;
  /** JSON path resolver for the API payload. */
  extract?: (payload: Record<string, unknown>) => Record<string, unknown>;
  /** HTTP status that definitively means "does not exist". */
  notFoundStatus?: number[];
  /** Requires an API key present in settings.apiKeys. */
  apiKey?: string;
  confidence?: number;
}

export const PLATFORMS: PlatformSpec[] = [
  {
    id: 'github',
    name: 'GitHub',
    category: 'Разработка',
    url: (user) => `https://github.com/${user}`,
    api: (user) => `https://api.github.com/users/${user}`,
    notFoundStatus: [404],
    confidence: 0.95,
    extract: (payload) => ({
      name: payload.name,
      bio: payload.bio,
      company: payload.company,
      location: payload.location,
      blog: payload.blog,
      publicRepos: payload.public_repos,
      followers: payload.followers,
      createdAt: payload.created_at,
      avatarUrl: payload.avatar_url,
      email: payload.email,
      twitterUsername: payload.twitter_username,
      hireable: payload.hireable,
    }),
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    category: 'Разработка',
    url: (user) => `https://gitlab.com/${user}`,
    api: (user) => `https://gitlab.com/api/v4/users?username=${encodeURIComponent(user)}`,
    confidence: 0.9,
    extract: (payload) => {
      const first = Array.isArray(payload) ? (payload[0] as Record<string, unknown> | undefined) : undefined;
      return first ? { name: first.name, bio: first.bio, location: first.location, createdAt: first.created_at, avatarUrl: first.avatar_url, webUrl: first.web_url } : {};
    },
  },
  {
    id: 'reddit',
    name: 'Reddit',
    category: 'Форумы',
    url: (user) => `https://www.reddit.com/user/${user}`,
    api: (user) => `https://www.reddit.com/user/${user}/about.json`,
    notFoundStatus: [404],
    confidence: 0.9,
    extract: (payload) => {
      const data = payload.data as Record<string, unknown> | undefined;
      return {
        name: data?.name,
        created: data?.created_utc,
        karma: data?.total_karma,
        commentKarma: data?.comment_karma,
        avatarUrl: data?.icon_img,
        isMod: data?.is_mod,
        verified: data?.verified,
      };
    },
  },
  {
    id: 'bluesky',
    name: 'Bluesky',
    category: 'Соцсети',
    url: (user) => `https://bsky.app/profile/${user}`,
    api: (user) => `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(user)}`,
    confidence: 0.9,
    extract: (payload) => ({
      handle: payload.handle,
      displayName: payload.displayName,
      description: payload.description,
      followersCount: payload.followersCount,
      followsCount: payload.followsCount,
      postsCount: payload.postsCount,
      createdAt: payload.createdAt,
      avatarUrl: payload.avatar,
    }),
  },
  {
    id: 'keybase',
    name: 'Keybase',
    category: 'Криптография / PGP',
    url: (user) => `https://keybase.io/${user}`,
    api: (user) => `https://keybase.io/_/api/1.0/user/lookup.json?username=${encodeURIComponent(user)}&fields=basics,profile,proofs`,
    confidence: 0.85,
    extract: (payload) => {
      const them = (payload.them as Array<Record<string, unknown>> | undefined)?.[0];
      const profile = them?.profile as Record<string, unknown> | undefined;
      return {
        fullName: profile?.full_name,
        location: profile?.location,
        bio: profile?.bio,
        proofs: (them?.proofs as Array<Record<string, unknown>> | undefined)?.map((proof) => `${proof.proof_type}:${proof.nametag}`),
      };
    },
  },
  {
    id: 'hackernews',
    name: 'Hacker News',
    category: 'Форумы',
    url: (user) => `https://news.ycombinator.com/user?id=${user}`,
    api: (user) => `https://hn.algolia.com/api/v1/search?tags=author_${encodeURIComponent(user)}&hitsPerPage=5`,
    confidence: 0.8,
    extract: (payload) => {
      const hits = (payload.hits as Array<Record<string, unknown>> | undefined) ?? [];
      return { postsSample: hits.length, firstSeen: hits.at(-1)?.created_at, lastSeen: hits[0]?.created_at, karma: hits[0]?.author_points };
    },
  },
  {
    id: 'npm',
    name: 'npm',
    category: 'Разработка',
    url: (user) => `https://www.npmjs.com/~${user}`,
    api: (user) => `https://registry.npmjs.org/-/user/org.couchdb.user:${encodeURIComponent(user)}`,
    confidence: 0.8,
    extract: (payload) => ({ name: payload.name, email: payload.email ? '[скрыт/подтверждён]' : undefined, created: payload.created, packages: undefined }),
  },
  {
    id: 'pypi',
    name: 'PyPI',
    category: 'Разработка',
    url: (user) => `https://pypi.org/user/${user}/`,
    api: (user) => `https://pypi.org/pypi/${encodeURIComponent(user)}/json`,
    confidence: 0.6,
    extract: (payload) => {
      const info = payload.info as Record<string, unknown> | undefined;
      return info ? { projectName: info.name, author: info.author, authorEmail: info.author_email, homePage: info.home_page, summary: info.summary } : {};
    },
  },
  {
    id: 'lichess',
    name: 'Lichess',
    category: 'Игры',
    url: (user) => `https://lichess.org/@/${user}`,
    api: (user) => `https://lichess.org/api/user/${encodeURIComponent(user)}`,
    confidence: 0.85,
    extract: (payload) => ({ username: payload.username, createdAt: payload.createdAt, seenAt: payload.seenAt, title: payload.title, patron: payload.patron, playTime: payload.playTime }),
  },
  {
    id: 'chesscom',
    name: 'Chess.com',
    category: 'Игры',
    url: (user) => `https://www.chess.com/member/${user}`,
    api: (user) => `https://api.chess.com/pub/player/${encodeURIComponent(user)}`,
    confidence: 0.85,
    extract: (payload) => ({ username: payload.username, name: payload.name, location: payload.location, country: payload.country, joined: payload.joined, followers: payload.followers, status: payload.status, avatarUrl: payload.avatar }),
  },
  {
    id: 'telegram',
    name: 'Telegram',
    category: 'Мессенджеры',
    url: (user) => `https://t.me/${user}`,
    confidence: 0.65,
  },
  {
    id: 'vk',
    name: 'VKontakte',
    category: 'Соцсети РФ',
    url: (user) => `https://vk.com/${user}`,
    confidence: 0.6,
  },
  {
    id: 'instagram',
    name: 'Instagram',
    category: 'Соцсети',
    url: (user) => `https://www.instagram.com/${user}/`,
    confidence: 0.55,
  },
  {
    id: 'x',
    name: 'X (Twitter)',
    category: 'Соцсети',
    url: (user) => `https://x.com/${user}`,
    confidence: 0.55,
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    category: 'Медиа',
    url: (user) => `https://www.tiktok.com/@${user}`,
    confidence: 0.55,
  },
  {
    id: 'youtube',
    name: 'YouTube',
    category: 'Медиа',
    url: (user) => `https://www.youtube.com/@${user}`,
    confidence: 0.6,
  },
  {
    id: 'twitch',
    name: 'Twitch',
    category: 'Медиа',
    url: (user) => `https://www.twitch.tv/${user}`,
    confidence: 0.6,
  },
  {
    id: 'steam',
    name: 'Steam Community',
    category: 'Игры',
    url: (user) => `https://steamcommunity.com/id/${user}`,
    confidence: 0.6,
  },
  {
    id: 'habr',
    name: 'Habr',
    category: 'IT РФ',
    url: (user) => `https://habr.com/ru/users/${user}/`,
    confidence: 0.6,
  },
  {
    id: 'pikabu',
    name: 'Pikabu',
    category: 'Соцсети РФ',
    url: (user) => `https://pikabu.ru/@${user}`,
    confidence: 0.55,
  },
  {
    id: 'medium',
    name: 'Medium',
    category: 'Блоги',
    url: (user) => `https://medium.com/@${user}`,
    confidence: 0.6,
  },
  {
    id: 'codeberg',
    name: 'Codeberg',
    category: 'Разработка',
    url: (user) => `https://codeberg.org/${user}`,
    api: (user) => `https://codeberg.org/api/v1/users/${encodeURIComponent(user)}`,
    confidence: 0.85,
    extract: (payload) => ({ login: payload.login, fullName: payload.full_name, email: payload.email, location: payload.location, followers: payload.followers_count, createdAt: payload.created, avatarUrl: payload.avatar_url }),
  },
  {
    id: 'dockerhub',
    name: 'Docker Hub',
    category: 'Разработка',
    url: (user) => `https://hub.docker.com/u/${user}`,
    api: (user) => `https://hub.docker.com/v2/users/${encodeURIComponent(user)}/`,
    confidence: 0.75,
    extract: (payload) => ({ username: payload.username, fullName: payload.full_name, location: payload.location, company: payload.company, joined: payload.date_joined, gravatarUrl: payload.gravatar_url }),
  },
  {
    id: 'mastodon-social',
    name: 'Mastodon (mastodon.social)',
    category: 'Соцсети',
    url: (user) => `https://mastodon.social/@${user}`,
    api: (user) => `https://mastodon.social/api/v1/accounts/lookup?acct=${encodeURIComponent(user)}`,
    confidence: 0.8,
    extract: (payload) => ({ id: payload.id, displayName: payload.display_name, note: payload.note, followers: payload.followers_count, following: payload.following_count, statuses: payload.statuses_count, createdAt: payload.created_at, avatarUrl: payload.avatar }),
  },
];

export interface FootprintHit {
  platform: PlatformSpec;
  url: string;
  exists: boolean;
  via: 'api' | 'probe';
  profile: Record<string, unknown>;
  confidence: number;
  error?: string;
}

/**
 * Verify a username across platforms. Bounded concurrency keeps us polite and
 * avoids triggering platform rate limits.
 */
export async function huntUsername(
  ctx: ModuleContext,
  username: string,
  platformIds: string[] = PLATFORMS.map((platform) => platform.id),
  concurrency = 5,
): Promise<FootprintHit[]> {
  const targets = PLATFORMS.filter((platform) => platformIds.includes(platform.id));
  const results = await pMap(
    targets,
    async (platform): Promise<FootprintHit> => {
      const url = platform.url(username);
      if (platform.api) {
        try {
          const payload = (await ctx.http.json<Record<string, unknown>>(platform.api(username), {
            timeoutMs: 10_000,
            cacheTtlMs: 10 * 60_000,
            signal: ctx.signal,
            allowErrorStatus: true,
          })) as Record<string, unknown>;
          const profile = platform.extract ? platform.extract(payload) : payload;
          const empty = Object.values(profile).every((value) => value === undefined || value === null);
          return { platform, url, exists: !empty, via: 'api', profile, confidence: (platform.confidence ?? 0.8) * (empty ? 0.3 : 1) };
        } catch (error) {
          return { platform, url, exists: false, via: 'api', profile: {}, confidence: 0.2, error: (error as Error).message.slice(0, 160) };
        }
      }

      try {
        const probe = await ctx.http.probe(url, { timeoutMs: 10_000, cacheTtlMs: 10 * 60_000, signal: ctx.signal, expect: 'html' });
        const exists = probe.reachable && !probe.markers?.softNotFound && probe.status < 400;
        return {
          platform,
          url,
          exists,
          via: 'probe',
          profile: { status: probe.status, containsUsername: probe.markers?.containsName, softNotFound: probe.markers?.softNotFound },
          confidence: exists ? (platform.confidence ?? 0.6) * 0.8 : 0.5,
          error: probe.error,
        };
      } catch (error) {
        return { platform, url, exists: false, via: 'probe', profile: {}, confidence: 0.2, error: (error as Error).message.slice(0, 160) };
      }
    },
    concurrency,
  );
  return results;
}

export const socialModule: OsintModule = {
  id: MODULE_ID,
  name: 'Кросс-платформенный поиск аккаунтов',
  category: 'social',
  description:
    'Проверяет никнейм на 23 платформах: там, где есть публичный API (GitHub, GitLab, Reddit, Bluesky, Keybase, HN, npm, PyPI, Lichess, Chess.com, Codeberg, Docker Hub, Mastodon) — забирает реальные поля профиля; где API нет — выполняет probe с детекцией soft-404. Аватары и юзернеймы становятся узлами графа для кластеризации личностей.',
  accepts: ['username', 'alias', 'social_profile', 'email'],
  produces: ['social_profile', 'image', 'username', 'location', 'email'],
  requiresNetwork: true,
  cost: 4,
  priority: 75,
  cacheTtlMs: 15 * 60_000,
  tags: ['social', 'footprint', 'account-discovery'],
  dataSources: PLATFORMS.filter((platform) => platform.api).map((platform) => `${platform.name} API`),
  async run(input: ModuleInput, ctx: ModuleContext): Promise<ModuleResult> {
    const out: ModuleResult = { evidence: [], entities: [], edges: [], riskFactors: [], pivots: [], notes: [] };

    let username = input.entity.value.replace(/^@/, '').trim();
    if (input.entity.type === 'email') {
      const parsed = parseEmail(input.entity.value);
      if (!parsed.isValid || !parsed.local) return { notes: ['E-mail некорректен — поиск аккаунтов невозможен'] };
      username = parsed.local;
      out.evidence?.push(
        evidence('social.local-part-pivot', `Локальная часть e-mail «${parsed.local}» используется как никнейм на платформах`, parsed.local, { name: 'Эвристика локальной части e-mail', kind: 'heuristic' }, { reliability: 0.6, tags: ['pivot'] }),
      );
    }
    if (!/^[A-Za-z0-9_.-]{3,40}$/.test(username)) return { notes: [`«${username}» не похоже на никнейм — поиск пропущен`] };

    const hits = await huntUsername(ctx, username);
    const found = hits.filter((hit) => hit.exists);
    const source = { name: 'Проверка аккаунтов на платформах (API + probe)', kind: 'api' as const };

    for (const hit of found) {
      const profileFacts = Object.fromEntries(Object.entries(hit.profile).filter(([, value]) => value !== undefined && value !== null && value !== ''));
      out.entities?.push(
        entity('social_profile', hit.url, {
          label: `${hit.platform.name} — @${username}`,
          tags: ['social', hit.platform.category, hit.via === 'api' ? 'api-verified' : 'probe-inferred'],
          confidence: hit.confidence,
          properties: { platform: hit.platform.id, username, ...profileFacts },
        }),
      );
      out.edges?.push(edge(input.entity.id, { type: 'social_profile', value: hit.url }, 'uses', hit.confidence, hit.confidence));
      out.evidence?.push(
        evidence(
          `social.${hit.platform.id}`,
          `Аккаунт на ${hit.platform.name}: ${hit.url}${Object.keys(profileFacts).length ? ` — данные профиля получены (${Object.keys(profileFacts).slice(0, 5).join(', ')})` : ''}`,
          { url: hit.url, via: hit.via, profile: profileFacts },
          { ...source, url: hit.url, kind: hit.via === 'api' ? 'api' : 'web' },
          { reliability: hit.confidence, tags: ['social', hit.platform.id] },
        ),
      );

      for (const [key, value] of Object.entries(profileFacts)) {
        if (typeof value !== 'string') continue;
        if (/^https?:\/\//.test(value) && /avatar|gravatar|icon/i.test(key)) {
          out.entities?.push(entity('image', value, { label: `Аватар ${hit.platform.name}`, tags: ['avatar', 'pivot'], confidence: 0.7, properties: { sourcePlatform: hit.platform.id } }));
          out.edges?.push(edge({ type: 'social_profile', value: hit.url }, { type: 'image', value }, 'uses', 0.7, 0.7));
          out.pivots?.push(pivot('image', value, { relation: 'uses', confidence: 0.6, reason: 'Аватар для сравнения перцептивных хэшей между платформами', from: input.entity.id }));
        }
        if (key === 'location' && value.length > 2) {
          out.entities?.push(entity('location', value, { label: value, tags: ['social-location'], confidence: 0.55 }));
          out.edges?.push(edge(input.entity.id, { type: 'location', value }, 'located_at', 0.4, 0.55));
          out.pivots?.push(pivot('location', value, { relation: 'located_at', confidence: 0.5, reason: 'Локация из профиля соцсети', from: input.entity.id }));
        }
        if (key === 'email' || /email/i.test(key)) {
          const email = value.toLowerCase();
          if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(email)) {
            out.entities?.push(entity('email', email, { label: email, tags: ['social-email'], confidence: 0.6 }));
            out.edges?.push(edge(input.entity.id, { type: 'email', value: email }, 'uses', 0.5, 0.6));
            out.pivots?.push(pivot('email', email, { relation: 'uses', confidence: 0.6, reason: 'E-mail раскрыт в профиле', from: input.entity.id }));
          }
        }
        if (key === 'twitterUsername' && value) {
          out.pivots?.push(pivot('username', value, { relation: 'same_as', confidence: 0.6, reason: 'Связанный Twitter/X-аккаунт из GitHub-профиля', from: input.entity.id }));
        }
      }

      // Companies named in dev profiles are strong employer signals.
      const company = profileFacts.company ?? profileFacts.company_name;
      if (typeof company === 'string' && company.length > 1) {
        const cleaned = company.replace(/^@/, '');
        out.entities?.push(entity('organization', cleaned, { label: cleaned, tags: ['employer-signal'], confidence: 0.6 }));
        out.edges?.push(edge(input.entity.id, { type: 'organization', value: cleaned }, 'employed_by', 0.5, 0.6));
        out.pivots?.push(pivot('organization', cleaned, { relation: 'employed_by', confidence: 0.55, reason: 'Организация указана в профиле разработчика', from: input.entity.id }));
      }
    }

    const errors = hits.filter((hit) => hit.error);
    out.evidence?.push(
      evidence(
        'social.footprint-summary',
        `Из ${hits.length} проверенных платформ подтверждено ${found.length}: ${found.map((hit) => hit.platform.name).join(', ') || '—'}`,
        { checked: hits.length, found: found.length, platforms: found.map((hit) => hit.platform.id), failed: errors.length },
        source,
        { reliability: 0.9, tags: ['summary'] },
      ),
    );

    if (found.length >= 4) {
      out.riskFactors?.push(risk('opsec.username-reuse', Math.min(0.85, 0.35 + found.length * 0.08), `Никнейм «${username}» подтверждён на ${found.length} платформах — единый цифровой след, легко связывающий аккаунты`, [], { tags: ['opsec'] }));
    }
    if (found.some((hit) => hit.platform.id === 'github' || hit.platform.id === 'gitlab')) {
      out.riskFactors?.push(risk('identity.full-profile-triangulated', 0.4, 'Публичные репозитории содержат commit-метаданные (e-mail, таймзона, стиль кода) — сильный источник атрибуции', []));
    }

    if (errors.length) out.notes?.push(`Не удалось проверить ${errors.length} платформ (CORS/лимиты): ${errors.slice(0, 3).map((hit) => hit.platform.name).join(', ')}`);

    out.metrics = { platformsChecked: hits.length, accountsFound: found.length, apiVerified: found.filter((hit) => hit.via === 'api').length };
    return out;
  },
};

export const socialModules = [socialModule];
