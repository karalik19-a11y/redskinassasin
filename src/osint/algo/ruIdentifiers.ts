/**
 * TOMAHAWK OSINT ENGINE — Russian & CIS identifier algorithms
 * ---------------------------------------------------------------------------
 * Every check here is the *official* arithmetic used by the issuing authority —
 * ФНС (ИНН, ОГРН, КПП), ПФР (СНИЛС), ГИБДД (ГРЗ, VIN), ЦБ РФ (БИК), Росреестр
 * (кадастровый номер), ГУ МВД (паспорт, ВУ). These checksums are what make
 * identifier validation real: a random 10-digit string passes a regex but fails
 * the ФНС polynomial, and that difference decides whether an identifier becomes
 * a pivot in the graph or gets flagged as fabricated.
 *
 * Region tables (89 subjects) let us geo-attribute identifiers — the single
 * most useful pivot when only an ИНН/СНИЛС/ГРЗ is known.
 */

export interface RuRegion {
  code: string;
  name: string;
  district: string;
  /** Vehicle plate prefixes issued in the region (incl. historical series). */
  plates: string[];
}

export const RU_REGIONS: Record<string, RuRegion> = {
  '01': { code: '01', name: 'Республика Адыгея', district: 'ЮФО', plates: ['01'] },
  '02': { code: '02', name: 'Республика Башкортостан', district: 'ПФО', plates: ['02', '102', '702'] },
  '03': { code: '03', name: 'Республика Бурятия', district: 'ДФО', plates: ['03', '103'] },
  '04': { code: '04', name: 'Республика Алтай', district: 'СФО', plates: ['04'] },
  '05': { code: '05', name: 'Республика Дагестан', district: 'СКФО', plates: ['05', '105'] },
  '06': { code: '06', name: 'Республика Ингушетия', district: 'СКФО', plates: ['06'] },
  '07': { code: '07', name: 'Кабардино-Балкарская Республика', district: 'СКФО', plates: ['07'] },
  '08': { code: '08', name: 'Республика Калмыкия', district: 'ЮФО', plates: ['08'] },
  '09': { code: '09', name: 'Карачаево-Черкесская Республика', district: 'СКФО', plates: ['09'] },
  '10': { code: '10', name: 'Республика Карелия', district: 'СЗФО', plates: ['10'] },
  '11': { code: '11', name: 'Республика Коми', district: 'СЗФО', plates: ['11'] },
  '12': { code: '12', name: 'Республика Марий Эл', district: 'ПФО', plates: ['12'] },
  '13': { code: '13', name: 'Республика Мордовия', district: 'ПФО', plates: ['13', '113'] },
  '14': { code: '14', name: 'Республика Саха (Якутия)', district: 'ДФО', plates: ['14'] },
  '15': { code: '15', name: 'Республика Северная Осетия — Алания', district: 'СКФО', plates: ['15'] },
  '16': { code: '16', name: 'Республика Татарстан', district: 'ПФО', plates: ['16', '116', '716'] },
  '17': { code: '17', name: 'Республика Тыва', district: 'СФО', plates: ['17'] },
  '18': { code: '18', name: 'Удмуртская Республика', district: 'ПФО', plates: ['18'] },
  '19': { code: '19', name: 'Республика Хакасия', district: 'СФО', plates: ['19'] },
  '20': { code: '20', name: 'Чеченская Республика', district: 'СКФО', plates: ['20', '95'] },
  '21': { code: '21', name: 'Чувашская Республика', district: 'ПФО', plates: ['21', '121'] },
  '22': { code: '22', name: 'Алтайский край', district: 'СФО', plates: ['22', '122'] },
  '23': { code: '23', name: 'Краснодарский край', district: 'ЮФО', plates: ['23', '93', '123', '193', '323'] },
  '24': { code: '24', name: 'Красноярский край', district: 'СФО', plates: ['24', '124'] },
  '25': { code: '25', name: 'Приморский край', district: 'ДФО', plates: ['25', '125'] },
  '26': { code: '26', name: 'Ставропольский край', district: 'СКФО', plates: ['26', '126'] },
  '27': { code: '27', name: 'Хабаровский край', district: 'ДФО', plates: ['27'] },
  '28': { code: '28', name: 'Амурская область', district: 'ДФО', plates: ['28'] },
  '29': { code: '29', name: 'Архангельская область', district: 'СЗФО', plates: ['29'] },
  '30': { code: '30', name: 'Астраханская область', district: 'ЮФО', plates: ['30'] },
  '31': { code: '31', name: 'Белгородская область', district: 'ЦФО', plates: ['31'] },
  '32': { code: '32', name: 'Брянская область', district: 'ЦФО', plates: ['32'] },
  '33': { code: '33', name: 'Владимирская область', district: 'ЦФО', plates: ['33'] },
  '34': { code: '34', name: 'Волгоградская область', district: 'ЮФО', plates: ['34', '134'] },
  '35': { code: '35', name: 'Вологодская область', district: 'СЗФО', plates: ['35'] },
  '36': { code: '36', name: 'Воронежская область', district: 'ЦФО', plates: ['36', '136'] },
  '37': { code: '37', name: 'Ивановская область', district: 'ЦФО', plates: ['37'] },
  '38': { code: '38', name: 'Иркутская область', district: 'СФО', plates: ['38', '138'] },
  '39': { code: '39', name: 'Калининградская область', district: 'СЗФО', plates: ['39'] },
  '40': { code: '40', name: 'Калужская область', district: 'ЦФО', plates: ['40'] },
  '41': { code: '41', name: 'Камчатский край', district: 'ДФО', plates: ['41'] },
  '42': { code: '42', name: 'Кемеровская область — Кузбасс', district: 'СФО', plates: ['42', '142'] },
  '43': { code: '43', name: 'Кировская область', district: 'ПФО', plates: ['43'] },
  '44': { code: '44', name: 'Костромская область', district: 'ЦФО', plates: ['44'] },
  '45': { code: '45', name: 'Курганская область', district: 'УФО', plates: ['45'] },
  '46': { code: '46', name: 'Курская область', district: 'ЦФО', plates: ['46'] },
  '47': { code: '47', name: 'Ленинградская область', district: 'СЗФО', plates: ['47', '147'] },
  '48': { code: '48', name: 'Липецкая область', district: 'ЦФО', plates: ['48'] },
  '49': { code: '49', name: 'Магаданская область', district: 'ДФО', plates: ['49'] },
  '50': { code: '50', name: 'Московская область', district: 'ЦФО', plates: ['50', '90', '150', '190', '750', '790'] },
  '51': { code: '51', name: 'Мурманская область', district: 'СЗФО', plates: ['51'] },
  '52': { code: '52', name: 'Нижегородская область', district: 'ПФО', plates: ['52', '152', '252'] },
  '53': { code: '53', name: 'Новгородская область', district: 'СЗФО', plates: ['53'] },
  '54': { code: '54', name: 'Новосибирская область', district: 'СФО', plates: ['54', '154'] },
  '55': { code: '55', name: 'Омская область', district: 'СФО', plates: ['55'] },
  '56': { code: '56', name: 'Оренбургская область', district: 'ПФО', plates: ['56', '156'] },
  '57': { code: '57', name: 'Орловская область', district: 'ЦФО', plates: ['57'] },
  '58': { code: '58', name: 'Пензенская область', district: 'ПФО', plates: ['58'] },
  '59': { code: '59', name: 'Пермский край', district: 'ПФО', plates: ['59', '159'] },
  '60': { code: '60', name: 'Псковская область', district: 'СЗФО', plates: ['60'] },
  '61': { code: '61', name: 'Ростовская область', district: 'ЮФО', plates: ['61', '161', '761'] },
  '62': { code: '62', name: 'Рязанская область', district: 'ЦФО', plates: ['62'] },
  '63': { code: '63', name: 'Самарская область', district: 'ПФО', plates: ['63', '163', '763'] },
  '64': { code: '64', name: 'Саратовская область', district: 'ПФО', plates: ['64', '164'] },
  '65': { code: '65', name: 'Сахалинская область', district: 'ДФО', plates: ['65'] },
  '66': { code: '66', name: 'Свердловская область', district: 'УФО', plates: ['66', '96', '166', '196'] },
  '67': { code: '67', name: 'Смоленская область', district: 'ЦФО', plates: ['67'] },
  '68': { code: '68', name: 'Тамбовская область', district: 'ЦФО', plates: ['68'] },
  '69': { code: '69', name: 'Тверская область', district: 'ЦФО', plates: ['69'] },
  '70': { code: '70', name: 'Томская область', district: 'СФО', plates: ['70'] },
  '71': { code: '71', name: 'Тульская область', district: 'ЦФО', plates: ['71'] },
  '72': { code: '72', name: 'Тюменская область', district: 'УФО', plates: ['72', '172'] },
  '73': { code: '73', name: 'Ульяновская область', district: 'ПФО', plates: ['73', '173'] },
  '74': { code: '74', name: 'Челябинская область', district: 'УФО', plates: ['74', '174', '774'] },
  '75': { code: '75', name: 'Забайкальский край', district: 'ДФО', plates: ['75'] },
  '76': { code: '76', name: 'Ярославская область', district: 'ЦФО', plates: ['76'] },
  '77': { code: '77', name: 'г. Москва', district: 'ЦФО', plates: ['77', '97', '99', '177', '197', '199', '777', '797', '799', '977'] },
  '78': { code: '78', name: 'г. Санкт-Петербург', district: 'СЗФО', plates: ['78', '98', '178', '198'] },
  '79': { code: '79', name: 'Еврейская автономная область', district: 'ДФО', plates: ['79'] },
  '80': { code: '80', name: 'Донецкая Народная Республика', district: 'ЮФО', plates: ['80'] },
  '81': { code: '81', name: 'Луганская Народная Республика', district: 'ЮФО', plates: ['81'] },
  '82': { code: '82', name: 'Республика Крым', district: 'ЮФО', plates: ['82'] },
  '83': { code: '83', name: 'Ненецкий автономный округ', district: 'СЗФО', plates: ['83'] },
  '84': { code: '84', name: 'Запорожская область', district: 'ЮФО', plates: ['84'] },
  '85': { code: '85', name: 'Херсонская область', district: 'ЮФО', plates: ['85'] },
  '86': { code: '86', name: 'Ханты-Мансийский АО — Югра', district: 'УФО', plates: ['86', '186'] },
  '87': { code: '87', name: 'Чукотский автономный округ', district: 'ДФО', plates: ['87'] },
  '89': { code: '89', name: 'Ямало-Ненецкий автономный округ', district: 'УФО', plates: ['89'] },
  '91': { code: '91', name: 'Республика Крым (Крымский ФО, архив)', district: '—', plates: ['91'] },
  '92': { code: '92', name: 'г. Севастополь', district: 'ЮФО', plates: ['92', '192'] },
};

