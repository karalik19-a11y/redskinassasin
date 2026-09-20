// ============================================================================
// REDSKIN ASSASSIN // TOMAHAWK OSINT - REAL RUSSIAN ALGORITHMIC VALIDATORS
// 100% Real Mathematical Checksums & Algorithmic Validation
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  type: string;
  formatted: string;
  error?: string;
  details?: Record<string, any>;
}

// ----------------------------------------------------------------------------
// 1. RUSSIAN REGIONS DATABASE (ALL 89 SUBJECTS + SPECIAL CODES)
// ----------------------------------------------------------------------------
export interface RussianRegionInfo {
  code: string;
  name: string;
  capital: string;
  federalDistrict: string;
  carCodes: string[];
}

export const RUSSIAN_REGIONS: Record<string, RussianRegionInfo> = {
  '01': { code: '01', name: 'Республика Адыгея', capital: 'Майкоп', federalDistrict: 'Южный ФО', carCodes: ['01'] },
  '02': { code: '02', name: 'Республика Башкортостан', capital: 'Уфа', federalDistrict: 'Приволжский ФО', carCodes: ['02', '102', '702'] },
  '03': { code: '03', name: 'Республика Бурятия', capital: 'Улан-Удэ', federalDistrict: 'Дальневосточный ФО', carCodes: ['03'] },
  '04': { code: '04', name: 'Республика Алтай', capital: 'Горно-Алтайск', federalDistrict: 'Сибирский ФО', carCodes: ['04'] },
  '05': { code: '05', name: 'Республика Дагестан', capital: 'Махачкала', federalDistrict: 'Северо-Кавказский ФО', carCodes: ['05'] },
  '06': { code: '06', name: 'Республика Ингушетия', capital: 'Магас', federalDistrict: 'Северо-Кавказский ФО', carCodes: ['06'] },
  '07': { code: '07', name: 'Кабардино-Балкарская Республика', capital: 'Нальчик', federalDistrict: 'Северо-Кавказский ФО', carCodes: ['07'] },
  '08': { code: '08', name: 'Республика Калмыкия', capital: 'Элиста', federalDistrict: 'Южный ФО', carCodes: ['08'] },
  '09': { code: '09', name: 'Карачаево-Черкесская Республика', capital: 'Черкесск', federalDistrict: 'Северо-Кавказский ФО', carCodes: ['09'] },
  '10': { code: '10', name: 'Республика Карелия', capital: 'Петрозаводск', federalDistrict: 'Северо-Западный ФО', carCodes: ['10'] },
  '11': { code: '11', name: 'Республика Коми', capital: 'Сыктывкар', federalDistrict: 'Северо-Западный ФО', carCodes: ['11'] },
  '12': { code: '12', name: 'Республика Марий Эл', capital: 'Йошкар-Ола', federalDistrict: 'Приволжский ФО', carCodes: ['12'] },
  '13': { code: '13', name: 'Республика Мордовия', capital: 'Саранск', federalDistrict: 'Приволжский ФО', carCodes: ['13', '113'] },
  '14': { code: '14', name: 'Республика Саха (Якутия)', capital: 'Якутск', federalDistrict: 'Дальневосточный ФО', carCodes: ['14'] },
  '15': { code: '15', name: 'Республика Северная Осетия — Алания', capital: 'Владикавказ', federalDistrict: 'Северо-Кавказский ФО', carCodes: ['15'] },
  '16': { code: '16', name: 'Республика Татарстан', capital: 'Казань', federalDistrict: 'Приволжский ФО', carCodes: ['16', '116', '716'] },
  '17': { code: '17', name: 'Республика Тыва', capital: 'Кызыл', federalDistrict: 'Сибирский ФО', carCodes: ['17'] },
  '18': { code: '18', name: 'Удмуртская Республика', capital: 'Ижевск', federalDistrict: 'Приволжский ФО', carCodes: ['18', '118'] },
  '19': { code: '19', name: 'Республика Хакасия', capital: 'Абакан', federalDistrict: 'Сибирский ФО', carCodes: ['19'] },
  '20': { code: '20', name: 'Чеченская Республика', capital: 'Грозный', federalDistrict: 'Северо-Кавказский ФО', carCodes: ['20', '95'] },
  '21': { code: '21', name: 'Чувашская Республика', capital: 'Чебоксары', federalDistrict: 'Приволжский ФО', carCodes: ['21', '121'] },
  '22': { code: '22', name: 'Алтайский край', capital: 'Барнаул', federalDistrict: 'Сибирский ФО', carCodes: ['22', '122'] },
  '23': { code: '23', name: 'Краснодарский край', capital: 'Краснодар', federalDistrict: 'Южный ФО', carCodes: ['23', '93', '123', '193'] },
  '24': { code: '24', name: 'Красноярский край', capital: 'Красноярск', federalDistrict: 'Сибирский ФО', carCodes: ['24', '84', '88', '124'] },
  '25': { code: '25', name: 'Приморский край', capital: 'Владивосток', federalDistrict: 'Дальневосточный ФО', carCodes: ['25', '125'] },
  '26': { code: '26', name: 'Ставропольский край', capital: 'Ставрополь', federalDistrict: 'Северо-Кавказский ФО', carCodes: ['26', '126'] },
  '27': { code: '27', name: 'Хабаровский край', capital: 'Хабаровск', federalDistrict: 'Дальневосточный ФО', carCodes: ['27'] },
  '28': { code: '28', name: 'Амурская область', capital: 'Благовещенск', federalDistrict: 'Дальневосточный ФО', carCodes: ['28'] },
  '29': { code: '29', name: 'Архангельская область', capital: 'Архангельск', federalDistrict: 'Северо-Западный ФО', carCodes: ['29'] },
  '30': { code: '30', name: 'Астраханская область', capital: 'Астрахань', federalDistrict: 'Южный ФО', carCodes: ['30'] },
  '31': { code: '31', name: 'Белгородская область', capital: 'Белгород', federalDistrict: 'Центральный ФО', carCodes: ['31'] },
  '32': { code: '32', name: 'Брянская область', capital: 'Брянск', federalDistrict: 'Центральный ФО', carCodes: ['32'] },
  '33': { code: '33', name: 'Владимирская область', capital: 'Владимир', federalDistrict: 'Центральный ФО', carCodes: ['33'] },
  '34': { code: '34', name: 'Волгоградская область', capital: 'Волгоград', federalDistrict: 'Южный ФО', carCodes: ['34', '134'] },
  '35': { code: '35', name: 'Вологодская область', capital: 'Вологда', federalDistrict: 'Северо-Западный ФО', carCodes: ['35'] },
  '36': { code: '36', name: 'Воронежская область', capital: 'Воронеж', federalDistrict: 'Центральный ФО', carCodes: ['36', '136'] },
  '37': { code: '37', name: 'Ивановская область', capital: 'Иваново', federalDistrict: 'Центральный ФО', carCodes: ['37'] },
  '38': { code: '38', name: 'Иркутская область', capital: 'Иркутск', federalDistrict: 'Сибирский ФО', carCodes: ['38', '85', '138'] },
  '39': { code: '39', name: 'Калининградская область', capital: 'Калининград', federalDistrict: 'Северо-Западный ФО', carCodes: ['39', '91'] },
  '40': { code: '40', name: 'Калужская область', capital: 'Калуга', federalDistrict: 'Центральный ФО', carCodes: ['40'] },
  '41': { code: '41', name: 'Камчатский край', capital: 'Петропавловск-Камчатский', federalDistrict: 'Дальневосточный ФО', carCodes: ['41', '82'] },
  '42': { code: '42', name: 'Кемеровская область — Кузбасс', capital: 'Кемерово', federalDistrict: 'Сибирский ФО', carCodes: ['42', '142'] },
  '43': { code: '43', name: 'Кировская область', capital: 'Киров', federalDistrict: 'Приволжский ФО', carCodes: ['43'] },
  '44': { code: '44', name: 'Костромская область', capital: 'Кострома', federalDistrict: 'Центральный ФО', carCodes: ['44'] },
  '45': { code: '45', name: 'Курганская область', capital: 'Курган', federalDistrict: 'Уральский ФО', carCodes: ['45'] },
  '46': { code: '46', name: 'Курская область', capital: 'Курск', federalDistrict: 'Центральный ФО', carCodes: ['46'] },
  '47': { code: '47', name: 'Ленинградская область', capital: 'Гатчина', federalDistrict: 'Северо-Западный ФО', carCodes: ['47', '147'] },
  '48': { code: '48', name: 'Липецкая область', capital: 'Липецк', federalDistrict: 'Центральный ФО', carCodes: ['48'] },
  '49': { code: '49', name: 'Магаданская область', capital: 'Магадан', federalDistrict: 'Дальневосточный ФО', carCodes: ['49'] },
  '50': { code: '50', name: 'Московская область', capital: 'Красногорск', federalDistrict: 'Центральный ФО', carCodes: ['50', '90', '150', '190', '750', '790'] },
  '51': { code: '51', name: 'Мурманская область', capital: 'Мурманск', federalDistrict: 'Северо-Западный ФО', carCodes: ['51'] },
  '52': { code: '52', name: 'Нижегородская область', capital: 'Нижний Новгород', federalDistrict: 'Приволжский ФО', carCodes: ['52', '152'] },
  '53': { code: '53', name: 'Новгородская область', capital: 'Великий Новгород', federalDistrict: 'Северо-Западный ФО', carCodes: ['53'] },
  '54': { code: '54', name: 'Новосибирская область', capital: 'Новосибирск', federalDistrict: 'Сибирский ФО', carCodes: ['54', '154'] },
  '55': { code: '55', name: 'Омская область', capital: 'Омск', federalDistrict: 'Сибирский ФО', carCodes: ['55'] },
  '56': { code: '56', name: 'Оренбургская область', capital: 'Оренбург', federalDistrict: 'Приволжский ФО', carCodes: ['56', '156'] },
  '57': { code: '57', name: 'Орловская область', capital: 'Орёл', federalDistrict: 'Центральный ФО', carCodes: ['57'] },
  '58': { code: '58', name: 'Пензенская область', capital: 'Пенза', federalDistrict: 'Приволжский ФО', carCodes: ['58'] },
  '59': { code: '59', name: 'Пермский край', capital: 'Пермь', federalDistrict: 'Приволжский ФО', carCodes: ['59', '81', '159'] },
  '60': { code: '60', name: 'Псковская область', capital: 'Псков', federalDistrict: 'Северо-Западный ФО', carCodes: ['60'] },
  '61': { code: '61', name: 'Ростовская область', capital: 'Ростов-на-Дону', federalDistrict: 'Южный ФО', carCodes: ['61', '161', '761'] },
  '62': { code: '62', name: 'Рязанская область', capital: 'Рязань', federalDistrict: 'Центральный ФО', carCodes: ['62'] },
  '63': { code: '63', name: 'Самарская область', capital: 'Самара', federalDistrict: 'Приволжский ФО', carCodes: ['63', '163', '763'] },
  '64': { code: '64', name: 'Саратовская область', capital: 'Саратов', federalDistrict: 'Приволжский ФО', carCodes: ['64', '164'] },
  '65': { code: '65', name: 'Сахалинская область', capital: 'Южно-Сахалинск', federalDistrict: 'Дальневосточный ФО', carCodes: ['65'] },
  '66': { code: '66', name: 'Свердловская область', capital: 'Екатеринбург', federalDistrict: 'Уральский ФО', carCodes: ['66', '96', '196'] },
  '67': { code: '67', name: 'Смоленская область', capital: 'Смоленск', federalDistrict: 'Центральный ФО', carCodes: ['67'] },
  '68': { code: '68', name: 'Тамбовская область', capital: 'Тамбов', federalDistrict: 'Центральный ФО', carCodes: ['68'] },
  '69': { code: '69', name: 'Тверская область', capital: 'Тверь', federalDistrict: 'Центральный ФО', carCodes: ['69'] },
  '70': { code: '70', name: 'Томская область', capital: 'Томск', federalDistrict: 'Сибирский ФО', carCodes: ['70'] },
  '71': { code: '71', name: 'Тульская область', capital: 'Тула', federalDistrict: 'Центральный ФО', carCodes: ['71'] },
  '72': { code: '72', name: 'Тюменская область', capital: 'Тюмень', federalDistrict: 'Уральский ФО', carCodes: ['72', '172'] },
  '73': { code: '73', name: 'Ульяновская область', capital: 'Ульяновск', federalDistrict: 'Приволжский ФО', carCodes: ['73', '173'] },
  '74': { code: '74', name: 'Челябинская область', capital: 'Челябинск', federalDistrict: 'Уральский ФО', carCodes: ['74', '174', '774'] },
  '75': { code: '75', name: 'Забайкальский край', capital: 'Чита', federalDistrict: 'Дальневосточный ФО', carCodes: ['75', '80'] },
  '76': { code: '76', name: 'Ярославская область', capital: 'Ярославль', federalDistrict: 'Центральный ФО', carCodes: ['76'] },
  '77': { code: '77', name: 'г. Москва', capital: 'Москва', federalDistrict: 'Центральный ФО', carCodes: ['77', '97', '99', '177', '197', '199', '777', '797', '799', '977'] },
  '78': { code: '78', name: 'г. Санкт-Петербург', capital: 'Санкт-Петербург', federalDistrict: 'Северо-Западный ФО', carCodes: ['78', '98', '178', '198'] },
  '79': { code: '79', name: 'Еврейская автономная область', capital: 'Биробиджан', federalDistrict: 'Дальневосточный ФО', carCodes: ['79'] },
  '80': { code: '80', name: 'Донецкая Народная Республика', capital: 'Донецк', federalDistrict: 'Южный ФО', carCodes: ['80', '180'] },
  '81': { code: '81', name: 'Луганская Народная Республика', capital: 'Луганск', federalDistrict: 'Южный ФО', carCodes: ['81', '181'] },
  '82': { code: '82', name: 'Республика Крым', capital: 'Симферополь', federalDistrict: 'Южный ФО', carCodes: ['82'] },
  '83': { code: '83', name: 'Ненецкий автономный округ', capital: 'Нарьян-Мар', federalDistrict: 'Северо-Западный ФО', carCodes: ['83'] },
  '84': { code: '84', name: 'Херсонская область', capital: 'Геническ', federalDistrict: 'Южный ФО', carCodes: ['84', '184'] },
  '85': { code: '85', name: 'Запорожская область', capital: 'Мелитополь', federalDistrict: 'Южный ФО', carCodes: ['85', '185'] },
  '86': { code: '86', name: 'Ханты-Мансийский АО — Югра', capital: 'Ханты-Мансийск', federalDistrict: 'Уральский ФО', carCodes: ['86', '186'] },
  '87': { code: '87', name: 'Чукотский автономный округ', capital: 'Анадырь', federalDistrict: 'Дальневосточный ФО', carCodes: ['87'] },
  '89': { code: '89', name: 'Ямало-Ненецкий автономный округ', capital: 'Салехард', federalDistrict: 'Уральский ФО', carCodes: ['89'] },
  '92': { code: '92', name: 'г. Севастополь', capital: 'Севастополь', federalDistrict: 'Южный ФО', carCodes: ['92'] },
  '99': { code: '99', name: 'г. Байконур (Спецтерритория)', capital: 'Байконур', federalDistrict: 'Особый статус', carCodes: ['94'] },
};

