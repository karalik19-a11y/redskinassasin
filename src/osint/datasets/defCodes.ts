/**
 * TOMAHAWK OSINT ENGINE — Russian/CIS DEF-code routing matrix (offline dataset)
 * ---------------------------------------------------------------------------
 * DEF-код — first three digits of a Russian mobile number (the national
 * destination code). Historically tied to the *initial* carrier of the range.
 *
 * IMPORTANT CAVEAT (modelled, not hidden): since MNP (Mobile Number
 * Portability, 2013) a subscriber may keep the number on another network, and
 * aggregators sell whole MVNO ranges. The matrix therefore returns a
 * *historical* carrier with a documented reliability penalty, plus flags for
 * virtual/MVNO ranges — the honest treatment of this dataset.
 */

export interface DefEntry {
  operator: string;
  category: 'Федеральный MNO' | 'MVNO' | 'Региональный' | 'VoIP / сервисный';
  region: string;
  notes?: string;
}

/** Prefix → entry. Ranges are compacted by leading digits where uniform. */
export const RU_DEF_MATRIX: Record<string, DefEntry> = {
  // ── МТС ───────────────────────────────────────────────────────────────────
  '910': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'Центральный ФО' },
  '911': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'Северо-Западный ФО' },
  '912': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'Уральский ФО' },
  '913': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'Сибирский ФО' },
  '914': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'Дальневосточный ФО' },
  '915': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'г. Москва и Московская обл.' },
  '916': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'г. Москва и Московская обл.' },
  '917': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'Приволжский / Центральный ФО' },
  '918': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'Южный ФО / Северный Кавказ' },
  '919': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'Центральный / Приволжский ФО' },
  '980': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'Центральный ФО' },
  '981': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'Северо-Западный ФО' },
  '982': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'Уральский ФО' },
  '983': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'Сибирский ФО' },
  '984': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'Дальневосточный ФО' },
  '985': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'г. Москва и Московская обл.' },
  '986': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'Приволжский ФО' },
  '987': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'Приволжский ФО' },
  '988': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'Северный Кавказ' },
  '989': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'Южный ФО' },

  // ── МегаФон ───────────────────────────────────────────────────────────────
  '920': { operator: 'ПАО «МегаФон»', category: 'Федеральный MNO', region: 'Центральный ФО' },
  '921': { operator: 'ПАО «МегаФон»', category: 'Федеральный MNO', region: 'Северо-Западный ФО (СПб)' },
  '922': { operator: 'ПАО «МегаФон»', category: 'Федеральный MNO', region: 'Уральский ФО' },
  '923': { operator: 'ПАО «МегаФон»', category: 'Федеральный MNO', region: 'Сибирский ФО' },
  '924': { operator: 'ПАО «МегаФон»', category: 'Федеральный MNO', region: 'Дальневосточный ФО' },
  '925': { operator: 'ПАО «МегаФон»', category: 'Федеральный MNO', region: 'г. Москва и Московская обл.' },
  '926': { operator: 'ПАО «МегаФон»', category: 'Федеральный MNO', region: 'г. Москва и Московская обл.' },
  '927': { operator: 'ПАО «МегаФон»', category: 'Федеральный MNO', region: 'Приволжский ФО' },
  '928': { operator: 'ПАО «МегаФон»', category: 'Федеральный MNO', region: 'Северный Кавказ / Южный ФО' },
  '929': { operator: 'ПАО «МегаФон»', category: 'Федеральный MNO', region: 'Центральный ФО' },
  '930': { operator: 'ПАО «МегаФон»', category: 'Федеральный MNO', region: 'Центральный ФО' },
  '931': { operator: 'ПАО «МегаФон»', category: 'Федеральный MNO', region: 'Северо-Западный ФО' },
  '932': { operator: 'ПАО «МегаФон»', category: 'Федеральный MNO', region: 'Уральский ФО' },
  '933': { operator: 'ПАО «МегаФон»', category: 'Федеральный MNO', region: 'Сибирский ФО' },
  '934': { operator: 'ПАО «МегаФон»', category: 'Федеральный MNO', region: 'Дальневосточный ФО' },
  '936': { operator: 'ПАО «МегаФон»', category: 'Федеральный MNO', region: 'г. Москва и Московская обл.' },
  '937': { operator: 'ПАО «МегаФон»', category: 'Федеральный MNO', region: 'Приволжский ФО' },
  '938': { operator: 'ПАО «МегаФон»', category: 'Федеральный MNO', region: 'Южный ФО' },
  '939': { operator: 'ПАО «МегаФон»', category: 'Федеральный MNO', region: 'Центральный ФО' },

  // ── Билайн ────────────────────────────────────────────────────────────────
  '903': { operator: 'ПАО «ВымпелКом» (Билайн)', category: 'Федеральный MNO', region: 'г. Москва и Московская обл.' },
  '905': { operator: 'ПАО «ВымпелКом» (Билайн)', category: 'Федеральный MNO', region: 'г. Москва и Московская обл.' },
  '906': { operator: 'ПАО «ВымпелКом» (Билайн)', category: 'Федеральный MNO', region: 'г. Москва и Московская обл.' },
  '909': { operator: 'ПАО «ВымпелКом» (Билайн)', category: 'Федеральный MNO', region: 'Центральный ФО' },
  '960': { operator: 'ПАО «ВымпелКом» (Билайн)', category: 'Федеральный MNO', region: 'Центральный ФО' },
  '961': { operator: 'ПАО «ВымпелКом» (Билайн)', category: 'Федеральный MNO', region: 'Центральный ФО' },
  '962': { operator: 'ПАО «ВымпелКом» (Билайн)', category: 'Федеральный MNO', region: 'Центральный ФО' },
  '963': { operator: 'ПАО «ВымпелКом» (Билайн)', category: 'Федеральный MNO', region: 'Сибирский ФО' },
  '964': { operator: 'ПАО «ВымпелКом» (Билайн)', category: 'Федеральный MNO', region: 'Северо-Западный ФО' },
  '965': { operator: 'ПАО «ВымпелКом» (Билайн)', category: 'Федеральный MNO', region: 'Дальневосточный ФО' },
  '966': { operator: 'ПАО «ВымпелКом» (Билайн)', category: 'Федеральный MNO', region: 'Южный ФО' },
  '967': { operator: 'ПАО «ВымпелКом» (Билайн)', category: 'Федеральный MNO', region: 'г. Москва и Московская обл.' },
  '968': { operator: 'ПАО «ВымпелКом» (Билайн)', category: 'Федеральный MNO', region: 'Приволжский ФО' },
  '969': { operator: 'ПАО «ВымпелКом» (Билайн)', category: 'Федеральный MNO', region: 'Центральный ФО', notes: 'часть диапазона переведена в VoIP/MVNO' },

  // ── Т2 (Tele2) ────────────────────────────────────────────────────────────
  '900': { operator: 'ООО «Т2 Мобайл» (Tele2)', category: 'Федеральный MNO', region: 'г. Москва и Московская обл.' },
  '901': { operator: 'ООО «Т2 Мобайл» (Tele2)', category: 'Федеральный MNO', region: 'г. Москва и Московская обл.' },
  '902': { operator: 'ООО «Т2 Мобайл» (Tele2)', category: 'Федеральный MNO', region: 'Центральный ФО' },
  '904': { operator: 'ООО «Т2 Мобайл» (Tele2)', category: 'Федеральный MNO', region: 'Уральский / Сибирский ФО' },
  '950': { operator: 'ООО «Т2 Мобайл» (Tele2)', category: 'Федеральный MNO', region: 'Центральный ФО' },
  '951': { operator: 'ООО «Т2 Мобайл» (Tele2)', category: 'Федеральный MNO', region: 'Приволжский ФО' },
  '952': { operator: 'ООО «Т2 Мобайл» (Tele2)', category: 'Федеральный MNO', region: 'Уральский ФО' },
  '953': { operator: 'ООО «Т2 Мобайл» (Tele2)', category: 'Федеральный MNO', region: 'Сибирский ФО' },
  '958': { operator: 'ООО «Т2 Мобайл» (Tele2)', category: 'Федеральный MNO', region: 'Дальневосточный ФО' },
  '977': { operator: 'ООО «Т2 Мобайл» (Tele2) / партнёрские MVNO', category: 'MVNO', region: 'Федеральный', notes: 'используется виртуальными операторами на сети Tele2' },

  // ── Yota / СберМобайл / Т-Мобайл и прочие MVNO ────────────────────────────
  '999': { operator: 'MVNO на сети МегаФон (Yota, СберМобайл, Т-Мобайл)', category: 'MVNO', region: 'Федеральный', notes: 'массовое распространение виртуальных номеров' },
  '995': { operator: 'MVNO на сети МегаФон', category: 'MVNO', region: 'Федеральный' },
  '993': { operator: 'MVNO (партнёрские программы)', category: 'MVNO', region: 'Федеральный' },
  '991': { operator: 'MVNO (партнёрские программы)', category: 'MVNO', region: 'Федеральный' },
  '992': { operator: 'MVNO (партнёрские программы)', category: 'MVNO', region: 'Федеральный' },

  // ── Фиксированная связь / сервисные диапазоны ─────────────────────────────
  '495': { operator: 'Фиксированная связь Москвы (МГТС)', category: 'Региональный', region: 'г. Москва' },
  '499': { operator: 'Фиксированная связь Москвы', category: 'Региональный', region: 'г. Москва' },
  '800': { operator: 'Бесплатный вызов (8-800)', category: 'VoIP / сервисный', region: 'Федеральный' },
  '804': { operator: 'Сервисный диапазон', category: 'VoIP / сервисный', region: 'Федеральный' },

  // ── СНГ (для трансграничных номеров) ─────────────────────────────────────
  '77': { operator: 'Казахстан — национальные операторы', category: 'Региональный', region: 'Казахстан' },
  '375': { operator: 'Беларусь — A1 / МТС / life:)', category: 'Региональный', region: 'Беларусь' },
  '380': { operator: 'Украина — Киевстар / Vodafone / lifecell', category: 'Региональный', region: 'Украина' },
};

/** Look up the historical operator for a DEF-code (3 digits) or national prefix. */
export function identifyDefRange(defCode: string): DefEntry | undefined {
  const code = defCode.replace(/\D/g, '');
  if (RU_DEF_MATRIX[code]) return RU_DEF_MATRIX[code];
  // Fall back to progressively shorter prefixes (e.g. '77x' → '77').
  for (let length = code.length - 1; length >= 2; length -= 1) {
    const prefix = code.slice(0, length);
    if (RU_DEF_MATRIX[prefix]) return RU_DEF_MATRIX[prefix];
  }
  return undefined;
}

/** Federal districts referenced by the matrix — used for geo-coherence checks. */
export const FEDERAL_DISTRICTS = [
  'Центральный ФО',
  'Северо-Западный ФО',
  'Южный ФО',
  'Северо-Кавказский ФО',
  'Приволжский ФО',
  'Уральский ФО',
  'Сибирский ФО',
  'Дальневосточный ФО',
] as const;
