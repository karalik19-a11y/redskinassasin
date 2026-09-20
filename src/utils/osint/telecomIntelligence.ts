// ============================================================================
// REDSKIN ASSASSIN // TOMAHAWK OSINT - TELECOM & PHONE INTELLIGENCE
// Real Russian DEF Operator Code Routing, Timezones, Messengers & OSINT Links
// ============================================================================

export interface PhoneIntelligence {
  raw: string;
  e164: string;
  nationalFormatted: string;
  country: string;
  countryCode: string;
  operator: string;
  operatorCategory: 'Федеральный MNO' | 'MVNO Виртуальный' | 'Региональный' | 'Фиксированная связь' | 'Иностранный';
  region: string;
  timeZone: string;
  isValid: boolean;
  links: {
    telegramUrl: string;
    whatsappUrl: string;
    viberUrl: string;
    numbusterUrl: string;
    truecallerUrl: string;
    spravkaUrl: string;
  };
}

// Major Russian DEF Code Routing Matrix
const RUSSIAN_DEF_CODES: Record<string, { operator: string; category: PhoneIntelligence['operatorCategory']; region: string }> = {
  // MTS
  '910': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'Центральный ФО' },
  '911': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'Северо-Западный ФО' },
  '912': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'Уральский ФО' },
  '913': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'Сибирский ФО' },
  '914': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'Дальневосточный ФО' },
  '915': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'Центральный регион / Москва' },
  '916': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'г. Москва и Московская обл.' },
  '917': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'Поволжье / Центр' },
  '918': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'Южный ФО / Кавказ' },
  '919': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'Центр / Поволжье' },
  '980': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'Центральный ФО' },
  '981': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'Северо-Западный ФО' },
  '982': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'Уральский ФО' },
  '983': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'Сибирский ФО' },
  '984': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'Дальневосточный ФО' },
  '985': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'г. Москва и Московская обл.' },
  '986': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'Приволжский ФО' },
  '987': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'Поволжье' },
  '988': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'Северный Кавказ / Юг' },
  '989': { operator: 'ПАО «МТС»', category: 'Федеральный MNO', region: 'Южный ФО' },

  // Megafon
  '920': { operator: 'ПАО «МегаФон»', category: 'Федеральный MNO', region: 'Центральный регион' },
  '921': { operator: 'ПАО «МегаФон»', category: 'Федеральный MNO', region: 'Северо-Запад / СПб' },
  '922': { operator: 'ПАО «МегаФон»', category: 'Федеральный MNO', region: 'Уральский ФО' },
  '923': { operator: 'ПАО «МегаФон»', category: 'Федеральный MNO', region: 'Сибирский ФО' },
  '924': { operator: 'ПАО «МегаФон»', category: 'Федеральный MNO', region: 'Дальний Восток' },
  '925': { operator: 'ПАО «МегаФон»', category: 'Федеральный MNO', region: 'г. Москва и Московская обл.' },
  '926': { operator: 'ПАО «МегаФон»', category: 'Федеральный MNO', region: 'г. Москва и Московская обл.' },
  '927': { operator: 'ПАО «МегаФон»', category: 'Федеральный MNO', region: 'Поволжье' },
  '928': { operator: 'ПАО «МегаФон»', category: 'Федеральный MNO', region: 'Кавказ / Юг' },
  '929': { operator: 'ПАО «МегаФон»', category: 'Федеральный MNO', region: 'Федеральная емкость' },
  '930': { operator: 'ПАО «МегаФон»', category: 'Федеральный MNO', region: 'Центральный ФО' },
  '931': { operator: 'ПАО «МегаФон»', category: 'Федеральный MNO', region: 'Северо-Запад' },
  '932': { operator: 'ПАО «МегаФон»', category: 'Федеральный MNO', region: 'Урал' },
  '933': { operator: 'ПАО «МегаФон»', category: 'Федеральный MNO', region: 'Сибирь' },
  '936': { operator: 'ПАО «МегаФон»', category: 'Федеральный MNO', region: 'Москва и регионы' },
  '937': { operator: 'ПАО «МегаФон»', category: 'Федеральный MNO', region: 'Поволжье' },
  '938': { operator: 'ПАО «МегаФон»', category: 'Федеральный MNO', region: 'Южный ФО' },

  // Beeline (VimpelCom)
  '903': { operator: 'ПАО «ВымпелКом» (билайн)', category: 'Федеральный MNO', region: 'Москва и регионы РФ' },
  '905': { operator: 'ПАО «ВымпелКом» (билайн)', category: 'Федеральный MNO', region: 'Центр / Северо-Запад' },
  '906': { operator: 'ПАО «ВымпелКом» (билайн)', category: 'Федеральный MNO', region: 'Центр / Поволжье / Сибирь' },
  '909': { operator: 'ПАО «ВымпелКом» (билайн)', category: 'Федеральный MNO', region: 'Федеральная емкость' },
  '960': { operator: 'ПАО «ВымпелКом» (билайн)', category: 'Федеральный MNO', region: 'Центральный ФО' },
  '961': { operator: 'ПАО «ВымпелКом» (билайн)', category: 'Федеральный MNO', region: 'Юг / Сибирь' },
  '962': { operator: 'ПАО «ВымпелКом» (билайн)', category: 'Федеральный MNO', region: 'Кавказ / Восток' },
  '963': { operator: 'ПАО «ВымпелКом» (билайн)', category: 'Федеральный MNO', region: 'Москва / Центр' },
  '964': { operator: 'ПАО «ВымпелКом» (билайн)', category: 'Федеральный MNO', region: 'Северо-Запад / Восток' },
  '965': { operator: 'ПАО «ВымпелКом» (билайн)', category: 'Федеральный MNO', region: 'Москва и регионы РФ' },
  '966': { operator: 'ПАО «ВымпелКом» (билайн)', category: 'Федеральный MNO', region: 'Москва и регионы РФ' },
  '967': { operator: 'ПАО «ВымпелКом» (билайн)', category: 'Федеральный MNO', region: 'Москва и регионы РФ' },
  '968': { operator: 'ПАО «ВымпелКом» (билайн)', category: 'Федеральный MNO', region: 'Москва и Московская обл.' },
  '969': { operator: 'ПАО «ВымпелКом» (билайн)', category: 'Федеральный MNO', region: 'Москва и регионы' },

  // T2 / Tele2 / Rostelecom
  '900': { operator: 'ООО «Т2 Мобайл» / СберМобайл', category: 'Федеральный MNO', region: 'Федеральная емкость' },
  '901': { operator: 'ООО «Т2 Мобайл» / Ростелеком', category: 'Федеральный MNO', region: 'Москва и регионы' },
  '902': { operator: 'ООО «Т2 Мобайл» / Мотив / Смартс', category: 'Региональный', region: 'Регионы РФ' },
  '904': { operator: 'ООО «Т2 Мобайл» (T2)', category: 'Федеральный MNO', region: 'Центр / Северо-Запад / Сибирь' },
  '908': { operator: 'ООО «Т2 Мобайл» (T2)', category: 'Федеральный MNO', region: 'Центр / Урал / Сибирь' },
  '950': { operator: 'ООО «Т2 Мобайл» (T2)', category: 'Федеральный MNO', region: 'Северо-Запад / Сибирь' },
  '951': { operator: 'ООО «Т2 Мобайл» (T2)', category: 'Федеральный MNO', region: 'Центр / Поволжье / Сибирь' },
  '952': { operator: 'ООО «Т2 Мобайл» (T2)', category: 'Федеральный MNO', region: 'Северо-Запад / Юг / Урал' },
  '953': { operator: 'ООО «Т2 Мобайл» (T2)', category: 'Федеральный MNO', region: 'Северо-Запад / Сибирь' },
  '958': { operator: 'ООО «Т2 Мобайл» / Ростелеком (Т-Мобайл)', category: 'MVNO Виртуальный', region: 'Федеральная емкость' },
  '977': { operator: 'ООО «Т2 Мобайл» (T2)', category: 'Федеральный MNO', region: 'г. Москва и Московская обл.' },
  '991': { operator: 'ООО «Т2 Мобайл» / Ростелеком', category: 'Федеральный MNO', region: 'Федеральная емкость' },
  '992': { operator: 'ООО «Т2 Мобайл» (T2)', category: 'Федеральный MNO', region: 'Уральский регион' },
  '993': { operator: 'ООО «Т2 Мобайл» (T2)', category: 'Федеральный MNO', region: 'Сибирь' },
  '994': { operator: 'ООО «Т2 Мобайл» (T2)', category: 'Федеральный MNO', region: 'Дальний Восток' },
  '995': { operator: 'ООО «Т2 Мобайл» / Т-Мобайл (Тинькофф)', category: 'MVNO Виртуальный', region: 'Москва и регионы РФ' },
  '996': { operator: 'ООО «Скартел» (Yota) / Т2', category: 'MVNO Виртуальный', region: 'Москва и регионы' },

  // Yota / Skartel
  '999': { operator: 'ООО «Скартел» (Yota / МегаФон)', category: 'MVNO Виртуальный', region: 'Вся территория РФ (Безроуминг)' },

  // Moscow & SPb Landlines
  '495': { operator: 'ПАО «МГТС» / ПАО «Ростелеком»', category: 'Фиксированная связь', region: 'г. Москва' },
  '499': { operator: 'ПАО «МГТС» / ПАО «Ростелеком»', category: 'Фиксированная связь', region: 'г. Москва' },
  '496': { operator: 'ПАО «Ростелеком»', category: 'Фиксированная связь', region: 'Московская область' },
  '812': { operator: 'ПАО «Ростелеком»', category: 'Фиксированная связь', region: 'г. Санкт-Петербург' },
  '813': { operator: 'ПАО «Ростелеком»', category: 'Фиксированная связь', region: 'Ленинградская область' },
};

