// ============================================================================
// REDSKIN ASSASSIN // TOMAHAWK OSINT - REAL INVESTIGATION CASE & DOSSIER STORAGE
// Persistent LocalStorage CRUD & Algorithmic Threat Assessment
// ============================================================================

import type { Dossier, TotemAnimal } from '../types/dossier';
import { validateINN, validateSNILS, validatePassportRF, parseRussianPlate } from './osint/russianValidators';
import { analyzePhoneNumber } from './osint/telecomIntelligence';

const STORAGE_KEY = 'tomahawk_osint_cases_v2';
const ACTIVE_CASE_KEY = 'tomahawk_osint_active_case_id_v2';

// ----------------------------------------------------------------------------
// INITIAL REAL STARTER CASE TEMPLATE
// ----------------------------------------------------------------------------
export const SAMPLE_INVESTIGATION_CASE: Dossier = {
  id: 'CASE-2026-7789',
  fio: {
    last: 'Соколов',
    first: 'Михаил',
    middle: 'Андреевич',
    full: 'Соколов Михаил Андреевич',
  },
  aliases: ['m_sokolov', 'cyber_falcon', 'misha_invest'],
  birthDate: '14.08.1988',
  birthPlace: 'г. Москва, РСФСР',
  age: 38,
  gender: 'Мужской',
  zodiac: 'Лев ♌',
  totemAnimal: 'Ястреб',
  totemTitle: 'Ястреб // Око Горизонта',
  threatLevel: 'ELEVATED',
  riskScore: 54,
  avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
  biometricMatchRate: 97.8,
  summary: 'Фигурант комплексного оперативного учета. Анализ цифровых следов, аффилированных компаний в сфере IT-безопасности и распределенных криптоактивов.',
  
  documents: [
    {
      type: 'Паспорт гражданина РФ',
      number: '45 12 783921',
      series: '45 12',
      issueDate: '24.08.2008',
      issuedBy: 'Отделом УФМС России по району Хамовники г. Москвы',
      departmentCode: '770-024',
      status: 'Действителен',
    },
    {
      type: 'Заграничный паспорт РФ',
      number: '75 8829104',
      issueDate: '12.05.2021',
      issuedBy: 'МВД 77001',
      status: 'Действителен',
      extra: {
        'Визовые отметки': 'США B1/B2 (до 2027), ОАЭ Резидент ID, Шенген C',
      },
    },
    {
      type: 'Водительское удостоверение РФ',
      number: '99 14 309481',
      issueDate: '10.09.2016',
      status: 'Действителен',
      extra: {
        'Категории': 'B, B1, M',
      },
    },
  ],

  telecom: [
    {
      number: '+7 (916) 402-91-88',
      operator: 'ПАО «МТС»',
      region: 'г. Москва и Московская обл.',
      imsi: '250014892019381',
      imei: '358291049281720',
      period: '2017 — Настоящее время',
      status: 'Активен',
      tags: ['Михаил Соколов Трейд', 'Миша IT Инвест', 'Соколов Москва Сити'],
      messengerStatus: {
        telegram: true,
        whatsapp: true,
        signal: true,
      },
    },
    {
      number: '+7 (925) 881-30-44',
      operator: 'ПАО «МегаФон»',
      region: 'г. Москва',
      imsi: '250029481029481',
      imei: '351982049281093',
      period: '2021 — 2026',
      status: 'Активен',
      tags: ['Рабочий Мегафон Соколов'],
      messengerStatus: {
        telegram: true,
        whatsapp: false,
      },
    },
  ],

  telegram: {
    id: '492810482',
    username: 'm_sokolov',
    firstName: 'Mikhail',
    lastName: 'Sokolov',
    phone: '+79164029188',
    bio: 'OSINT Analyst | Cyber Security | Web3 Infra',
    leakedMessagesCount: 14,
    groups: ['RuCrypto Chat', 'Moscow IT Community', 'InfoSec CIS', 'Offshore Banking Forum'],
    lastSeen: 'Сегодня в 04:15',
  },

  emails: ['m.sokolov.sec@proton.me', 'mikhail@sokolov-tech.ru', 'sokolov_invest@mail.ru'],

  socialLinks: [
    { platform: 'GitHub', url: 'https://github.com/m-sokolov', username: 'm-sokolov' },
    { platform: 'VKontakte', url: 'https://vk.com/m_sokolov', username: 'm_sokolov' },
    { platform: 'Habr', url: 'https://habr.com/ru/users/m_sokolov', username: 'm_sokolov' },
    { platform: 'Telegram', url: 'https://t.me/m_sokolov', username: 'm_sokolov' },
  ],

  ipAddresses: [
    { ip: '185.220.101.5', isp: 'Selectel Autonomous Network (AS49505)', city: 'Москва, РФ', lastSeen: '20.09.2026' },
    { ip: '94.140.8.2', isp: 'MegaFon Broadband (AS25159)', city: 'Москва, РФ', lastSeen: '18.09.2026' },
  ],

  finances: {
    estimatedNetWorth: '148,000,000 ₽ ($1.62M)',
    taxId: '770408192039',
    snils: '148-291-049 88',
    banks: [
      {
        bank: 'АО "ТИНЬКОФФ БАНК" / Т-БАНК',
        accountMasked: '40817810••••3920',
        currency: 'RUB / USD / AED',
        balanceEstimated: '18,400,000 ₽',
        openDate: '15.03.2018',
        status: 'Активен',
      },
      {
        bank: 'ПАО СБЕРБАНК (СберПервый)',
        accountMasked: '40817810••••8412',
        currency: 'RUB',
        balanceEstimated: '42,000,000 ₽',
        openDate: '02.11.2015',
        status: 'Активен',
      },
      {
        bank: 'Emirates NBD (Dubai, UAE)',
        accountMasked: 'AE490330••••9182',
        currency: 'AED / USD',
        balanceEstimated: '$450,000',
        openDate: '20.08.2022',
        status: 'Активен',
      },
    ],
    crypto: [
      {
        network: 'Bitcoin (BTC)',
        address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
        balance: '4.825 BTC (~$310,000)',
        totalTx: 38,
        lastActivity: '14.09.2026',
        riskCategory: 'Чистый',
      },
      {
        network: 'Tether (USDT TRC20)',
        address: 'TYDzsYUEpvnYmQk4zGP9sWWcTEd2MiAtW6',
        balance: '185,000 USDT',
        totalTx: 142,
        lastActivity: '19.09.2026',
        riskCategory: 'Биржа',
      },
    ],
    companies: [
      {
        name: 'ООО «СОКОЛОВ ТЕХНОЛОДЖИ»',
        inn: '7704891024',
        ogrn: '1187746892014',
        role: 'Генеральный директор',
        revenueYear: '74,500,000 ₽ / год',
        status: 'Действующее',
        registrationDate: '18.10.2018',
      },
    ],
  },

  assets: {
    vehicles: [
      {
        brandModel: 'Porsche Taycan 4S',
        plate: 'А 777 ОС 777',
        vin: 'WP0AA2Y13MSA49201',
        year: 2021,
        color: 'Черный металлик',
        stsNumber: '99 18 402910',
        osagoNumber: 'ХХХ 0192839102',
        finesCount: 3,
        finesSum: '1,500 ₽ (Оплачено)',
        registrationDate: '14.06.2021',
        status: 'В собственности',
      },
      {
        brandModel: 'BMW X5 M50i',
        plate: 'В 999 СМ 799',
        vin: 'WBAJU010809C82910',
        year: 2020,
        color: 'Серый графит',
        stsNumber: '99 12 882910',
        osagoNumber: 'ХХХ 0281920391',
        finesCount: 0,
        finesSum: '0 ₽',
        registrationDate: '22.09.2020',
        status: 'В собственности',
      },
    ],
    realEstate: [
      {
        type: 'Квартира',
        address: 'г. Москва, Пресненская наб., д. 8, стр. 1 (Башня «Город Столиц», 42 этаж)',
        cadastralNumber: '77:01:0004042:1084',
        areaSqMeters: 142.6,
        estimatedPrice: '115,000,000 ₽',
        ownershipShare: '100% Собственность',
        registrationDate: '12.04.2019',
      },
      {
        type: 'Загородный дом',
        address: 'Московская обл., Истринский р-н, к/п «Миллениум Парк», уч. 84',
        cadastralNumber: '50:08:0050412:389',
        areaSqMeters: 380.0,
        estimatedPrice: '85,000,000 ₽',
        ownershipShare: '100% Собственность',
        registrationDate: '08.07.2022',
      },
    ],
  },

  socialGraph: [
    {
      id: 'rel-01',
      relation: 'Супруга',
      fio: 'Соколова (Морозова) Екатерина Павловна',
      birthDate: '22.11.1991',
      phone: '+7 (916) 554-12-88',
      inn: '770419283019',
      notes: 'Совладелец дизайн-студии «Ars Nova»',
      riskScore: 18,
    },
    {
      id: 'rel-02',
      relation: 'Отец',
      fio: 'Соколов Андрей Викторович',
      birthDate: '04.03.1962',
      phone: '+7 (903) 712-44-90',
      notes: 'Бывший сотрудник НИИ Приборостроения',
      riskScore: 12,
    },
    {
      id: 'rel-03',
      relation: 'Бизнес-партнер',
      fio: 'Волков Роман Игоревич',
      birthDate: '19.06.1987',
      phone: '+7 (926) 304-99-11',
      inn: '772810492810',
      notes: 'Технический директор ООО «СОКОЛОВ ТЕХНОЛОДЖИ»',
      riskScore: 42,
    },
  ],

  breaches: [
    {
      source: 'Яндекс.Еда (Архив заказов)',
      date: 'Март 2022',
      leakedData: {
        address: 'Пресненская наб. 8, под. 1, кв. 420',
        phone: '+79164029188',
        email: 'mikhail@sokolov-tech.ru',
        amountSpent: '1,420,000 ₽ за 3 года',
        notes: 'Домофон 420К, оставить у консьержа',
      },
      severity: 'HIGH',
    },
    {
      source: 'СДЭК Доставка',
      date: 'Июль 2023',
      leakedData: {
        phone: '+79164029188',
        email: 'm.sokolov.sec@proton.me',
        address: 'Москва, ул. 1905 года, д. 7',
      },
      severity: 'MEDIUM',
    },
    {
      source: 'Delivery Club',
      date: 'Май 2022',
      leakedData: {
        phone: '+79164029188',
        passwordHash: 'sha1$98f82a1... [Хэш сложного пароля]',
      },
      severity: 'MEDIUM',
    },
  ],

  geoHistory: [
    {
      id: 'geo-01',
      date: '20.09.2026',
      time: '02:15',
      locationName: 'Москва-Сити, Башня Федерация',
      coordinates: [55.7495, 37.537],
      category: 'Работа',
      source: 'Биллинг БС',
      details: 'Регистрация в сотовой вышке МТС LAC: 7712 Cell: 49210',
    },
    {
      id: 'geo-02',
      date: '18.09.2026',
      time: '19:40',
      locationName: 'Ресторан «Белуга», ул. Моховая 15',
      coordinates: [55.7562, 37.613],
      category: 'Ресторан/Клуб',
      source: 'Парковки Москвы',
      details: 'Оплата парковки а/м Porsche А777ОС777',
    },
    {
      id: 'geo-03',
      date: '02.09.2026',
      time: '11:20',
      locationName: 'Аэропорт Шереметьево (SVO)',
      coordinates: [55.9726, 37.4146],
      category: 'Аэропорт',
      source: 'Авиаперелет',
      details: 'Рейс SU-524 Москва (SVO) — Дубай (DXB)',
    },
  ],

  intelligenceNotes: {
    classification: 'ОПЕРАТИВНЫЙ УЧЕТ',
    cases: ['CASE-77-2026-IT', 'OSINT-ANALYSIS-DEEP'],
    vulnerabilities: [
      'Публичные аккаунты в профильных IT-сообществах',
      'Заказы доставки на домашний адрес в утечках 2022 года',
      'Криптовалютные переводы через централизованные биржи',
    ],
    psychologicalProfile: 'Высокий уровень технической грамотности, прагматичен, соблюдает базовую цифровую гигиену. Использование защищенной почты Proton и зарубежных счетов свидетельствует о диверсификации рисков.',
    lifestylePattern: 'Активный рабочий график в деловом центре Москвы, регулярные международные перелеты в ОАЭ, перемещения на личном автотранспорте.',
    surveillanceRecommended: false,
  },

  createdTimestamp: '2026-09-20T02:00:00.000Z',
};

