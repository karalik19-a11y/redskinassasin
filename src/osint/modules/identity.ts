/**
 * MODULE: identity — person analysis, alias generation & cross-source verification
 * ---------------------------------------------------------------------------
 * Works entirely offline and turns a name into an investigation surface:
 *   • structural decomposition (фамилия / имя / отчество, пол по отчеству)
 *   • transliteration variants (ICAO, GOST, practical) — the key that unlocks
 *     English-language sources from a Cyrillic input
 *   • username candidates derived from real naming conventions
 *   • cross-source verification: if an e-mail/username/profile is already in the
 *     graph, similarity is computed and the *match* becomes evidence, so a
 *     profile is only linked to a person when it actually looks like them
 *   • registry query plans (ЕГРЮЛ, ФССП, кад.арбитр, Росреестр, соцсети)
 */

import type { ModuleInput, ModuleContext, ModuleResult, OsintModule } from '../types/module';
import { matchPersons, transliterationVariants, parseFullName, skeletonize, isMixedScript, transliterate } from '../algo/stringdistance';
import { normalizeUsername } from '../algo/normalize';
import { evidence, entity, edge, pivot, risk, DIRECTORY_LINKS } from './common';

const MODULE_ID = 'identity.person';

/** Username conventions observed across RU/EU platforms. */
export function usernameCandidates(parts: { last?: string; first?: string; middle?: string }): string[] {
  const last = skeletonize(transliterate(parts.last ?? '', 'icao'));
  const first = skeletonize(transliterate(parts.first ?? '', 'icao'));
  const middle = skeletonize(transliterate(parts.middle ?? '', 'icao'));
  const candidates = new Set<string>();
  const add = (value: string): void => {
    if (value.length >= 4 && value.length <= 30) candidates.add(value);
  };

  if (last && first) {
    add(`${first}.${last}`);
    add(`${first}_${last}`);
    add(`${first}${last}`);
    add(`${first[0]}${last}`);
    add(`${first[0]}.${last}`);
    add(`${last}.${first[0]}`);
    add(`${last}${first[0]}`);
    add(`${last}_${first[0]}`);
  }
  if (last && middle) {
    add(`${last}${middle[0]}`);
    add(`${last}.${middle[0]}`);
  }
  if (last) add(last);
  return [...candidates].slice(0, 24);
}