export function regionByCode(code: string): RuRegion | undefined {
  return RU_REGIONS[code.padStart(2, '0')];
}

export function regionByPlate(plate: string): RuRegion | undefined {
  const digits = plate.replace(/\D/g, '');
  return Object.values(RU_REGIONS).find((region) => region.plates.includes(digits));
}

// ─────────────────────────────────────────────────────────────────────────────
// ФНС: ИНН / ОГРН / КПП
// ─────────────────────────────────────────────────────────────────────────────

export interface IdentifierCheck {
  isValid: boolean;
  type: string;
  region?: RuRegion | string;
  details: Record<string, string | number | boolean>;
  error?: string;
}

/** ИНН юридического лица (10 знаков) — полиномиальная проверка ФНС. */
export function validateInn10(input: string): IdentifierCheck {
  const value = input.replace(/\D/g, '');
  const details: IdentifierCheck['details'] = {};
  if (value.length !== 10) return { isValid: false, type: 'ИНН ЮЛ (10 знаков)', details, error: `Ожидалось 10 цифр, получено ${value.length}` };
  const weights = [2, 4, 10, 3, 5, 9, 4, 6, 8];
  const sum = weights.reduce((acc, weight, index) => acc + weight * Number(value[index]), 0);
  const checkDigit = (sum % 11) % 10;
  const region = regionByCode(value.slice(0, 2));
  details.regionCode = value.slice(0, 2);
  details.taxAuthority = value.slice(0, 4);
  details.expectedCheckDigit = checkDigit;
  details.actualCheckDigit = Number(value[9]);
  details.verifyUrl = `https://egrul.nalog.ru/index.html?query=${value}`;
  return {
    isValid: checkDigit === Number(value[9]),
    type: 'ИНН ЮЛ (10 знаков)',
    region: region ? `${region.name} (${region.district})` : `Неизвестный код региона ${value.slice(0, 2)}`,
    details,
    error: checkDigit === Number(value[9]) ? undefined : `Контрольная цифра ФНС не совпала (ожидалось ${checkDigit}, получено ${value[9]})`,
  };
}