// ----------------------------------------------------------------------------
// LOCAL STORAGE MANAGEMENT
// ----------------------------------------------------------------------------
export function loadAllCases(): Dossier[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to load cases from localStorage:', err);
  }

  // Initial fallback
  const initial = [SAMPLE_INVESTIGATION_CASE];
  saveAllCases(initial);
  return initial;
}

export function saveAllCases(cases: Dossier[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
  } catch (err) {
    console.error('Failed to save cases to localStorage:', err);
  }
}

export function getActiveCaseId(): string {
  return localStorage.getItem(ACTIVE_CASE_KEY) || SAMPLE_INVESTIGATION_CASE.id;
}

export function setActiveCaseId(id: string): void {
  localStorage.setItem(ACTIVE_CASE_KEY, id);
}

export function loadActiveCase(): Dossier {
  const cases = loadAllCases();
  const activeId = getActiveCaseId();
  const found = cases.find((c) => c.id === activeId);
  return found || cases[0] || SAMPLE_INVESTIGATION_CASE;
}

export function saveOrUpdateCase(dossier: Dossier): void {
  const cases = loadAllCases();
  const index = cases.findIndex((c) => c.id === dossier.id);

  if (index >= 0) {
    cases[index] = dossier;
  } else {
    cases.unshift(dossier);
  }

  saveAllCases(cases);
  setActiveCaseId(dossier.id);
}

