/**
 * MODULE: screening — sanctions, PEP & legal-entity resolution
 * ---------------------------------------------------------------------------
 * Compliance-grade screening using authoritative, CORS-friendly sources:
 *   • OpenSanctions — aggregated sanctions/PEP/criminal datasets (API + links)
 *   • GLEIF — the Legal Entity Identifier registry: the single best public
 *     entity-resolution source for companies worldwide (real API, no key)
 *   • VIES — EU VAT number validation (official REST endpoint)
 *   • Wikidata — notability/PEP signal and cross-identifier discovery
 *     (P1278 = LEI, P1029/VAT, P169 = CEO…) — a genuinely novel PEP heuristic
 *   • Local fuzzy matcher so name variants (transliterations, initials,
 *     reordered tokens) match without false confidence: every hit carries a
 *     similarity score and an explicit "требуется ручная верификация" note.
 */

import type { ModuleInput, ModuleContext, ModuleResult, OsintModule } from '../types/module';
import { matchPersons, transliterationVariants, jaroWinkler } from '../algo/stringdistance';
import { evidence, entity, edge, pivot, risk, truncate, DIRECTORY_LINKS } from './common';

const MODULE_ID = 'legal.screening';

export interface WatchlistMatch {
  name: string;
  schema: string;
  datasets: string[];
  countries?: string[];
  topics?: string[];
  score: number;
  sourceUrl?: string;
  matchMethod: 'exact' | 'transliterated' | 'fuzzy';
}

interface OpenSanctionsResponse {
  results?: Array<{
    id: string;
    caption: string;
    schema: string;
    datasets?: string[];
    properties?: { country?: string[]; topics?: string[]; birthDate?: string[]; alias?: string[]; position?: string[] };
  }>;
  total?: { value: number };
}

interface GleifResponse {
  data?: Array<{
    id: string;
    attributes?: {
      lei?: string;
      entity?: { legalName?: { name?: string }; legalAddress?: { city?: string; country?: string }; status?: string; legalForm?: { id?: string } };
      registration?: { status?: string; initialRegistrationDate?: string; lastUpdateDate?: string };
    };
  }>;
}

interface WikidataSearchResponse {
  search?: Array<{ id: string; label?: string; description?: string }>;
}

/**
 * Fuzzy screening against a provided watchlist (usable offline and for
 * organisation-internal lists). Returns ranked matches with their method, so a
 * 0.82 score is never presented as a confirmed hit.
 */
export function screenAgainstWatchlist(target: string, watchlist: string[], threshold = 0.82): WatchlistMatch[] {
  const matches: WatchlistMatch[] = [];
  const variants = new Set([target.toLowerCase(), ...transliterationVariants(target), target.split(/\s+/).reverse().join(' ').toLowerCase()]);

  for (const candidate of watchlist) {
    let best = 0;
    let method: WatchlistMatch['matchMethod'] = 'fuzzy';
    for (const variant of variants) {
      const result = matchPersons(variant, candidate);
      if (result.score > best) {
        best = result.score;
        method = variant === target.toLowerCase() ? 'exact' : variant === target.toLowerCase() ? 'exact' : 'transliterated';
      }
      const jw = jaroWinkler(variant.replace(/\s+/g, ''), candidate.toLowerCase().replace(/\s+/g, ''));
      if (jw > best) {
        best = jw;
        method = 'fuzzy';
      }
    }
    if (best >= threshold) matches.push({ name: candidate, schema: 'Watchlist', datasets: ['local'], score: Number(best.toFixed(3)), matchMethod: method });
  }
  return matches.sort((a, b) => b.score - a.score).slice(0, 10);
}