// ----------------------------------------------------------------------------
// 2. INN (ИНН) VALIDATOR (10-digit Legal & 12-digit Individual)
// ----------------------------------------------------------------------------
export function validateINN(input: string): ValidationResult {
  const inn = input.replace(/\D/g, '');

  if (inn.length !== 10 && inn.length !== 12) {
    return {
      isValid: false,
      type: 'ИНН',
      formatted: inn,
      error: 'ИНН должен содержать ровно 10 цифр (ЮЛ) или 12 цифр (ФЛ/ИП)',
    };
  }

  const regionCode = inn.substring(0, 2);
  const inspectionCode = inn.substring(2, 4);
  const regionInfo = RUSSIAN_REGIONS[regionCode] || { name: `Регион ФНС №${regionCode}`, federalDistrict: 'РФ' };

  if (inn.length === 10) {
    // 10-digit INN: Legal Entity
    const coefficients = [2, 4, 10, 3, 5, 9, 4, 6, 8, 0];
    const sum = coefficients.reduce((acc, coef, idx) => acc + coef * Number(inn[idx]), 0);
    const checkDigit = (sum % 11) % 10;
    const isValid = checkDigit === Number(inn[9]);

    return {
      isValid,
      type: 'ИНН Юридического Лица (10 знаков)',
      formatted: inn,
      error: isValid ? undefined : `Контрольная сумма не совпадает: ожидается ${checkDigit}, получено ${inn[9]}`,
      details: {
        entityType: 'Юридическое лицо (Организация, ООО, АО)',
        regionCode,
        regionName: regionInfo.name,
        inspectionCode: `${regionCode}${inspectionCode}`,
        checkDigitExpected: checkDigit,
        checkDigitActual: Number(inn[9]),
        egrulSearchUrl: `https://egrul.nalog.ru/index.html?query=${inn}`,
        rusprofileUrl: `https://www.rusprofile.ru/search?query=${inn}`,
        fnsBusinessUrl: `https://pb.nalog.ru/search.html#search-result?mode=quick&page=1&pageSize=10&querySearch=${inn}`,
      },
    };
  } else {
    // 12-digit INN: Physical Person / Sole Proprietor
    const coef1 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8, 0];
    const coef2 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8, 0];

    const sum1 = coef1.reduce((acc, coef, idx) => acc + coef * Number(inn[idx]), 0);
    const checkDigit1 = (sum1 % 11) % 10;

    const sum2 = coef2.reduce((acc, coef, idx) => acc + coef * Number(inn[idx]), 0);
    const checkDigit2 = (sum2 % 11) % 10;

    const isValid = checkDigit1 === Number(inn[10]) && checkDigit2 === Number(inn[11]);

    return {
      isValid,
      type: 'ИНН Физического Лица / ИП (12 знаков)',
      formatted: `${inn.slice(0, 4)} ${inn.slice(4, 8)} ${inn.slice(8, 12)}`,
      error: isValid
        ? undefined
        : `Контрольные суммы не сходятся: d11=${checkDigit1} (факт ${inn[10]}), d12=${checkDigit2} (факт ${inn[11]})`,
      details: {
        entityType: 'Физическое лицо / Индивидуальный предприниматель (ИП)',
        regionCode,
        regionName: regionInfo.name,
        inspectionCode: `${regionCode}${inspectionCode}`,
        checkDigit1,
        checkDigit2,
        fnsBusinessUrl: `https://pb.nalog.ru/search.html#search-result?mode=quick&page=1&pageSize=10&querySearch=${inn}`,
        fsspSearchUrl: `https://fssp.gov.ru/iss/ip/`,
      },
    };
  }
}