export const identityModule: OsintModule = {
  id: MODULE_ID,
  name: 'Анализ личности и кросс-верификация',
  category: 'identity',
  description:
    'Декомпозиция ФИО, определение пола по отчеству, генерация транслитераций и вариантов написания, вывод никнеймов по реальным конвенциям, верификация соответствия уже найденных аккаунтов и профилей указанному ФИО, план запросов в реестры.',
  accepts: ['person', 'alias'],
  produces: ['alias', 'username', 'social_profile', 'location', 'organization'],
  requiresNetwork: false,
  cost: 0.3,
  priority: 90,
  tags: ['identity', 'offline', 'naming'],
  run(input: ModuleInput, _ctx: ModuleContext): ModuleResult {
    const label = input.entity.label || input.entity.value;
    const parts = parseFullName(label);
    const source = { name: 'Анализ структуры ФИО (локально)', kind: 'algorithm' as const };
    const out: ModuleResult = { evidence: [], edges: [], riskFactors: [], pivots: [], notes: [] };

    // ── Structure ────────────────────────────────────────────────────────────
    out.evidence?.push(
      evidence('person.last-name', `Фамилия: ${parts.last ?? 'не определена'}`, parts.last ?? '', source, { reliability: 0.85 }),
      evidence('person.first-name', `Имя: ${parts.first ?? 'не определено'}`, parts.first ?? '', source, { reliability: 0.85 }),
      evidence('person.gender', `Пол (по отчеству): ${parts.gender === 'male' ? 'мужской' : parts.gender === 'female' ? 'женский' : 'не определён'}`, parts.gender ?? 'unknown', source, { reliability: parts.middle ? 0.92 : 0.5, tags: ['heuristic'] }),
    );
    if (parts.middle) {
      out.evidence?.push(evidence('person.patronymic', `Отчество: ${parts.middle} — позволяет вычислить вероятный год рождения родителей и подтверждает пол`, parts.middle, source, { reliability: 0.8 }));
    } else {
      out.notes?.push('Отчество не указано: точность дедупликации персон по ФИО снижена');
    }

    // ── Transliteration & aliases ───────────────────────────────────────────
    const variants = transliterationVariants(label);
    for (const variant of variants.slice(0, 6)) {
      const isMixed = isMixedScript(variant);
      out.entities?.push(entity('alias', variant, { label: variant, tags: isMixed ? ['translit', 'mixed-script'] : ['translit'], confidence: 0.7 }));
      out.edges?.push(edge(input.entity.id, { type: 'alias', value: variant }, 'alias_of', 0.8, 0.75));
    }
    out.evidence?.push(
      evidence('person.translit-variants', `Варианты латинской записи: ${variants.slice(0, 5).join(', ')}`, variants.slice(0, 5), source, { reliability: 0.9, tags: ['translit'] }),
      evidence('person.initials', `Инициалы: ${[parts.last, parts.first, parts.middle].filter(Boolean).map((token) => (token as string)[0]?.toUpperCase()).join('.')}.`, `${parts.last ?? ''} ${parts.first?.[0] ?? ''}.${parts.middle?.[0] ?? ''}.`.trim(), source, { reliability: 0.95, tags: ['registry-query'] }),
    );

    // ── Username candidates ─────────────────────────────────────────────────
    const candidates = usernameCandidates(parts);
    for (const candidate of candidates.slice(0, 10)) {
      out.entities?.push(entity('username', candidate, { label: `@${candidate}`, tags: ['generated'], confidence: 0.45, properties: { generatedFrom: input.entity.value, skeleton: candidate } }));
      out.edges?.push(edge(input.entity.id, { type: 'username', value: candidate }, 'uses', 0.4, 0.4));
      out.pivots?.push(pivot('username', candidate, { relation: 'uses', confidence: 0.45, reason: 'Никнейм, выведенный из ФИО (конвенции платформ)', from: input.entity.id }));
    }

    // ── Cross-source verification against already collected identifiers ─────
    let bestMatch: { value: string; score: number; verdict: string } | undefined;
    for (const related of input.related) {
      if (!['alias', 'username', 'social_profile', 'email'].includes(related.type)) continue;
      const candidateText = related.value.replace(/[@._-]+/g, ' ').trim();
      const numeric = /^\d+$/.test(related.value.replace(/[@._-]/g, ''));
      if (numeric || candidateText.length < 4) continue;
      const result = matchPersons(label, candidateText);
      if (!bestMatch || result.score > bestMatch.score) bestMatch = { value: related.value, score: result.score, verdict: result.verdict };
    }
    if (bestMatch) {
      out.evidence?.push(
        evidence(
          'person.identity-match',
          `Соответствие «${bestMatch.value}» указанному ФИО: ${(bestMatch.score * 100).toFixed(1)}% (${bestMatch.verdict})`,
          bestMatch.score,
          { name: 'Композитное сопоставление персон (token-set + Jaro-Winkler + фонетика)', kind: 'heuristic' },
          { reliability: 0.75, tags: ['verification', 'heuristic'] },
        ),
      );
      if (bestMatch.score < 0.6) {
        out.riskFactors?.push(risk('opsec.identity-mismatch', 0.5, `Аккаунт «${bestMatch.value}» слабо соответствует ФИО «${label}» (${(bestMatch.score * 100).toFixed(0)}%) — возможна омонимия или чужой профиль`, [], { label: 'Несоответствие профиля и ФИО' }));
      }
    }

    // ── Registry query plan ─────────────────────────────────────────────────
    const query = `${parts.last ?? ''} ${parts.first ?? ''} ${parts.middle ?? ''}`.trim();
    out.evidence?.push(
      evidence('person.registry-plan', 'План проверки по официальным реестрам', {
        egrul: DIRECTORY_LINKS.egrul(query),
        fssp: DIRECTORY_LINKS.fssp(),
        kadArbitr: DIRECTORY_LINKS.kadArbitr(query),
        sudrf: DIRECTORY_LINKS.sudrf(query),
        rosreestr: DIRECTORY_LINKS.rosreestr(query),
        gibdd: DIRECTORY_LINKS.gibdd(),
      }, source, { reliability: 0.9, tags: ['plan', 'registry'] }),
    );

    // ── Alias-level analysis ────────────────────────────────────────────────
    if (input.entity.type === 'alias') {
      const normalized = normalizeUsername(input.entity.value);
      out.evidence?.push(
        evidence('alias.skeleton', `Скелет никнейма (гомоглиф-свёртка): ${skeletonize(input.entity.value)}`, skeletonize(input.entity.value), source, { reliability: 0.9, tags: ['homoglyph'] }),
        evidence('alias.platform-reuse', 'Никнейм проверяется на 20+ платформах модулем social.footprint', normalized, source, { reliability: 0.6 }),
      );
      if (isMixedScript(input.entity.value)) {
        out.riskFactors?.push(risk('cyber.typosquat-or-homoglyph', 0.5, `Никнейм «${input.entity.value}» смешивает алфавиты — приём имитации чужого аккаунта`, []));
      }
    }

    return out;
  },
};

export const identityModules = [identityModule];