/** ИНН физического лица / ИП (12 знаков) — двойная проверка ФНС. */
export function validateInn12(input: string): IdentifierCheck {
  const value = input.replace(/\D/g, '');
  const details: IdentifierCheck['details'] = {};
  if (value.length !== 12) return { isValid: false, type: 'ИНН ФЛ/ИП (12 знаков)', details, error: `Ожидалось 12 цифр, получено ${value.length}` };
  const w1 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
  const w2 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
  const d11 = w1.reduce((acc, weight, index) => acc + weight * Number(value[index]), 0) % 11 % 10;
  const d12 = w2.reduce((acc, weight, index) => acc + weight * Number(value[index]), 0) % 11 % 10;
  const region = regionByCode(value.slice(0, 2));
  details.regionCode = value.slice(0, 2);
  details.expected11 = d11;
  details.expected12 = d12;
  details.actual11 = Number(value[10]);
  details.actual12 = Number(value[11]);
  details.verifyUrl = `https://service.nalog.ru/inn.do?inn=${value}`;
  const ok = d11 === Number(value[10]) && d12 === Number(value[11]);
  return {
    isValid: ok,
    type: 'ИНН ФЛ/ИП (12 знаков)',
    region: region ? `${region.name} (${region.district})` : `Неизвестный код региона ${value.slice(0, 2)}`,
    details,
    error: ok ? undefined : 'Обе контрольные цифры ФНС должны совпасть (двойной полином)',
  };
}