// ----------------------------------------------------------------------------
// 3. SNILS (СНИЛС) VALIDATOR
// ----------------------------------------------------------------------------
export function validateSNILS(input: string): ValidationResult {
  const digits = input.replace(/\D/g, '');

  if (digits.length !== 11) {
    return {
      isValid: false,
      type: 'СНИЛС',
      formatted: input,
      error: 'СНИЛС должен состоять ровно из 11 цифр (XXX-XXX-XXX YY)',
    };
  }

  const formatted = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)} ${digits.slice(9, 11)}`;
  const mainPart = digits.slice(0, 9);
  const checkDigits = Number(digits.slice(9, 11));
  const mainNumber = Number(mainPart);

  // According to PFR rules: SNILS <= 001-001-998 have no check sum
  if (mainNumber <= 1001998) {
    return {
      isValid: true,
      type: 'СНИЛС (Архивный фонд)',
      formatted,
      details: {
        mainNumber,
        checkSum: checkDigits,
        note: 'Номер из раннего диапазона Пенсионного Фонда (до 001-001-998)',
      },
    };
  }

  // Calculate checksum: sum = d1*9 + d2*8 + ... + d9*1
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(digits[i]) * (9 - i);
  }

  let expectedCheck = 0;
  if (sum < 100) {
    expectedCheck = sum;
  } else if (sum === 100 || sum === 101) {
    expectedCheck = 0;
  } else {
    const rem = sum % 101;
    if (rem < 100) {
      expectedCheck = rem;
    } else if (rem === 100 || rem === 101) {
      expectedCheck = 0;
    }
  }

  const isValid = expectedCheck === checkDigits;

  return {
    isValid,
    type: 'СНИЛС РФ',
    formatted,
    error: isValid
      ? undefined
      : `Ошибка контрольной суммы СНИЛС: вычислено ${String(expectedCheck).padStart(2, '0')}, указано ${String(checkDigits).padStart(2, '0')}`,
    details: {
      rawDigits: digits,
      calculatedSum: sum,
      expectedCheck: String(expectedCheck).padStart(2, '0'),
      actualCheck: String(checkDigits).padStart(2, '0'),
    },
  };
}

// ----------------------------------------------------------------------------
// 4. OGRN / OGRNIP (ОГРН / ОГРНИП) VALIDATOR
// ----------------------------------------------------------------------------
export function validateOGRN(input: string): ValidationResult {
  const digits = input.replace(/\D/g, '');

  if (digits.length === 13) {
    // OGRN (Legal Entity)
    const first12 = BigInt(digits.slice(0, 12));
    const expectedCheck = Number(first12 % 11n % 10n);
    const actualCheck = Number(digits[12]);
    const isValid = expectedCheck === actualCheck;

    const sign = digits[0];
    const year = '20' + digits.slice(1, 3);
    const regionCode = digits.slice(3, 5);
    const region = RUSSIAN_REGIONS[regionCode]?.name || `Регион ${regionCode}`;

    return {
      isValid,
      type: 'ОГРН Юридического Лица (13 знаков)',
      formatted: digits,
      error: isValid ? undefined : `Контрольная цифра не совпадает: вычислено ${expectedCheck}, в номере ${actualCheck}`,
      details: {
        signType: sign === '1' || sign === '5' ? 'Юридическое лицо' : sign === '2' ? 'Госучреждение' : 'Прочее',
        registrationYear: year,
        regionCode,
        regionName: region,
        egrulSearchUrl: `https://egrul.nalog.ru/index.html?query=${digits}`,
      },
    };
  } else if (digits.length === 15) {
    // OGRNIP (Individual Entrepreneur)
    const first14 = BigInt(digits.slice(0, 14));
    const expectedCheck = Number(first14 % 13n % 10n);
    const actualCheck = Number(digits[14]);
    const isValid = expectedCheck === actualCheck;

    const year = '20' + digits.slice(1, 3);
    const regionCode = digits.slice(3, 5);
    const region = RUSSIAN_REGIONS[regionCode]?.name || `Регион ${regionCode}`;

    return {
      isValid,
      type: 'ОГРНИП Индивидуального Предпринимателя (15 знаков)',
      formatted: digits,
      error: isValid ? undefined : `Контрольная цифра не совпадает: вычислено ${expectedCheck}, в номере ${actualCheck}`,
      details: {
        entityType: 'Индивидуальный предприниматель',
        registrationYear: year,
        regionCode,
        regionName: region,
        egrulSearchUrl: `https://egrul.nalog.ru/index.html?query=${digits}`,
      },
    };
  }

  return {
    isValid: false,
    type: 'ОГРН/ОГРНИП',
    formatted: digits,
    error: 'Номер должен содержать 13 цифр (ОГРН ЮЛ) или 15 цифр (ОГРНИП ИП)',
  };
}

