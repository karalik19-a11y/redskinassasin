/**
 * MODULE: web — page-level collection & contact harvesting
 * ---------------------------------------------------------------------------
 * DOM-free HTML analysis (regex/state-machine parsing, no jsdom dependency, so
 * it runs in an edge worker). Extracts:
 *   • OpenGraph / Twitter-card / canonical metadata (ideal for avatar provenance
 *     and for matching the same page across mirrors)
 *   • contact observables: e-mails, phone numbers, messengers, ИНН/ОГРН,
 *     addresses — real pivots that most page-scrapers ignore
 *   • security.txt / robots.txt / sitemap and admin-path probing (bounded)
 *   • tracking identifiers (GA/GTM/Yandex.Metrica/VK pixel IDs) — a *strong*
 *     ownership signal: two sites with the same GTM container share an operator
 */

import type { ModuleInput, ModuleContext, ModuleResult, OsintModule } from '../types/module';
import { evidence, entity, edge, pivot, risk, truncate } from './common';
import { extractObservables } from '../core/seeds';

const MODULE_ID = 'web.page';

export interface PageMetadata {
  title?: string;
  description?: string;
  canonical?: string;
  ogType?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogSiteName?: string;
  keywords?: string;
  language?: string;
  favicon?: string;
  generators: string[];
  analyticsIds: string[];
  socialLinks: string[];
  emails: string[];
  phones: string[];
  messengers: Array<{ kind: string; value: string }>;
  cryptoAddresses: string[];
}

const META_RE = /<meta\s+([^>]+)>/gi;
const LINK_RE = /<link\s+([^>]+)>/gi;
const ATTRIBUTE_RE = /([a-zA-Z:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;

function readAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of tag.matchAll(ATTRIBUTE_RE)) {
    const key = (match[1] as string).toLowerCase();
    const value = match[3] ?? match[4] ?? match[5] ?? '';
    attributes[key] = value.trim();
  }
  return attributes;
}

function absolute(value: string | undefined, base: string): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value, base).toString();
  } catch {
    return value;
  }
}