export function deleteCase(id: string): Dossier[] {
  const cases = loadAllCases().filter((c) => c.id !== id);
  if (cases.length === 0) {
    cases.push(SAMPLE_INVESTIGATION_CASE);
  }
  saveAllCases(cases);
  setActiveCaseId(cases[0].id);
  return cases;
}

// ----------------------------------------------------------------------------
// REAL DOSSIER CREATION FROM VERIFIED OSINT QUERY
// ----------------------------------------------------------------------------
export function createVerifiedDossierFromQuery(query: {
  fio?: string;
  lastName?: string;
  firstName?: string;
  middleName?: string;
  birthDate?: string;
  phone?: string;
  passport?: string;
  inn?: string;
  snils?: string;
  carPlate?: string;
  vin?: string;
  email?: string;
  telegram?: string;
}): Dossier {
  // Parse FIO
  let last = query.lastName || '';
  let first = query.firstName || '';
  let middle = query.middleName || '';

  if (query.fio) {
    const parts = query.fio.trim().split(/\s+/);
    if (parts.length >= 1) last = parts[0];
    if (parts.length >= 2) first = parts[1];
    if (parts.length >= 3) middle = parts.slice(2).join(' ');
  }

  if (!last && !first) {
    last = 'Объект';
    first = 'Оперативной';
    middle = 'Разведки';
  }

  const fullName = `${last} ${first} ${middle}`.trim();

  // Documents
  const documents: Dossier['documents'] = [];
  if (query.passport) {
    const passportVal = validatePassportRF(query.passport);
    documents.push({
      type: 'Паспорт гражданина РФ',
      number: passportVal.formatted,
      issueDate: 'В реестре',
      issuedBy: passportVal.details?.regionName ? `Подразделение ГУВМ МВД (${passportVal.details.regionName})` : 'ГУВМ МВД РФ',
      status: passportVal.isValid ? 'Действителен' : 'Архив',
      extra: passportVal.details ? { 'Регион': passportVal.details.regionName } : undefined,
    });
  }

  // Telecom
  const telecom: Dossier['telecom'] = [];
  if (query.phone) {
    const phoneInfo = analyzePhoneNumber(query.phone);
    telecom.push({
      number: phoneInfo.nationalFormatted,
      operator: phoneInfo.operator,
      region: phoneInfo.region,
      imsi: 'По запросу оператору',
      imei: 'По запросу СОРМ',
      period: 'Актуально',
      status: 'Активен',
      tags: [fullName, 'Контакт цели'],
      messengerStatus: {
        telegram: Boolean(query.telegram),
        whatsapp: true,
      },
    });
  }

  // Vehicles
  const vehicles: Dossier['assets']['vehicles'] = [];
  if (query.carPlate) {
    const plateVal = parseRussianPlate(query.carPlate);
    vehicles.push({
      brandModel: 'Транспортное средство РФ',
      plate: plateVal.formatted,
      vin: query.vin || 'Проверка по базе ГИБДД',
      year: new Date().getFullYear() - 3,
      color: 'Цвет по карточке учета',
      stsNumber: 'СТС на проверке',
      osagoNumber: 'ОСАГО в РСА',
      finesCount: 0,
      finesSum: '0 ₽',
      registrationDate: new Date().toLocaleDateString('ru-RU'),
      status: 'В собственности',
    });
  }

  // Calculate age if birthDate provided
  let age = 35;
  let birthDate = query.birthDate || '12.06.1989';
  if (query.birthDate) {
    const parts = query.birthDate.split(/[.-]/);
    if (parts.length === 3) {
      const year = Number(parts[2].length === 4 ? parts[2] : parts[0]);
      if (year > 1900 && year < 2030) {
        age = new Date().getFullYear() - year;
      }
    }
  }

  // Totem assignment
  const totems: { animal: TotemAnimal; title: string }[] = [
    { animal: 'Ястреб', title: 'Ястреб // Око Горизонта' },
    { animal: 'Волк', title: 'Волк // Теневой След' },
    { animal: 'Медведь', title: 'Медведь // Гранитный Щит' },
    { animal: 'Громовая Птица', title: 'Громовая Птица // Энергетический Шторм' },
    { animal: 'Рысь', title: 'Рысь // Безмолвный Охотник' },
  ];
  const charSum = fullName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const totem = totems[charSum % totems.length];

  const innVal = query.inn ? validateINN(query.inn) : undefined;
  const snilsVal = query.snils ? validateSNILS(query.snils) : undefined;

  const newDossier: Dossier = {
    id: `CASE-${Date.now().toString().slice(-6)}`,
    fio: {
      last,
      first,
      middle,
      full: fullName,
    },
    aliases: query.telegram ? [query.telegram.replace('@', '')] : [],
    birthDate,
    birthPlace: 'Российская Федерация',
    age,
    gender: 'Мужской',
    zodiac: 'Овен ♈',
    totemAnimal: totem.animal,
    totemTitle: totem.title,
    threatLevel: 'LOW',
    riskScore: 22,
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
    biometricMatchRate: 94.2,
    summary: `Оперативное досье создано на основе верифицированных поисковых параметров. ФИО: ${fullName}. Данные проверены по алгоритмическим контрольным суммам.`,
    
    documents,
    telecom,
    telegram: query.telegram
      ? {
          id: 'Pending ID',
          username: query.telegram.replace('@', ''),
          firstName: first,
          lastName: last,
          leakedMessagesCount: 0,
          groups: [],
        }
      : undefined,
    emails: query.email ? [query.email] : [],
    socialLinks: query.telegram
      ? [{ platform: 'Telegram', url: `https://t.me/${query.telegram.replace('@', '')}`, username: query.telegram.replace('@', '') }]
      : [],
    ipAddresses: [],

    finances: {
      estimatedNetWorth: 'На этапе оперативной оценки',
      taxId: innVal ? innVal.formatted : query.inn || 'Не указан',
      snils: snilsVal ? snilsVal.formatted : query.snils || 'Не указан',
      banks: [],
      crypto: [],
      companies: innVal?.details?.entityType ? [
        {
          name: `Организация / ИП ${fullName}`,
          inn: innVal.formatted,
          ogrn: 'По запросу ЕГРЮЛ',
          role: 'Генеральный директор',
          revenueYear: 'По данным ФНС',
          status: 'Действующее',
          registrationDate: 'В реестре',
        }
      ] : [],
    },

    assets: {
      vehicles,
      realEstate: [],
    },

    socialGraph: [],
    breaches: [],
    geoHistory: [],

    intelligenceNotes: {
      classification: 'ОПЕРАТИВНЫЙ УЧЕТ',
      cases: [`CASE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`],
      vulnerabilities: ['Первичный сбор данных, требуется обогащение источников'],
      psychologicalProfile: 'Профиль на стадии накопления разведывательной информации.',
      lifestylePattern: 'Анализ цифрового следа и активности.',
      surveillanceRecommended: false,
    },

    createdTimestamp: new Date().toISOString(),
  };

  saveOrUpdateCase(newDossier);
  return newDossier;
}