// ----------------------------------------------------------------------------
// 5. PASSPORT RF VALIDATOR & OKATO PARSER
// ----------------------------------------------------------------------------
export function validatePassportRF(input: string): ValidationResult {
  const digits = input.replace(/\D/g, '');

  if (digits.length !== 10) {
    return {
      isValid: false,
      type: 'Паспорт гражданина РФ',
      formatted: input,
      error: 'Серия и номер паспорта РФ должны содержать ровно 10 цифр (серия 4 цифры, номер 6 цифр)',
    };
  }

  const series = digits.slice(0, 4);
  const number = digits.slice(4, 10);
  const okatoCode = series.slice(0, 2);
  const issueYearShort = Number(series.slice(2, 4));

  const regionInfo = RUSSIAN_REGIONS[okatoCode];
  const currentYearShort = new Date().getFullYear() % 100;

  // Approximate year of issue
  let issueYear = issueYearShort <= currentYearShort ? 2000 + issueYearShort : 1900 + issueYearShort;
  const isYearPlausible = issueYear >= 1997 && issueYear <= new Date().getFullYear();

  const formatted = `${series.slice(0, 2)} ${series.slice(2, 4)} ${number}`;
  const isValid = Boolean(regionInfo) && isYearPlausible;

  return {
    isValid,
    type: 'Паспорт гражданина РФ',
    formatted,
    error: !regionInfo
      ? `Неизвестный код региона ОКАТО в серии паспорта: ${okatoCode}`
      : !isYearPlausible
      ? `Подозрительный год выпуска паспорта по серии (${issueYear})`
      : undefined,
    details: {
      series: `${series.slice(0, 2)} ${series.slice(2, 4)}`,
      number,
      okatoRegionCode: okatoCode,
      regionName: regionInfo ? regionInfo.name : 'Не определен',
      federalDistrict: regionInfo?.federalDistrict || 'Н/Д',
      issueYearEstimated: issueYear,
      mvdCheckUrl: 'https://мвд.рф/сервисы-гувм/проверка-паспорта',
    },
  };
}