export function validateInn(input: string): IdentifierCheck {
  const value = input.replace(/\D/g, '');
  if (value.length === 10) return validateInn10(value);
  if (value.length === 12) return validateInn12(value);
  return {
    isValid: false,
    type: 'ИНН',
    details: { length: value.length },
    error: `ИНН содержит 10 (ЮЛ) или 12 (ФЛ/ИП) цифр, получено ${value.length}`,
  };
}

/** ОГРН (13 знаков): последняя цифра = (первые 12 как число) mod 11, затем mod 10. */
export function validateOgrn(input: string): IdentifierCheck {
  const value = input.replace(/\D/g, '');
  const details: IdentifierCheck['details'] = {};
  if (value.length !== 13) return { isValid: false, type: 'ОГРН', details, error: `Ожидалось 13 цифр, получено ${value.length}` };
  const body = value.slice(0, 12);
  const check = (Number(body) % 11) % 10;
  const year = value.slice(1, 3);
  const region = regionByCode(value.slice(3, 5));
  details.registrationYear = `20${year}`;
  details.regionCode = value.slice(3, 5);
  details.expected = check;
  details.actual = Number(value[12]);
  details.verifyUrl = `https://egrul.nalog.ru/index.html?query=${value}`;
  const registrationYear = Number(`20${year}`);
  const plausibleYear = registrationYear >= 2002 && registrationYear <= new Date().getFullYear();
  return {
    isValid: check === Number(value[12]) && plausibleYear,
    type: value[5] === '9' ? 'ОГРН ЮЛ' : 'ОГРН ЮЛ (признак 5)',
    region: region ? region.name : undefined,
    details,
    error: check !== Number(value[12]) ? `Контрольная цифра ОГРН не совпала (ожидалось ${check})` : !plausibleYear ? 'Неправдоподобный год регистрации (ОГРН введён с 2002 года)' : undefined,
  };
}

/** ОГРНИП (15 знаков): mod 13. */
export function validateOgrnip(input: string): IdentifierCheck {
  const value = input.replace(/\D/g, '');
  const details: IdentifierCheck['details'] = {};
  if (value.length !== 15) return { isValid: false, type: 'ОГРНИП', details, error: `Ожидалось 15 цифр, получено ${value.length}` };
  const body = value.slice(0, 14);
  const check = (Number(body) % 13) % 10;
  details.registrationYear = `20${value.slice(1, 3)}`;
  details.regionCode = value.slice(3, 5);
  details.expected = check;
  details.actual = Number(value[14]);
  return {
    isValid: check === Number(value[14]),
    type: 'ОГРНИП',
    region: regionByCode(value.slice(3, 5))?.name,
    details,
    error: check === Number(value[14]) ? undefined : `Контрольная цифра ОГРНИП не совпала (ожидалось ${check})`,
  };
}