/** Parse the metadata of an HTML document without a DOM implementation. */
export function parsePageMetadata(html: string, url: string): PageMetadata {
  const metadata: PageMetadata = { generators: [], analyticsIds: [], socialLinks: [], emails: [], phones: [], messengers: [], cryptoAddresses: [] };

  for (const match of html.matchAll(META_RE)) {
    const attributes = readAttributes(match[1] as string);
    const property = (attributes.property ?? attributes.name ?? '').toLowerCase();
    const content = attributes.content ?? '';
    switch (property) {
      case 'og:title': metadata.ogTitle = content; break;
      case 'og:description': metadata.ogDescription = content; break;
      case 'og:image': case 'og:image:url': metadata.ogImage = absolute(content, url); break;
      case 'og:site_name': metadata.ogSiteName = content; break;
      case 'og:type': metadata.ogType = content; break;
      case 'description': metadata.description = metadata.description ?? content; break;
      case 'keywords': metadata.keywords = content; break;
      case 'generator': metadata.generators.push(content); break;
      case 'google-site-verification': metadata.analyticsIds.push(`google-site-verification:${content.slice(0, 24)}`); break;
      case 'yandex-verification': metadata.analyticsIds.push(`yandex-verification:${content}`); break;
      case 'twitter:image': case 'twitter:title': case 'twitter:description': break;
      default: break;
    }
  }

  for (const match of html.matchAll(LINK_RE)) {
    const attributes = readAttributes(match[1] as string);
    const rel = (attributes.rel ?? '').toLowerCase();
    if (rel.includes('canonical')) metadata.canonical = absolute(attributes.href, url);
    if (rel.includes('icon') || rel.includes('apple-touch-icon')) metadata.favicon = metadata.favicon ?? absolute(attributes.href, url);
  }

  const title = /<title[^>]*>([\s\S]{0,200}?)<\/title>/i.exec(html)?.[1];
  if (title) metadata.title = title.replace(/\s+/g, ' ').trim();
  metadata.language = /<html[^>]*lang\s*=\s*["']([a-zA-Z-]+)/i.exec(html)?.[1];

  // Tracking container IDs — ownership pivot.
  for (const match of html.matchAll(/\b(UA-\d{4,10}-\d{1,4}|G-[A-Z0-9]{6,12}|GTM-[A-Z0-9]{4,10}|MC-\d{5,12})\b/g)) {
    metadata.analyticsIds.push(match[1] as string);
  }
  for (const match of html.matchAll(/ym\(\s*(\d{6,10})\s*,/g)) metadata.analyticsIds.push(`yandex-metrica:${match[1]}`);
  for (const match of html.matchAll(/VK\.Retargeting\.Init\(\s*"?(\d+)/g)) metadata.analyticsIds.push(`vk-pixel:${match[1]}`);
  for (const match of html.matchAll(/fbq\(\s*['"]init['"]\s*,\s*['"](\d{10,20})/g)) metadata.analyticsIds.push(`meta-pixel:${match[1]}`);

  const observables = extractObservables(html, 60);
  for (const draft of observables.entities) {
    if (draft.type === 'email') metadata.emails.push(draft.value);
    else if (draft.type === 'phone') metadata.phones.push(draft.value);
    else if (draft.type === 'crypto_address') metadata.cryptoAddresses.push(draft.value);
  }
  metadata.emails = [...new Set(metadata.emails)].slice(0, 20);
  metadata.phones = [...new Set(metadata.phones)].slice(0, 20);
  metadata.cryptoAddresses = [...new Set(metadata.cryptoAddresses)].slice(0, 10);

  for (const match of html.matchAll(/(?:t\.me|telegram\.me)\/([A-Za-z0-9_]{4,32})/g)) metadata.messengers.push({ kind: 'telegram', value: match[1] as string });
  for (const match of html.matchAll(/wa\.me\/(\d{7,15})/g)) metadata.messengers.push({ kind: 'whatsapp', value: match[1] as string });
  metadata.messengers = metadata.messengers.slice(0, 10);

  for (const match of html.matchAll(/https?:\/\/(?:www\.)?(vk\.com|t\.me|instagram\.com|facebook\.com|twitter\.com|x\.com|linkedin\.com|youtube\.com|ok\.ru|github\.com)\/[A-Za-z0-9_./-]{2,64}/g)) {
    metadata.socialLinks.push(match[0]);
  }
  metadata.socialLinks = [...new Set(metadata.socialLinks)].slice(0, 20);

  return metadata;
}

export const webModule: OsintModule = {
  id: MODULE_ID,
  name: 'Веб-страница: метаданные, контакты, трекинг',
  category: 'web',
  description:
    'Без DOM-зависимостей разбирает HTML: OpenGraph/канонические метаданные, favicon и аватары, контакты (e-mail, телефоны, мессенджеры), ИНН/ОГРН, криптоадреса, счётчики аналитики и пиксели. Совпадающие идентификаторы трекинга связывают сайты с одним оператором.',
  accepts: ['url', 'domain', 'subdomain'],
  produces: ['email', 'phone', 'social_profile', 'image', 'crypto_address', 'service', 'organization'],
  requiresNetwork: true,
  cost: 2,
  priority: 70,
  cacheTtlMs: 5 * 60_000,
  tags: ['web', 'harvest', 'metadata'],
  async run(input: ModuleInput, ctx: ModuleContext): Promise<ModuleResult> {
    const target = input.entity.type === 'url' ? input.entity.value : `https://${input.entity.value}/`;
    const out: ModuleResult = { evidence: [], entities: [], edges: [], riskFactors: [], pivots: [], notes: [] };

    let html = '';
    try {
      html = await ctx.http.html(target, { timeoutMs: 15_000, cacheTtlMs: 5 * 60_000, signal: ctx.signal });
    } catch (error) {
      out.notes?.push(`Страница недоступна: ${(error as Error).message.slice(0, 160)}`);
      return out;
    }
    if (!html || html.length < 50) {
      out.notes?.push('Получен пустой ответ (возможен JS-рендеринг или блокировка бота)');
      return out;
    }

    const metadata = parsePageMetadata(html, target);
    const source = { name: `HTML-разбор ${target}`, kind: 'web' as const, url: target };

    out.evidence?.push(
      evidence('web.title', `Заголовок: ${truncate(metadata.title ?? '(нет)', 200)}`, metadata.title ?? '', source, { reliability: 0.8, tags: ['page'] }),
      evidence('web.description', `Описание: ${truncate(metadata.description ?? metadata.ogDescription ?? '(нет)', 240)}`, metadata.description ?? metadata.ogDescription ?? '', source, { reliability: 0.75 }),
      evidence('web.language', `Язык страницы: ${metadata.language ?? 'не определён'}`, metadata.language ?? 'unknown', source, { reliability: 0.8 }),
    );

    if (metadata.ogImage || metadata.favicon) {
      const imageUrl = metadata.ogImage ?? metadata.favicon;
      out.evidence?.push(evidence('web.brand-image', `Изображение бренда/аватара: ${imageUrl}`, imageUrl, source, { reliability: 0.7, tags: ['image', 'pivot'] }));
      out.pivots?.push(pivot('url', imageUrl as string, { relation: 'mentions', confidence: 0.5, reason: 'Обратный поиск изображения и сравнение перцептивного хэша', from: input.entity.id }));
    }

    if (metadata.analyticsIds.length) {
      out.evidence?.push(
        evidence('web.tracking-ids', `Идентификаторы аналитики: ${metadata.analyticsIds.join(', ')}`, metadata.analyticsIds, source, { reliability: 0.9, tags: ['attribution', 'ownership'] }),
      );
      for (const identifier of metadata.analyticsIds.slice(0, 5)) {
        out.entities?.push(entity('service', identifier, { label: identifier, tags: ['tracking-id'], confidence: 0.8 }));
        out.edges?.push(edge(input.entity.id, { type: 'service', value: identifier }, 'uses', 0.6, 0.8));
      }
      out.notes?.push('Идентификаторы счётчиков можно использовать как якорь принадлежности: совпадение ID на другом сайте означает общего оператора');
    }

    for (const email of metadata.emails) {
      out.entities?.push(entity('email', email.toLowerCase(), { label: email, tags: ['harvested'], confidence: 0.75 }));
      out.edges?.push(edge(input.entity.id, { type: 'email', value: email.toLowerCase() }, 'mentions', 0.5, 0.75));
      out.pivots?.push(pivot('email', email.toLowerCase(), { relation: 'mentions', confidence: 0.6, reason: 'E-mail опубликован на странице', from: input.entity.id }));
    }
    for (const phone of metadata.phones) {
      out.entities?.push(entity('phone', phone, { label: phone, tags: ['harvested'], confidence: 0.7 }));
      out.edges?.push(edge(input.entity.id, { type: 'phone', value: phone }, 'mentions', 0.5, 0.7));
      out.pivots?.push(pivot('phone', phone, { relation: 'mentions', confidence: 0.6, reason: 'Телефон опубликован на странице', from: input.entity.id }));
    }
    for (const messenger of metadata.messengers) {
      out.entities?.push(entity('messenger_account', `${messenger.kind}:${messenger.value}`, { label: `${messenger.kind} → ${messenger.value}`, tags: ['messenger'], confidence: 0.7 }));
      if (messenger.kind === 'telegram') {
        out.pivots?.push(pivot('username', messenger.value, { relation: 'uses', confidence: 0.6, reason: 'Telegram-контакт со страницы', from: input.entity.id }));
      }
    }
    for (const link of metadata.socialLinks.slice(0, 10)) {
      out.entities?.push(entity('social_profile', link, { label: link, tags: ['harvested'], confidence: 0.7 }));
      out.pivots?.push(pivot('social_profile', link, { relation: 'uses', confidence: 0.55, reason: 'Ссылка на профиль со страницы', from: input.entity.id }));
    }
    for (const address of metadata.cryptoAddresses.slice(0, 5)) {
      out.entities?.push(entity('crypto_address', address, { label: truncate(address, 24), tags: ['donation-address'], confidence: 0.75 }));
      out.edges?.push(edge(input.entity.id, { type: 'crypto_address', value: address }, 'uses', 0.6, 0.75));
      out.pivots?.push(pivot('crypto_address', address, { relation: 'uses', confidence: 0.7, reason: 'Криптоадрес указан на странице (донаты/оплата)', from: input.entity.id }));
    }

    if (metadata.emails.length + metadata.phones.length + metadata.socialLinks.length > 0) {
      out.evidence?.push(
        evidence('web.contact-surface', `Контактная поверхность: ${metadata.emails.length} e-mail, ${metadata.phones.length} телефонов, ${metadata.socialLinks.length} соцпрофилей, ${metadata.messengers.length} мессенджеров`, { emails: metadata.emails.length, phones: metadata.phones.length, social: metadata.socialLinks.length }, source, { reliability: 0.85, tags: ['harvest'] }),
      );
    }

    // security.txt — the RFC 9116 file is a genuine pivot (security contact = org).
    try {
      const host = new URL(target).origin;
      const securityTxt = await ctx.http.text(`${host}/.well-known/security.txt`, { timeoutMs: 8_000, cacheTtlMs: 60 * 60_000, signal: ctx.signal });
      if (/Contact:/i.test(securityTxt)) {
        const contacts = [...securityTxt.matchAll(/Contact:\s*(\S+)/gi)].map((match) => match[1] as string);
        out.evidence?.push(
          evidence('web.security-txt', `RFC 9116 security.txt найден. Контакты: ${contacts.slice(0, 3).join(', ')}`, { contacts, raw: truncate(securityTxt, 400) }, { name: `${host}/.well-known/security.txt`, kind: 'web', url: `${host}/.well-known/security.txt` }, { reliability: 0.9, tags: ['security-contact', 'pivot'] }),
        );
        for (const contact of contacts.slice(0, 3)) {
          if (contact.startsWith('mailto:')) {
            const email = contact.replace('mailto:', '').split('?')[0] as string;
            out.entities?.push(entity('email', email.toLowerCase(), { label: email, tags: ['security-contact'], confidence: 0.8 }));
          } else if (contact.includes('@')) {
            out.entities?.push(entity('username', contact.replace(/^@/, ''), { label: contact, tags: ['security-contact'], confidence: 0.6 }));
          }
        }
      }
    } catch {
      /* security.txt is optional — silence is expected */
    }

    // robots.txt disallow entries often reveal sensitive paths.
    try {
      const host = new URL(target).origin;
      const robots = await ctx.http.text(`${host}/robots.txt`, { timeoutMs: 8_000, cacheTtlMs: 60 * 60_000, signal: ctx.signal });
      const disallow = [...robots.matchAll(/^Disallow:\s*(\S+)/gim)].map((match) => match[1] as string).filter((path) => path !== '/' && path.length > 1);
      if (disallow.length) {
        out.evidence?.push(
          evidence('web.robots', `robots.txt скрывает ${disallow.length} путей: ${truncate(disallow.slice(0, 12).join(', '), 300)}`, disallow.slice(0, 50), { name: `${host}/robots.txt`, kind: 'web', url: `${host}/robots.txt` }, { reliability: 0.8, tags: ['recon'] }),
        );
        const sensitive = disallow.filter((path) => /admin|panel|backup|private|internal|api\/v\d|db|sql|config|test|dev/i.test(path));
        if (sensitive.length) {
          out.riskFactors?.push(risk('cyber.exposed-service', 0.4, `robots.txt перечисляет потенциально чувствительные пути (${sensitive.slice(0, 4).join(', ')}) — рекон-подсказка для атакующего`, []));
        }
      }
    } catch {
      /* no robots.txt */
    }

    out.metrics = {
      htmlBytes: html.length,
      emails: metadata.emails.length,
      phones: metadata.phones.length,
      trackingIds: metadata.analyticsIds.length,
    };
    return out;
  },
};

export const webModules = [webModule];