// ----------------------------------------------------------------------------
// 6. RUSSIAN CAR LICENSE PLATE (ГРЗ) PARSER & REGION MAPPER
// ----------------------------------------------------------------------------
const RUS_TO_ENG: Record<string, string> = {
  A: 'А', B: 'В', E: 'Е', K: 'К', M: 'М', H: 'Н', O: 'О', P: 'Р', C: 'С', T: 'Т', Y: 'У', X: 'Х',
};

export function parseRussianPlate(input: string): ValidationResult {
  let clean = input.toUpperCase().replace(/\s+/g, '').replace(/RUS/i, '');

  // Convert Latin to Cyrillic equivalents
  let converted = '';
  for (const ch of clean) {
    converted += RUS_TO_ENG[ch] || ch;
  }

  // Standard Type 1: A 123 AA 77 or A 123 AA 777
  const type1Regex = /^([АВЕКМНОРСТУХ])(\d{3})([АВЕКМНОРСТУХ]{2})(\d{2,3})$/;
  const match1 = converted.match(type1Regex);

  if (match1) {
    const [, letter1, num, letters2, regionCode] = match1;
    const formatted = `${letter1} ${num} ${letters2} ${regionCode}`;

    // Find region
    let regionMatch: RussianRegionInfo | undefined;
    for (const key in RUSSIAN_REGIONS) {
      if (RUSSIAN_REGIONS[key].carCodes.includes(regionCode)) {
        regionMatch = RUSSIAN_REGIONS[key];
        break;
      }
    }

    const isSpecialSeries =
      (letter1 + letters2 === 'АМР' && regionCode === '97') ||
      (letter1 + letters2 === 'ЕКХ') ||
      (letter1 + letters2 === 'СКР') ||
      (letter1 + letters2 === 'ССС');

    return {
      isValid: Boolean(regionMatch),
      type: 'Госномер ТС РФ (Тип 1 Стандарт)',
      formatted,
      error: regionMatch ? undefined : `Код региона "${regionCode}" не найден в реестре ГИБДД РФ`,
      details: {
        seriesLetters: `${letter1}${letters2}`,
        digits: num,
        regionCode,
        regionName: regionMatch ? regionMatch.name : 'Неизвестный регион',
        federalDistrict: regionMatch?.federalDistrict || 'Н/Д',
        isSpecialSeries,
        specialNotes: isSpecialSeries ? 'Специальная ведомственная серия (АМР/ЕКХ/СКР)' : 'Гражданская серия',
        gibddCheckUrl: 'https://xn--b1afbneg2a.xn--p1ai/check/auto',
        avtocodUrl: `https://avtocod.ru/`,
      },
    };
  }

  // Check Type 1B (Taxis: AA 123 77)
  const taxiRegex = /^([АВЕКМНОРСТУХ]{2})(\d{3})(\d{2,3})$/;
  const matchTaxi = converted.match(taxiRegex);
  if (matchTaxi) {
    const [, letters, num, regionCode] = matchTaxi;
    let regionMatch: RussianRegionInfo | undefined;
    for (const key in RUSSIAN_REGIONS) {
      if (RUSSIAN_REGIONS[key].carCodes.includes(regionCode)) {
        regionMatch = RUSSIAN_REGIONS[key];
        break;
      }
    }

    return {
      isValid: Boolean(regionMatch),
      type: 'Госномер ТС РФ (Тип 1Б Общественный транспорт / Такси)',
      formatted: `${letters} ${num} ${regionCode}`,
      details: {
        category: 'Такси / Пассажирский транспорт',
        regionCode,
        regionName: regionMatch?.name || 'Н/Д',
      },
    };
  }

  return {
    isValid: false,
    type: 'Госномер РФ',
    formatted: input,
    error: 'Формат не соответствует ГРЗ РФ (Пример: А 777 АА 77 или А777АА777)',
  };
}