export function analyzePhoneNumber(input: string): PhoneIntelligence {
  const digits = input.replace(/\D/g, '');

  let e164 = '';
  let national = '';
  let country = 'Не определена';
  let countryCode = '';
  let operator = 'Оператор связи';
  let category: PhoneIntelligence['operatorCategory'] = 'Федеральный MNO';
  let region = 'Российская Федерация';
  let timeZone = 'UTC+3 (MSK)';
  let isValid = false;

  if (digits.startsWith('7') && digits.length === 11) {
    // Russian Number (+7 9XX XXX-XX-XX)
    e164 = `+${digits}`;
    country = 'Россия / Казахстан';
    countryCode = '+7';
    isValid = true;

    const def = digits.slice(1, 4);
    const p1 = digits.slice(4, 7);
    const p2 = digits.slice(7, 9);
    const p3 = digits.slice(9, 11);
    national = `+7 (${def}) ${p1}-${p2}-${p3}`;

    const defInfo = RUSSIAN_DEF_CODES[def];
    if (defInfo) {
      operator = defInfo.operator;
      category = defInfo.category;
      region = defInfo.region;
    } else {
      operator = 'Оператор связи РФ (DEF: ' + def + ')';
    }
  } else if (digits.startsWith('8') && digits.length === 11) {
    // Russian Domestic 8 (9XX) XXX-XX-XX
    const normalizedDigits = '7' + digits.slice(1);
    e164 = `+${normalizedDigits}`;
    country = 'Российская Федерация';
    countryCode = '+7';
    isValid = true;

    const def = normalizedDigits.slice(1, 4);
    const p1 = normalizedDigits.slice(4, 7);
    const p2 = normalizedDigits.slice(7, 9);
    const p3 = normalizedDigits.slice(9, 11);
    national = `+7 (${def}) ${p1}-${p2}-${p3}`;

    const defInfo = RUSSIAN_DEF_CODES[def];
    if (defInfo) {
      operator = defInfo.operator;
      category = defInfo.category;
      region = defInfo.region;
    }
  } else if (digits.length === 10 && (digits.startsWith('9') || digits.startsWith('4') || digits.startsWith('8'))) {
    // 10-digit Russian number without prefix
    const normalizedDigits = '7' + digits;
    e164 = `+${normalizedDigits}`;
    country = 'Российская Федерация';
    countryCode = '+7';
    isValid = true;

    const def = digits.slice(0, 3);
    const p1 = digits.slice(3, 6);
    const p2 = digits.slice(6, 8);
    const p3 = digits.slice(8, 10);
    national = `+7 (${def}) ${p1}-${p2}-${p3}`;

    const defInfo = RUSSIAN_DEF_CODES[def];
    if (defInfo) {
      operator = defInfo.operator;
      category = defInfo.category;
      region = defInfo.region;
    }
  } else if (digits.startsWith('375') && digits.length === 12) {
    e164 = `+${digits}`;
    country = 'Республика Беларусь';
    countryCode = '+375';
    operator = digits.startsWith('37529') ? 'МТС / A1 Беларусь' : 'Белтелеком';
    category = 'Иностранный';
    region = 'Беларусь';
    timeZone = 'UTC+3';
    isValid = true;
    national = `+375 (${digits.slice(3, 5)}) ${digits.slice(5, 8)}-${digits.slice(8, 10)}-${digits.slice(10, 12)}`;
  } else if (digits.startsWith('380') && digits.length === 12) {
    e164 = `+${digits}`;
    country = 'Украина';
    countryCode = '+380';
    operator = 'Kyivstar / Vodafone UA / lifecell';
    category = 'Иностранный';
    region = 'Украина';
    timeZone = 'UTC+2';
    isValid = true;
    national = `+380 (${digits.slice(3, 5)}) ${digits.slice(5, 8)}-${digits.slice(8, 10)}-${digits.slice(10, 12)}`;
  } else if (digits.startsWith('971') && (digits.length === 12 || digits.length === 11)) {
    e164 = `+${digits}`;
    country = 'ОАЭ (Дубай / Абу-Даби)';
    countryCode = '+971';
    operator = 'e& (Etisalat) / du Telecom';
    category = 'Иностранный';
    region = 'Объединенные Арабские Эмираты';
    timeZone = 'UTC+4 (GST)';
    isValid = true;
    national = `+971 ${digits.slice(3)}`;
  } else if (digits.startsWith('1') && digits.length === 11) {
    e164 = `+${digits}`;
    country = 'США / Канада (NANP)';
    countryCode = '+1';
    operator = 'Verizon / AT&T / T-Mobile USA';
    category = 'Иностранный';
    region = 'Северная Америка';
    timeZone = 'UTC-5 .. UTC-8';
    isValid = true;
    national = `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
  } else {
    e164 = digits ? `+${digits}` : '';
    national = input;
    operator = 'Международный номер';
    category = 'Иностранный';
  }

  const cleanDigits = e164.replace(/\D/g, '');

  return {
    raw: input,
    e164,
    nationalFormatted: national || input,
    country,
    countryCode,
    operator,
    operatorCategory: category,
    region,
    timeZone,
    isValid,
    links: {
      telegramUrl: `https://t.me/+${cleanDigits}`,
      whatsappUrl: `https://api.whatsapp.com/send?phone=${cleanDigits}`,
      viberUrl: `viber://chat?number=%2B${cleanDigits}`,
      numbusterUrl: `https://numbuster.com/ru/phone/+${cleanDigits}`,
      truecallerUrl: `https://www.truecaller.com/search/ru/+${cleanDigits}`,
      spravkaUrl: `https://ktogovorit.com/phone/${cleanDigits}`,
    },
  };
}