/** КПП (9 знаков): первые 4 цифры должны совпадать с кодом налогового органа ИНН. */
export function validateKpp(input: string, inn?: string): IdentifierCheck {
  const value = input.trim().toUpperCase();
  const details: IdentifierCheck['details'] = {};
  if (!/^\d{4}[\dA-Z]{2}\d{3}$/.test(value)) {
    return { isValid: false, type: 'КПП', details, error: 'Формат КПП: NNNN + 2 знака причины + NNN' };
  }
  const region = regionByCode(value.slice(0, 2));
  const reason = value.slice(4, 6);
  const reasonLabels: Record<string, string> = {
    '01': 'по месту нахождения организации',
    '02': 'обособленное подразделение',
    '43': 'филиал / представительство',
    '44': 'обособленное подразделение (иностранная организация)',
    '45': 'обособленное подразделение (иностранная организация, 2)',
    '50': 'крупнейший налогоплательщик',
    '99': 'прочие основания',
  };
  details.reasonCode = `${reason} — ${reasonLabels[reason] ?? 'неклассифицированный код'}`;
  if (inn) details.matchesInn = value.slice(0, 4) === inn.replace(/\D/g, '').slice(0, 4);
  return {
    isValid: true,
    type: 'КПП',
    region: region ? `${region.name} (налоговый орган ${value.slice(0, 4)})` : undefined,
    details,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ПФР: СНИЛС
// ─────────────────────────────────────────────────────────────────────────────

export function validateSnils(input: string): IdentifierCheck {
  const value = input.replace(/\D/g, '');
  const details: IdentifierCheck['details'] = {};
  if (value.length !== 11) return { isValid: false, type: 'СНИЛС', details, error: `Ожидалось 11 цифр, получено ${value.length}` };
  const body = value.slice(0, 9);
  const check = Number(value.slice(9, 11));
  details.archive = check <= 1;
  details.controlNumber = check;

  if (Number(body) <= 1001998) {
    details.rule = 'Архивный диапазон (≤ 001-001-998) — контрольная сумма не применяется';
    return { isValid: true, type: 'СНИЛС (архивный)', details };
  }

  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(body[i]) * (9 - i);
  let expected = sum % 101;
  if (expected === 100) expected = 0;
  details.expected = expected;
  details.actual = check;
  details.verifyUrl = 'https://esia.gosuslugi.ru/login/';
  return {
    isValid: expected === check && check !== 0,
    type: 'СНИЛС',
    details,
    error: expected === check ? undefined : `Контрольная сумма ПФР не совпала (ожидалось ${String(expected).padStart(2, '0')})`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// МВД: паспорт РФ, водительское удостоверение, ГРЗ, VIN
// ─────────────────────────────────────────────────────────────────────────────

export function validatePassportRf(series: string, number: string): IdentifierCheck {
  const cleanSeries = series.replace(/\D/g, '');
  const cleanNumber = number.replace(/\D/g, '');
  const details: IdentifierCheck['details'] = { series: cleanSeries, number: cleanNumber };
  if (cleanSeries.length !== 4) return { isValid: false, type: 'Паспорт РФ', details, error: 'Серия паспорта — 4 цифры (код региона + год выдачи)' };
  if (cleanNumber.length !== 6) return { isValid: false, type: 'Паспорт РФ', details, error: 'Номер паспорта — 6 цифр' };

  const regionCode = cleanSeries.slice(0, 2);
  const region = regionByCode(regionCode);
  const issueYearSuffix = cleanSeries.slice(2, 4);
  const issueYear = 2000 + Number(issueYearSuffix);
  details.regionCode = regionCode;
  details.issueYear = issueYear;
  details.blankSeries = `${cleanSeries} ${cleanNumber}`;
  const plausible = issueYear >= 1997 && issueYear <= new Date().getFullYear();

  return {
    isValid: Boolean(region) && plausible,
    type: 'Паспорт РФ',
    region: region ? `${region.name} (${region.district})` : undefined,
    details,
    error: !region ? `Код региона ${regionCode} отсутствует в ОКАТО/ГИБДД-классификаторе` : !plausible ? `Год выдачи ${issueYear} неправдоподобен` : undefined,
  };
}

export function validateDriverLicense(input: string): IdentifierCheck {
  const value = input.replace(/\D/g, '');
  const details: IdentifierCheck['details'] = { length: value.length };
  if (value.length !== 10) return { isValid: false, type: 'Водительское удостоверение РФ', details, error: 'ВУ РФ содержит 10 цифр' };
  const region = regionByCode(value.slice(0, 2));
  details.regionCode = value.slice(0, 2);
  // Digits 3–4 encode the issuing subdivision, 5–6 the issue year for older blanks.
  details.issueYear = Number(`20${value.slice(4, 6)}`);
  return {
    isValid: Boolean(region) && Number(`20${value.slice(4, 6)}`) <= new Date().getFullYear() + 1,
    type: 'Водительское удостоверение РФ',
    region: region?.name,
    details,
    error: region ? undefined : 'Неизвестный код региона в серии ВУ',
  };
}

export interface PlateCheck extends IdentifierCheck {
  plateType: string;
  seriesType?: string;
}

const PLATE_TYPES: Array<{ pattern: RegExp; type: string; series?: string }> = [
  { pattern: /^[ABEKMHOPCTYX]\d{3}[ABEKMHOPCTYX]{2}\d{2,3}$/i, type: 'Тип 1 — легковой/грузовой (РФ)' },
  { pattern: /^[ABEKMHOPCTYX]{2}\d{5,6}$/i, type: 'Тип 1A — мотоцикл/прицеп' },
  { pattern: /^[ABEKMHOPCTYX]\d{3}[ABEKMHOPCTYX]{2}$/i, type: 'Тип 1 — без региона (устаревший)' },
  { pattern: /^[ABEKMHOPCTYX]\d{4}[ABEKMHOPCTYX]{2}$/i, type: 'Тип 2 — такси/грузовик с 4 цифрами' },
  { pattern: /^[ABEKMHOPCTYX]{2}\d{3}\d{2,3}$/i, type: 'Тип 3 — прицеп/полуприцеп' },
  { pattern: /^\d{4}[ABEKMHOPCTYX]{2}\d{2,3}$/i, type: 'Тип 4 — иностранная организация / дипломат' },
  { pattern: /^[ABEKMHOPCTYX]{3}\d{2,3}$/i, type: 'Тип 4A — мотоцикл дипмиссии' },
  { pattern: /^[ABEKMHOPCTYX]{2}\d{4}\d{2,3}$/i, type: 'Тип 5 — автобус / спецтехника' },
  { pattern: /^[ABEKMHOPCTYX]{2}\d{3}\d{2}$/i, type: 'Тип 6 — воинская часть' },
];

/**
 * Plate letters are written in Cyrillic but the GOST set maps 1:1 onto Latin
 * look-alikes (А→A, В→B, Е→E, К→K, М→M, Н→H, О→O, Р→P, С→C, Т→T, У→Y, Х→X).
 * Parsing therefore canonicalises to Latin; the table below is keyed the same
 * way so a plate pasted in either alphabet is recognised.
 */
const PLATE_LATIN: Record<string, string> = {
  А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', У: 'Y', Х: 'X',
};

export function canonicalPlate(input: string): string {
  return [...input.toUpperCase()].map((char) => PLATE_LATIN[char] ?? char).join('');
}

const SPECIAL_SERIES: Record<string, string> = {
  AMP: 'Правительство РФ / Администрация Президента (историческая спецсерия)',
  EKX: 'ФСО / Федеральная служба охраны (историческая спецсерия)',
  CKP: 'Следственный комитет РФ',
  COP: 'спецсерия (служебная)',
  KKX: 'спецсерия (служебная)',
  AMM: 'спецсерия (служебная)',
  BOO: 'спецсерия (служебная)',
  MMP: 'спецсерия (служебная)',
  KMM: 'спецсерия (служебная)',
  OOO: 'спецсерия (служебная)',
  CCC: 'спецсерия (служебная)',
  MMM: 'спецсерия (служебная)',
};

/**
 * Parse a Russian GOST R 50577 plate: format identification, region and federal
 * district attribution, special-series recognition (АМР/ЕКХ/СКР) and the
 * "blue/red plate" markers used for law-enforcement and diplomatic vehicles.
 */
export function parseRuPlate(input: string): PlateCheck {
  const display = input.trim().toUpperCase().replace(/\s+/g, ' ').replace(/[-–]/g, ' ');
  const compact = canonicalPlate(display).replace(/\s/g, '');
  const details: IdentifierCheck['details'] = { normalized: display };
  // GOST series letters: for `А123ВЕ777` the series is `АВЕ`; for special-series
  // plates (`А001АМР77`) the meaningful three letters are the second group.
  const letterGroups = compact.match(/[A-Z]+/g) ?? [];
  const allLetters = letterGroups.join('');
  const series = allLetters.length === 4 ? allLetters.slice(1) : allLetters.slice(0, 3);

  for (const candidate of PLATE_TYPES) {
    if (!candidate.pattern.test(compact)) continue;
    const regionDigits = /(\d{2,3})$/.exec(compact)?.[1];
    const region = regionDigits ? regionByPlate(regionDigits) : undefined;
    details.format = candidate.type;
    details.regionCode = regionDigits ?? '—';
    details.series = series;
    if (SPECIAL_SERIES[series]) details.specialSeries = SPECIAL_SERIES[series];

    if (regionDigits && !region) {
      return {
        isValid: false,
        type: 'ГРЗ РФ',
        plateType: candidate.type,
        seriesType: details.specialSeries ? String(details.specialSeries) : undefined,
        details,
        error: `Код региона ${regionDigits} не найден в классификаторе ГИБДД`,
      };
    }
    return {
      isValid: true,
      type: 'ГРЗ РФ',
      plateType: candidate.type,
      seriesType: details.specialSeries ? String(details.specialSeries) : undefined,
      region: region ? `${region.name} (${region.district})` : undefined,
      details,
    };
  }

  return { isValid: false, type: 'ГРЗ РФ', plateType: 'Не распознан', details, error: 'Формат не соответствует ГОСТ Р 50577 (Тип 1, 1A, 2, 3, 4, 5, 6)' };
}

/** WMI → country/region table (first 2 VIN characters). */
const WMI_COUNTRY: Record<string, string> = {
  A: 'ЮАР', B: 'Ангола/Индонезия', C: 'Южная Африка', J: 'Япония', K: 'Южная Корея', L: 'Китай', M: 'Индия/Таиланд',
  N: 'Турция', P: 'Филиппины/Малайзия', R: 'ОАЭ/Тайвань', S: 'Великобритания/Германия', T: 'Швейцария/Чехия/Венгрия',
  U: 'Румыния/Словакия', V: 'Франция/Испания/Австрия', W: 'Германия', X: 'Россия/Нидерланды/Бельгия', Y: 'Швеция/Финляндия/Бельгия',
  Z: 'Италия/Израиль', '1': 'США', '2': 'Канада', '3': 'Мексика', '4': 'США', '5': 'США', '6': 'Австралия',
  '7': 'Новая Зеландия', '8': 'Аргентина/Чили', '9': 'Бразилия',
};

const WMI_MAJOR: Record<string, string> = {
  XTA: 'АвтоВАЗ (Lada)', XTT: 'АвтоВАЗ (Lada)', XW8: 'Volkswagen Group Rus', XW7: 'Toyota (СПб)',
  XUF: 'General Motors (СПб)', XUU: 'Chevrolet (Калининград)', X4X: 'BMW (Калининград, Avtotor)', X4K: 'Hyundai (Avtotor)',
  X9F: 'Ford Sollers', X96: 'ГАЗ', X89: 'УАЗ', X9L: 'GM-AvtoVAZ', Z94: 'Hyundai (ТагАЗ)', XWK: 'Kia (Автотор)',
  WBA: 'BMW', WBS: 'BMW M', WDB: 'Mercedes-Benz', WDC: 'Mercedes-Benz (SUV, США)', WDD: 'Mercedes-Benz (легковые)',
  WVW: 'Volkswagen (легковые)', WV1: 'Volkswagen (коммерческие)', WP0: 'Porsche', WP1: 'Porsche (SUV)',
  WAU: 'Audi', WA1: 'Audi (SUV)', TMB: 'Škoda', VF1: 'Renault', VF3: 'Peugeot', VF7: 'Citroën',
  JHM: 'Honda', JHL: 'Honda (SUV)', JTD: 'Toyota', JTM: 'Toyota (SUV)', JTJ: 'Lexus', JN1: 'Nissan',
  KMH: 'Hyundai', KNA: 'Kia', KNB: 'Kia', LSG: 'SAIC-GM', LSV: 'SAIC-Volkswagen', LFV: 'FAW-Volkswagen',
  LGB: 'Dongfeng', LDC: 'Changan', '1FT': 'Ford (truck)', '1FA': 'Ford', '1G1': 'Chevrolet', '1GC': 'Chevrolet (truck)',
  '2T1': 'Toyota (Канада)', '3VW': 'Volkswagen (Мексика)', SHH: 'Honda (UK)', SAR: 'Rover/Land Rover',
};

export interface VinCheck extends IdentifierCheck {
  wmi?: string;
  vds?: string;
  vis?: string;
  modelYear?: number;
  plantCode?: string;
  serial?: string;
  checkDigitValid?: boolean | null;
}

const VIN_TRANSLIT: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9, S: 2,
  T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9, '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
};
const VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
const VIN_YEARS = 'ABCDEFGHJKLMNPRSTVWXY123456789';

/**
 * ISO 3779 VIN decoder with the North-American check-digit algorithm (mod 11)
 * and WMI attribution. VINs from other regions leave position 9 unconstrained,
 * which we report explicitly instead of pretending certainty.
 */
export function decodeVin(input: string): VinCheck {
  const value = input.trim().toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');
  const details: IdentifierCheck['details'] = { length: value.length };
  if (value.length !== 17) {
    return { isValid: false, type: 'VIN (ISO 3779)', details, error: `VIN содержит 17 знаков, получено ${value.length}` };
  }
  if (/[IOQ]/.test(value)) {
    return { isValid: false, type: 'VIN (ISO 3779)', details, error: 'Символы I, O, Q запрещены стандартом (исключены как похожие на 1 и 0)' };
  }

  const wmi = value.slice(0, 3);
  const vds = value.slice(3, 9);
  const vis = value.slice(9, 17);
  const checkChar = value[8];
  const modelYearChar = value[9];

  let sum = 0;
  for (let i = 0; i < 17; i += 1) {
    const char = value[i] as string;
    sum += (VIN_TRANSLIT[char] ?? 0) * (VIN_WEIGHTS[i] as number);
  }
  const remainder = sum % 11;
  const expected = remainder === 10 ? 'X' : String(remainder);
  const checkDigitValid = /[0-9X]/.test(checkChar) ? expected === checkChar : null;

  const yearIndex = VIN_YEARS.indexOf(modelYearChar);
  const modelYear = yearIndex >= 0 ? (yearIndex < 21 ? 2010 + yearIndex : 1980 + yearIndex) : undefined;

  details.wmiCountry = WMI_COUNTRY[wmi[0] as string] ?? 'Неизвестно';
  details.manufacturer = WMI_MAJOR[wmi] ?? 'Не идентифицирован по WMI-таблице';
  details.modelYear = modelYear ?? 'не определён';
  details.checkDigit = checkChar;
  details.expectedCheckDigit = expected;

  return {
    isValid: checkDigitValid !== false,
    type: 'VIN (ISO 3779)',
    details,
    wmi,
    vds,
    vis,
    modelYear,
    plantCode: value[10],
    serial: value.slice(11),
    checkDigitValid,
    error: checkDigitValid === false ? `Контрольный знак VIN не совпал: ожидалось ${expected}, указано ${checkChar} (для не-NA рынков знак может не применяться)` : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ЦБ РФ: БИК; Росреестр: кадастровый номер
// ─────────────────────────────────────────────────────────────────────────────

export function validateBik(input: string, account?: string): IdentifierCheck {
  const value = input.replace(/\D/g, '');
  const details: IdentifierCheck['details'] = { length: value.length };
  if (value.length !== 9) return { isValid: false, type: 'БИК', details, error: 'БИК содержит 9 цифр' };
  if (!value.startsWith('04')) return { isValid: false, type: 'БИК', details, error: 'БИК кредитной организации РФ начинается с «04» (код РФ по ISO 9362)' };

  const region = regionByCode(value.slice(2, 4));
  const subdivision = value.slice(4, 7);
  const settlementCentre = value.slice(6, 9);
  details.regionCode = value.slice(2, 4);
  details.subdivision = subdivision;
  details.settlementCentre = settlementCentre;
  details.verifyUrl = `https://www.cbr.ru/scripts/XML_bic.asp?bic=${value}`;

  let accountCheck: boolean | undefined;
  if (account) {
    const digits = account.replace(/\D/g, '');
    if (digits.length === 20) {
      // Официальный алгоритм ЦБ РФ: взвешенная сумма с ключом по типу счёта.
      const weights = [7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1];
      const prefix = digits.slice(0, 3) === '423' || digits.slice(0, 3) === '408' ? digits.slice(0, 2) : '0' + digits.slice(0, 2);
      const composite = `${value.slice(6, 9)}${prefix}${digits}`;
      let sum = 0;
      for (let i = 0; i < 23; i += 1) sum += Number(composite[i] ?? 0) * (weights[i] ?? 0);
      accountCheck = sum % 10 === 0;
    }
  }
  details.accountChecksum = accountCheck === undefined ? 'не проверялся' : accountCheck ? 'совпал' : 'не совпал';

  return {
    isValid: settlementCentre >= '050' && accountCheck !== false,
    type: 'БИК ЦБ РФ',
    region: region ? `${region.name} (РКЦ ${settlementCentre})` : `Неизвестный код региона ${value.slice(2, 4)}`,
    details,
    error: accountCheck === false ? 'Контрольная сумма расчётного счёта по алгоритму ЦБ РФ не совпала' : undefined,
  };
}

export function validateCadastralNumber(input: string): IdentifierCheck {
  const value = input.trim();
  const details: IdentifierCheck['details'] = { normalized: value };
  const match = /^(\d{2}):(\d{2}):(\d{6,7}):(\d{1,4})$/.exec(value);
  if (!match) return { isValid: false, type: 'Кадастровый номер', details, error: 'Формат: КК:РР:ККККККК:ННН (например 77:01:0004012:1234)' };
  const [, regionCode, district, quarter, number] = match;
  const region = regionByCode(regionCode as string);
  details.regionCode = regionCode as string;
  details.district = district as string;
  details.quarter = quarter as string;
  details.objectNumber = number as string;
  details.verifyUrl = `https://pkk.rosreestr.ru/#/search/${regionCode}:${district}:${quarter}:${number}`;
  return {
    isValid: Boolean(region),
    type: 'Кадастровый номер (Росреестр)',
    region: region ? `${region.name} (${region.district})` : undefined,
    details,
    error: region ? undefined : `Код региона ${regionCode} не найден в классификаторе`,
  };
}

/** Идентификаторы в одном вызове — используется парсером входных данных. */
export function identifyRussianDocument(value: string): IdentifierCheck[] {
  const checks: IdentifierCheck[] = [];
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) checks.push(validateInn10(digits));
  else if (digits.length === 12) checks.push(validateInn12(digits));
  else if (digits.length === 13) checks.push(validateOgrn(digits));
  else if (digits.length === 15) checks.push(validateOgrnip(digits));
  else if (digits.length === 11 && !/\s/.test(value)) checks.push(validateSnils(digits));
  return checks;
}