// ----------------------------------------------------------------------------
// 7. VIN (VEHICLE IDENTIFICATION NUMBER) DECODER & CHECKSUM
// ----------------------------------------------------------------------------
const VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
const VIN_CHAR_VALUES: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
};

const VIN_YEAR_MAP: Record<string, number> = {
  A: 2010, B: 2011, C: 2012, D: 2013, E: 2014, F: 2015, G: 2016, H: 2017,
  J: 2018, K: 2019, L: 2020, M: 2021, N: 2022, P: 2023, R: 2024, S: 2025, T: 2026,
  V: 2027, W: 2028, X: 2029, Y: 2030,
  '1': 2001, '2': 2002, '3': 2003, '4': 2004, '5': 2005, '6': 2006, '7': 2007, '8': 2008, '9': 2009,
};

const WMI_DATABASE: Record<string, { country: string; brand: string }> = {
  WBA: { country: 'Германия', brand: 'BMW' },
  WBS: { country: 'Германия', brand: 'BMW M' },
  WDB: { country: 'Германия', brand: 'Mercedes-Benz' },
  WDD: { country: 'Германия', brand: 'Mercedes-Benz' },
  WAU: { country: 'Германия', brand: 'Audi' },
  WVW: { country: 'Германия', brand: 'Volkswagen' },
  WP0: { country: 'Германия', brand: 'Porsche' },
  XTA: { country: 'Россия', brand: 'АвтоВАЗ (Lada)' },
  XTC: { country: 'Россия', brand: 'КАМАЗ' },
  X7L: { country: 'Россия', brand: 'Renault Россия' },
  Z94: { country: 'Россия', brand: 'Hyundai / Kia Motors Rus' },
  XW8: { country: 'Россия', brand: 'Volkswagen Group Rus (Калуга)' },
  JTD: { country: 'Япония', brand: 'Toyota' },
  JTM: { country: 'Япония', brand: 'Toyota' },
  JMB: { country: 'Япония', brand: 'Mitsubishi' },
  JN1: { country: 'Япония', brand: 'Nissan' },
  KMH: { country: 'Южная Корея', brand: 'Hyundai' },
  KNA: { country: 'Южная Корея', brand: 'Kia' },
  SAL: { country: 'Великобритания', brand: 'Land Rover' },
  SAJ: { country: 'Великобритания', brand: 'Jaguar' },
  SCB: { country: 'Великобритания', brand: 'Bentley' },
  ZFF: { country: 'Италия', brand: 'Ferrari' },
  ZAR: { country: 'Италия', brand: 'Alfa Romeo' },
  YV1: { country: 'Швеция', brand: 'Volvo' },
  '1HG': { country: 'США', brand: 'Honda USA' },
  '1FA': { country: 'США', brand: 'Ford USA' },
  '5YJ': { country: 'США', brand: 'Tesla' },
  LVG: { country: 'Китай', brand: 'Geely' },
  LGB: { country: 'Китай', brand: 'Chery / Exeed' },
  LHG: { country: 'Китай', brand: 'Honda China' },
  LFP: { country: 'Китай', brand: 'FAW' },
  LPA: { country: 'Китай', brand: 'Changan' },
  LB3: { country: 'Китай', brand: 'Geely / Zeekr' },
};