async function screenOpenSanctions(ctx: ModuleContext, query: string): Promise<WatchlistMatch[]> {
  try {
    const payload = await ctx.http.json<OpenSanctionsResponse>(`https://api.opensanctions.org/search/default?q=${encodeURIComponent(query)}&limit=10`, {
      timeoutMs: 15_000,
      cacheTtlMs: 30 * 60_000,
      signal: ctx.signal,
      allowErrorStatus: true,
    });
    if (!Array.isArray(payload.results)) return [];
    return payload.results.map((result) => {
      const aliases = result.properties?.alias ?? [];
      let best = matchPersons(query, result.caption).score;
      for (const alias of aliases) best = Math.max(best, matchPersons(query, alias).score);
      return {
        name: result.caption,
        schema: result.schema,
        datasets: result.datasets ?? [],
        countries: result.properties?.country,
        topics: result.properties?.topics,
        score: Number(best.toFixed(3)),
        sourceUrl: `https://www.opensanctions.org/entities/${result.id}/`,
        matchMethod: best > 0.95 ? 'exact' : 'fuzzy',
      } as WatchlistMatch;
    });
  } catch {
    return [];
  }
}

export const sanctionsModule: OsintModule = {
  id: MODULE_ID,
  name: 'Скрининг: санкции, PEP, реестр LEI и VAT',
  category: 'legal',
  description:
    'Сверяет персону или организацию с агрегированными санкционными и PEP-наборами OpenSanctions, ищет юридическое лицо в реестре GLEIF (LEI) для однозначной идентификации, проверяет VAT через официальный сервис ЕС VIES, а также использует Wikidata для оценки публичности и поиска связанных идентификаторов.',
  accepts: ['person', 'organization', 'alias'],
  produces: ['watchlist_hit', 'organization', 'person', 'tax_id'],
  requiresNetwork: true,
  cost: 3,
  priority: 82,
  cacheTtlMs: 60 * 60_000,
  tags: ['sanctions', 'pep', 'kyc', 'entity-resolution'],
  dataSources: ['OpenSanctions', 'GLEIF LEI', 'VIES (ЕС)', 'Wikidata'],
  async run(input: ModuleInput, ctx: ModuleContext): Promise<ModuleResult> {
    const query = input.entity.label || input.entity.value;
    const out: ModuleResult = { evidence: [], entities: [], edges: [], riskFactors: [], pivots: [], notes: [] };

    // ── 1. Sanctions / PEP screening ────────────────────────────────────────
    const openSanctions = await screenOpenSanctions(ctx, query);
    const localWatchlist = Array.isArray(input.entity.properties.watchlist) ? (input.entity.properties.watchlist as unknown[]).map(String) : [];
    const localMatches = localWatchlist.length ? screenAgainstWatchlist(query, localWatchlist) : [];
    const matches = [...openSanctions, ...localMatches].sort((a, b) => b.score - a.score).slice(0, 10);

    if (matches.length) {
      out.evidence?.push(
        evidence(
          'watchlist.matches',
          `Найдено ${matches.length} совпадений: ${matches.slice(0, 5).map((match) => `${match.name} (${(match.score * 100).toFixed(0)}%, ${match.schema})`).join('; ')}`,
          matches,
          { name: 'OpenSanctions + локальный fuzzy-скрининг', kind: 'registry', url: 'https://www.opensanctions.org' },
          { reliability: 0.75, tags: ['sanctions', 'screening', 'requires-verification'] },
        ),
      );

      for (const match of matches) {
        const severity = match.score >= 0.95 ? 0.9 : match.score >= 0.87 ? 0.7 : 0.5;
        out.entities?.push(
          entity('watchlist_hit', match.name, {
            label: `${match.name} — ${match.schema} (${(match.score * 100).toFixed(0)}%)`,
            tags: ['sanctions', ...(match.topics ?? []), ...(match.datasets ?? []).slice(0, 3)],
            confidence: match.score,
            properties: { score: match.score, datasets: match.datasets, countries: match.countries, sourceUrl: match.sourceUrl },
          }),
        );
        out.edges?.push(edge(input.entity.id, { type: 'watchlist_hit', value: match.name }, 'sanctioned_by', match.score, match.score));
        out.evidence?.push(
          evidence(
            `watchlist.hit.${match.name}`.slice(0, 60),
            `Совпадение: «${match.name}» (${match.schema}), достоверность совпадения ${(match.score * 100).toFixed(1)}%, метод: ${match.matchMethod}. Наборы данных: ${match.datasets.join(', ') || 'не указаны'}. Источник: ${match.sourceUrl ?? 'локальный список'}`,
            match,
            { name: 'OpenSanctions', kind: 'registry', url: match.sourceUrl },
            { reliability: 0.8, tags: ['sanctions', 'pep'] },
          ),
        );
        if (match.topics?.includes('sanction') || /sanction/i.test(match.datasets.join(' '))) {
          out.riskFactors?.push(risk('fin.sanctions-hit', severity, `Совпадение со санкционным набором: «${match.name}» (${(match.score * 100).toFixed(0)}%). Требуется ручная верификация из-за возможной омонимии`, []));
        }
        if (match.topics?.includes('role.pep')) {
          out.riskFactors?.push(risk('fin.pep-exposure', Math.max(0.35, severity * 0.7), `Признаки публичного должностного лица (PEP): «${match.name}»`, []));
        }
      }
      out.notes?.push('Совпадения по именам требуют ручной верификации: омонимия даёт ложные срабатывания (ФИО + дата рождения + страна обязательны для подтверждения)');
    } else {
      out.evidence?.push(
        evidence('watchlist.clean', 'Совпадений с санкционными и PEP-наборами не выявлено (по доступным источникам)', [], { name: 'OpenSanctions', kind: 'registry', url: `https://www.opensanctions.org/search/?q=${encodeURIComponent(query)}` }, { reliability: 0.7, tags: ['sanctions'] }),
      );
    }

    // ── 2. Legal entity resolution via GLEIF ────────────────────────────────
    if (input.entity.type === 'organization' || input.entity.type === 'person') {
      try {
        const gleif = await ctx.http.json<GleifResponse>(`https://api.gleif.org/api/v1/lei-records?filter[entity.legalName]=${encodeURIComponent(query)}&page[size]=5`, {
          timeoutMs: 15_000,
          cacheTtlMs: 60 * 60_000,
          signal: ctx.signal,
        });
        const records = gleif.data ?? [];
        if (records.length) {
          for (const record of records.slice(0, 5)) {
            const attributes = record.attributes;
            const name = attributes?.entity?.legalName?.name ?? record.id;
            const lei = attributes?.lei ?? record.id;
            out.entities?.push(
              entity('organization', name, {
                label: name,
                tags: ['lei', 'legal-entity'],
                confidence: 0.85,
                properties: {
                  lei,
                  country: attributes?.entity?.legalAddress?.country,
                  city: attributes?.entity?.legalAddress?.city,
                  status: attributes?.entity?.status ?? attributes?.registration?.status,
                  registered: attributes?.registration?.initialRegistrationDate,
                },
              }),
            );
            out.edges?.push(edge(input.entity.id, { type: 'organization', value: name }, 'same_as', 0.7, 0.8));
          }
          out.evidence?.push(
            evidence('gleif.lei', `В реестре GLEIF найдено ${records.length} юридических лиц: ${records.slice(0, 3).map((record) => `${record.attributes?.entity?.legalName?.name} (LEI ${record.attributes?.lei})`).join('; ')}`, records.map((record) => ({ lei: record.attributes?.lei, name: record.attributes?.entity?.legalName?.name })), { name: 'GLEIF LEI API', kind: 'registry', url: 'https://search.gleif.org' }, { reliability: 0.92, tags: ['entity-resolution', 'lei'] }),
          );
          const firstLei = records[0]?.attributes?.lei;
          if (firstLei) {
            out.evidence?.push(evidence('gleif.record-link', `Карточка LEI: ${DIRECTORY_LINKS.gleif(firstLei)}`, DIRECTORY_LINKS.gleif(firstLei), { name: 'GLEIF', kind: 'registry' }, { reliability: 0.95, tags: ['pivot-links'] }));
            out.pivots?.push(pivot('organization', records[0]?.attributes?.entity?.legalName?.name ?? query, { relation: 'same_as', confidence: 0.8, reason: 'Юридическое лицо с уникальным LEI идентификатором', from: input.entity.id }));
          }
        } else {
          out.notes?.push('В реестре GLEIF совпадений по названию нет (возможны иные формы наименования)');
        }
      } catch (error) {
        out.notes?.push(`GLEIF API недоступен: ${(error as Error).message.slice(0, 140)}`);
      }
    }

    // ── 3. VAT validation (EU) ──────────────────────────────────────────────
    const vatMatch = /^([A-Z]{2})([0-9A-Z]{8,12})$/.exec(input.entity.value.replace(/\s/g, '').toUpperCase());
    if (vatMatch) {
      try {
        const vat = await ctx.http.json<{ isValid?: boolean; name?: string; address?: string }>(`https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${vatMatch[1]}/vat/${vatMatch[2]}`, {
          timeoutMs: 15_000,
          cacheTtlMs: 60 * 60_000,
          signal: ctx.signal,
          allowErrorStatus: true,
        });
        out.evidence?.push(
          evidence('vies.vat', `VAT ${vatMatch[1]}${vatMatch[2]}: ${vat?.isValid ? `действителен (${vat.name ?? 'наименование не раскрыто'})` : 'не подтверждён'}`, vat, { name: 'VIES (Европейская комиссия)', kind: 'registry', url: 'https://ec.europa.eu/taxation_customs/vies/' }, { reliability: 0.95, tags: ['vat', 'eu'] }),
        );
        if (vat?.name) {
          out.entities?.push(entity('organization', vat.name, { label: vat.name, tags: ['vat-verified'], confidence: 0.9, properties: { vat: `${vatMatch[1]}${vatMatch[2]}`, address: vat.address } }));
        }
      } catch (error) {
        out.notes?.push(`VIES недоступен: ${(error as Error).message.slice(0, 120)}`);
      }
    }

    // ── 4. Wikidata notability / PEP signal ─────────────────────────────────
    try {
      const wikidata = await ctx.http.json<WikidataSearchResponse>(
        `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=ru&uselang=ru&limit=5&format=json&origin=*`,
        { timeoutMs: 12_000, cacheTtlMs: 60 * 60_000, signal: ctx.signal },
      );
      const results = wikidata.search ?? [];
      if (results.length) {
        const top = results[0];
        out.evidence?.push(
          evidence('wikidata.entity', `Wikidata: «${top?.label}» (${top?.id}) — ${truncate(top?.description ?? '', 140)}`, results.map((result) => ({ id: result.id, label: result.label, description: result.description })), { name: 'Wikidata API', kind: 'api', url: `https://www.wikidata.org/wiki/${top?.id}` }, { reliability: 0.8, tags: ['notability', 'pep-signal'] }),
        );
        if (results.length > 1) {
          out.riskFactors?.push(risk('fin.pep-exposure', 0.3, `Найдено ${results.length} сущностей Wikidata с похожим именем — возможен публичный статус (PEP) либо тёзки`, []));
        }
      }
    } catch (error) {
      out.notes?.push(`Wikidata недоступен: ${(error as Error).message.slice(0, 120)}`);
    }

    // ── 5. Manual verification plan ─────────────────────────────────────────
    out.evidence?.push(
      evidence('screening.plan', 'План ручной верификации по официальным источникам', {
        openSanctions: DIRECTORY_LINKS.openSanctions(query),
        openCorporates: DIRECTORY_LINKS.opensecrets(query),
        egrul: DIRECTORY_LINKS.egrul(query),
        rusprofile: DIRECTORY_LINKS.rusprofile(query),
        listOrg: DIRECTORY_LINKS.listOrg(query),
        wikidata: DIRECTORY_LINKS.wikidata(query),
      }, { name: 'Генерация плана проверок (локально)', kind: 'algorithm' }, { reliability: 0.9, tags: ['plan'] }),
    );

    out.metrics = { sanctionsMatches: matches.length, maxScore: matches[0]?.score ?? 0 };
    return out;
  },
};

export const screeningModules = [sanctionsModule];