export function decodeVIN(input: string): ValidationResult {
  const clean = input.toUpperCase().replace(/[\s-]/g, '');

  if (clean.length !== 17) {
    return {
      isValid: false,
      type: 'VIN Номер ТС',
      formatted: clean,
      error: `Длина VIN должна быть ровно 17 символов (введено ${clean.length})`,
    };
  }

  // Forbidden letters in VIN: I, O, Q
  if (/[IOQ]/.test(clean)) {
    return {
      isValid: false,
      type: 'VIN Номер ТС',
      formatted: clean,
      error: 'VIN содержит запрещенные стандартом ISO 3779 символы (I, O или Q)',
    };
  }

  // Checksum calculation (ISO 3779 / US standard)
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const val = VIN_CHAR_VALUES[clean[i]];
    if (val === undefined) {
      return { isValid: false, type: 'VIN', formatted: clean, error: `Недопустимый символ: ${clean[i]}` };
    }
    sum += val * VIN_WEIGHTS[i];
  }
  const checkMod = sum % 11;
  const expectedCheck = checkMod === 10 ? 'X' : String(checkMod);
  const actualCheck = clean[8];

  // WMI
  const wmi = clean.substring(0, 3);
  const wmiInfo = WMI_DATABASE[wmi] || { country: 'Международный', brand: 'Производитель WMI: ' + wmi };
  const modelYearChar = clean[9];
  const modelYear = VIN_YEAR_MAP[modelYearChar] || 'Не определен';
  const plantCode = clean[10];
  const sequentialNum = clean.substring(11);

  return {
    isValid: true,
    type: 'VIN (Vehicle Identification Number)',
    formatted: clean,
    details: {
      wmi,
      manufacturer: wmiInfo.brand,
      originCountry: wmiInfo.country,
      vds: clean.substring(3, 8),
      checkDigit: actualCheck,
      isNorthAmericanCheckValid: actualCheck === expectedCheck,
      modelYear,
      modelYearCode: modelYearChar,
      assemblyPlantCode: plantCode,
      serialNumber: sequentialNum,
      gibddCheckUrl: `https://xn--b1afbneg2a.xn--p1ai/check/auto`,
      avtocodUrl: `https://avtocod.ru/proverkaavto/${clean}`,
      vinInfoUrl: `https://vin.info/${clean}`,
    },
  };
}

// ----------------------------------------------------------------------------
// 8. BIK (БИК) RUSSIAN BANK IDENTIFIER VALIDATOR
// ----------------------------------------------------------------------------
const TOP_RUSSIAN_BANKS: Record<string, string> = {
  '044525225': 'ПАО СБЕРБАНК (г. Москва)',
  '044525700': 'АО "АЛЬФА-БАНК" (г. Москва)',
  '044525974': 'АО "ТИНЬКОФФ БАНК" / Т-БАНК (г. Москва)',
  '044525187': 'Банк ВТБ (ПАО) (г. Москва)',
  '044525823': 'Банк ГПБ (АО) ГАЗПРОМБАНК (г. Москва)',
  '044525703': 'АО "РАЙФФАЙЗЕНБАНК" (г. Москва)',
  '044525985': 'ПАО "МОСКОВСКИЙ КРЕДИТНЫЙ БАНК" (МКБ)',
  '044525745': 'ПАО "ПРОМСВЯЗЬБАНК" (ПСБ)',
  '044525411': 'ПАО "БАНК УРАЛСИБ"',
  '044525659': 'АО ЮНИКРЕДИТ БАНК',
  '044525999': 'АО "ТОЧКА" (г. Москва)',
  '044030653': 'ПАО "БАНК САНКТ-ПЕТЕРБУРГ"',
  '044525400': 'ОЗОН БАНК (ООО "Озон Банк")',
  '044525388': 'ЯНДЕКС БАНК (АО "Яндекс Банк")',
};

export function validateBIK(input: string): ValidationResult {
  const digits = input.replace(/\D/g, '');

  if (digits.length !== 9) {
    return {
      isValid: false,
      type: 'БИК Банка РФ',
      formatted: digits,
      error: 'БИК должен состоять ровно из 9 цифр',
    };
  }

  if (!digits.startsWith('04')) {
    return {
      isValid: false,
      type: 'БИК Банка РФ',
      formatted: digits,
      error: 'БИК участников расчетов РФ всегда начинается с "04" (код РФ)',
    };
  }

  const regionCode = digits.substring(2, 4);
  const region = RUSSIAN_REGIONS[regionCode]?.name || `Регион №${regionCode}`;
  const knownBank = TOP_RUSSIAN_BANKS[digits];

  return {
    isValid: true,
    type: 'БИК (Банковский идентификационный код)',
    formatted: digits,
    details: {
      bik: digits,
      countryCode: '04 (Россия)',
      regionCode,
      regionName: region,
      bankName: knownBank || 'Кредитная организация ЦБ РФ',
      cbrUrl: `https://www.cbr.ru/banking_sector/credit/`,
    },
  };
}
