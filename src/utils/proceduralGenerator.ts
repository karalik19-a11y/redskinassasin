import type { Dossier, SearchQuery, TotemAnimal, ThreatLevel } from '../types/dossier';
import { calculateAge, getZodiac } from './formatters';

function stringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(min + this.next() * (max - min + 1));
  }

  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  digits(len: number): string {
    let res = '';
    for (let i = 0; i < len; i++) {
      res += Math.floor(this.next() * 10).toString();
    }
    return res;
  }
}

const RUSSIAN_CITIES = [
  'г. Москва',
  'г. Санкт-Петербург',
  'г. Казань',
  'г. Новосибирск',
  'г. Екатеринбург',
  'г. Нижний Новгород',
  'г. Краснодар',
  'г. Сочи',
  'г. Владивосток',
  'г. Ростов-на-Дону',
];

const MOSCOW_STREETS = [
  'ул. Тверская',
  'Ленинский пр-кт',
  'Кутузовский пр-кт',
  'ул. Новый Арбат',
  'Пресненская наб. (Москва-Сити)',
  'Ломоносовский пр-кт',
  'ул. Большая Никитская',
  'Рублево-Успенское ш.',
  'Ходынский б-р',
  'ул. Остоженка (Золотая Миля)',
];

const CAR_MODELS = [
  { brand: 'Porsche Cayenne Turbo GT', year: 2023, color: 'Черный обсидиан' },
  { brand: 'BMW X5 M Competition (F95)', year: 2022, color: 'Тайфун Грей' },
  { brand: 'Mercedes-Benz G63 AMG', year: 2023, color: 'Матовый Графит' },
  { brand: 'Audi RS6 Avant', year: 2022, color: 'Nardo Grey' },
  { brand: 'Land Rover Range Rover SV', year: 2024, color: 'Sunset Gold' },
  { brand: 'Lexus LX 600 VIP', year: 2023, color: 'Жемчужно-белый' },
  { brand: 'Zeekr 001 FR', year: 2024, color: 'Cyber Cyan' },
];

const TOTEMS: { animal: TotemAnimal; title: string }[] = [
  { animal: 'Ястреб', title: 'Орлиный Взор Небесного Стража' },
  { animal: 'Волк', title: 'Серый Волк Теневого Потока' },
  { animal: 'Громовая Птица', title: 'Громовая Птица Кибер-Шторма' },
  { animal: 'Медведь', title: 'Яростный Медведь Базальтовой Скалы' },
  { animal: 'Змей', title: 'Изумрудный Змей Тайных Шифров' },
  { animal: 'Рысь', title: 'Призрачная Рысь Ночного Охотника' },
  { animal: 'Бизон', title: 'Несокрушимый Бизон Древних Степей' },
];

const AVATAR_POOL = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=600&q=80',
];

export function generateProceduralDossier(query: SearchQuery): Dossier {
  const seedString = `${query.fio || ''}_${query.lastName || ''}_${query.firstName || ''}_${query.birthDate || ''}_${query.phone || ''}_${query.passport || ''}`;
  const seed = stringToSeed(seedString || 'cyber_target_unknown');
  const rng = new SeededRandom(seed);

  // Parse or synthesize FIO
  let last = query.lastName || '';
  let first = query.firstName || '';
  let middle = query.middleName || '';

  if (query.fio && !last) {
    const parts = query.fio.trim().split(/\s+/);
    if (parts.length >= 1) last = parts[0];
    if (parts.length >= 2) first = parts[1];
    if (parts.length >= 3) middle = parts.slice(2).join(' ');
  }

  if (!last) last = rng.pick(['Соколов', 'Белов', 'Громов', 'Орлов', 'Волков', 'Смирнов', 'Кузнецов', 'Крылов', 'Чернов', 'Лебедев']);
  if (!first) first = rng.pick(['Алексей', 'Михаил', 'Дмитрий', 'Артем', 'Максим', 'Сергей', 'Роман', 'Андрей', 'Илья', 'Павел']);
  if (!middle) middle = rng.pick(['Александрович', 'Дмитриевич', 'Сергеевич', 'Игоревич', 'Владимирович', 'Олегович', 'Максимович']);

  const fullName = `${last} ${first} ${middle}`.trim();
  const gender = middle.endsWith('на') || last.endsWith('а') ? 'Женский' : 'Мужской';

  // Birth date
  let birthDate = query.birthDate || '';
  if (!birthDate) {
    const day = rng.nextInt(1, 28).toString().padStart(2, '0');
    const month = rng.nextInt(1, 12).toString().padStart(2, '0');
    const year = rng.nextInt(1975, 2002);
    birthDate = `${day}.${month}.${year}`;
  }

  const age = calculateAge(birthDate);
  const zodiac = getZodiac(birthDate);
  const city = rng.pick(RUSSIAN_CITIES);
  const street = rng.pick(MOSCOW_STREETS);
  const houseNum = rng.nextInt(2, 98);
  const aptNum = rng.nextInt(4, 250);
  const fullAddress = `${city}, ${street}, д. ${houseNum}, кв. ${aptNum}`;

  const totem = rng.pick(TOTEMS);
  const riskScore = rng.nextInt(48, 97);
  let threatLevel: ThreatLevel = 'LOW';
  if (riskScore >= 85) threatLevel = 'CRITICAL';
  else if (riskScore >= 70) threatLevel = 'HIGH';
  else if (riskScore >= 55) threatLevel = 'ELEVATED';
  else threatLevel = 'GUARDED';

  // Phone number
  const phone = query.phone ? query.phone : `+7 (9${rng.digits(2)}) ${rng.digits(3)}-${rng.digits(2)}-${rng.digits(2)}`;

  // Passport
  const passSeries = query.passport ? query.passport.slice(0, 4) : `${rng.nextInt(40, 65)}${rng.nextInt(10, 24)}`;
  const passNum = query.passport && query.passport.length > 4 ? query.passport.slice(4) : rng.digits(6);
  const snils = query.snils || `${rng.digits(3)}-${rng.digits(3)}-${rng.digits(3)} ${rng.digits(2)}`;
  const inn = query.inn || `77${rng.digits(10)}`;

  // Vehicle
  const car = rng.pick(CAR_MODELS);
  const letters = ['А', 'В', 'Е', 'К', 'М', 'Н', 'О', 'Р', 'С', 'Т', 'У', 'Х'];
  const carPlate = query.carPlate || `${rng.pick(letters)}${rng.digits(3)}${rng.pick(letters)}${rng.pick(letters)}${rng.pick(['77', '99', '199', '777', '799', '178'])}`;
  const carVin = `XTA${rng.digits(4)}${rng.pick(['A', 'B', 'C', 'D', 'E'])}${rng.digits(9)}`;

  // Telegram handle
  const latinTranslit = last.toLowerCase().replace(/[^a-z]/g, '') || 'shadow_target';
  const tgHandle = query.telegram || `${latinTranslit}_${rng.nextInt(10, 99)}`;
  const emailName = query.email || `${latinTranslit}.${first.toLowerCase().slice(0, 3)}${rng.nextInt(10, 99)}@gmail.com`;

  return {
    id: `dyn-${seed}`,
    fio: {
      last,
      first,
      middle,
      full: fullName,
    },
    aliases: [
      tgHandle,
      `${last.toLowerCase()}_off`,
      `agent_${rng.digits(4)}`,
      `${first.toLowerCase()}_alpha`,
    ],
    birthDate,
    birthPlace: city,
    age,
    gender,
    zodiac,
    totemAnimal: totem.animal,
    totemTitle: totem.title,
    threatLevel,
    riskScore,
    biometricMatchRate: parseFloat((94 + rng.next() * 5.8).toFixed(1)),
    avatarUrl: rng.pick(AVATAR_POOL),
    summary: `Объект ${fullName} идентифицирован в базах кибер-разведки. Зафиксированы множественные пересечения в коммерческих реестрах, утечках служб доставки и сотовых операторов. Уровень оперативного риска: ${riskScore}%.`,

    documents: [
      {
        type: 'Паспорт гражданина РФ',
        series: passSeries,
        number: passNum,
        issueDate: `14.06.${2000 + (age - 14 > 0 ? 14 : 0)}`,
        issuedBy: `ГУ МВД по ${city}`,
        departmentCode: `${rng.nextInt(100, 770)}-${rng.nextInt(10, 99)}`,
        status: 'Действителен',
        extra: {
          'Адрес постоянной регистрации': fullAddress,
          'СНИЛС': snils,
          'ИНН': inn,
        },
      },
      {
        type: 'Заграничный паспорт РФ',
        series: '75',
        number: rng.digits(7),
        issueDate: '19.04.2021',
        status: 'Действителен',
        extra: {
          'Срок действия': 'до 19.04.2031 (10 лет, Биометрия)',
          'Отметки о визах': 'UAE Residence Visa, Schengen Multi (C), Turkey Entry/Exit',
        },
      },
      {
        type: 'Водительское удостоверение',
        series: `${rng.nextInt(10, 99)}${rng.nextInt(10, 99)}`,
        number: rng.digits(6),
        issueDate: '10.08.2018',
        status: 'Действителен',
        extra: {
          'Категории': 'B, B1, M',
          'Стаж': `${Math.max(2, age - 18)} лет`,
        },
      },
    ],

    telecom: [
      {
        number: phone,
        operator: rng.pick(['ПАО МТС', 'ПАО МегаФон', 'ПАО ВымпелКом (Билайн)', 'Т2 Мобайл (Теле2)']),
        region: city,
        imsi: `2500${rng.digits(11)}`,
        imei: `3589${rng.digits(11)} (Apple iPhone 15 Pro)`,
        period: '2021 — 2026',
        status: 'Активен',
        tags: [
          `${first} ${last}`,
          `${first} Личный`,
          `${last} Шеф`,
          `${first} (${city.replace('г. ', '')})`,
        ],
        messengerStatus: { telegram: true, whatsapp: true, signal: rng.next() > 0.5 },
      },
      {
        number: `+7 (9${rng.digits(2)}) ${rng.digits(3)}-${rng.digits(2)}-${rng.digits(2)}`,
        operator: 'ПАО ВымпелКом',
        region: city,
        imsi: `2509${rng.digits(11)}`,
        imei: `8694${rng.digits(11)}`,
        period: '2023 — 2026 (Второй/Рабочий)',
        status: 'Активен',
        tags: [`${last} Рабочий`],
        messengerStatus: { telegram: true },
      },
    ],

    telegram: {
      id: `${rng.nextInt(100000000, 999999999)}`,
      username: tgHandle,
      firstName: first,
      lastName: last,
      phone,
      bio: 'Digital nomad & business intelligence. Online 24/7.',
      leakedMessagesCount: rng.nextInt(450, 4200),
      groups: [
        'VIP Business Networking CIS',
        'Fintech & Crypto Investments',
        `${city.replace('г. ', '')} Private Club`,
        'Real Estate Owners Channel',
      ],
      lastSeen: 'Был(а) недавно (с мобильного приложения)',
    },

    emails: [
      emailName,
      `${latinTranslit}_sec@proton.me`,
      `info@${latinTranslit}-group.ru`,
    ],

    socialLinks: [
      { platform: 'Telegram', url: `https://t.me/${tgHandle}`, username: `@${tgHandle}` },
      { platform: 'VKontakte', url: `https://vk.com/id${rng.nextInt(10000000, 99999999)}`, username: `${first} ${last}` },
      { platform: 'LinkedIn', url: `https://linkedin.com/in/${tgHandle}`, username: tgHandle },
    ],

    ipAddresses: [
      { ip: `${rng.nextInt(80, 195)}.${rng.nextInt(10, 220)}.${rng.nextInt(1, 250)}.${rng.nextInt(1, 250)}`, isp: 'ПАО Ростелеком / GPON', city, lastSeen: '20.09.2026 01:10' },
      { ip: `${rng.nextInt(185, 212)}.${rng.nextInt(10, 200)}.${rng.nextInt(1, 200)}.${rng.nextInt(1, 200)}`, isp: 'Cloudflare / Warp VPN', city: 'Stockholm, SE', lastSeen: '19.09.2026 21:40' },
    ],

    finances: {
      estimatedNetWorth: `₽ ${rng.nextInt(45, 680)},000,000 (~$${(rng.nextInt(5, 75) / 10).toFixed(1)}M)`,
      taxId: inn,
      snils,
      banks: [
        {
          bank: 'АО «Т-Банк» (Тинькофф Премиум)',
          accountMasked: `40817810****${rng.digits(4)}`,
          currency: 'RUB',
          balanceEstimated: `₽ ${rng.nextInt(4, 38)},${rng.digits(3)},000`,
          openDate: '14.05.2018',
          status: 'Активен',
        },
        {
          bank: 'ПАО «Сбербанк» (СберПремьер)',
          accountMasked: `40817810****${rng.digits(4)}`,
          currency: 'RUB',
          balanceEstimated: `₽ ${rng.nextInt(12, 95)},${rng.digits(3)},000`,
          openDate: '22.09.2015',
          status: 'Активен',
        },
        {
          bank: 'АО «Альфа-Банк»',
          accountMasked: `40817810****${rng.digits(4)}`,
          currency: 'RUB / CNY',
          balanceEstimated: `₽ ${rng.nextInt(2, 25)},${rng.digits(3)},000`,
          openDate: '08.11.2020',
          status: 'Активен',
        },
      ],
      crypto: [
        {
          network: 'Bitcoin (BTC)',
          address: `bc1q${rng.digits(8)}${latinTranslit.slice(0, 6)}${rng.digits(12)}`,
          balance: `${(rng.nextInt(12, 140) / 10).toFixed(2)} BTC`,
          totalTx: rng.nextInt(120, 1850),
          lastActivity: '19.09.2026 22:15',
          riskCategory: 'Чистый',
        },
        {
          network: 'Tether (USDT TRC20)',
          address: `T${rng.pick(['X', 'N', 'K', 'L'])}${rng.digits(6)}${rng.pick(['a', 'B', 'c', 'D'])}${rng.digits(18)}`,
          balance: `${rng.nextInt(45, 750)},000 USDT`,
          totalTx: rng.nextInt(340, 2900),
          lastActivity: '20.09.2026 00:45',
          riskCategory: 'P2P Офшор',
        },
      ],
      companies: [
        {
          name: `ООО «${last.toUpperCase()} ДЕВЕЛОПМЕНТ»`,
          inn: `77${rng.digits(8)}`,
          ogrn: `11977${rng.digits(8)}`,
          role: 'Генеральный директор',
          revenueYear: `₽ ${rng.nextInt(35, 290)},000,000 / год`,
          status: 'Действующее',
          registrationDate: '15.03.2019',
        },
        {
          name: `ИП ${fullName}`,
          inn,
          ogrn: `31977${rng.digits(10)}`,
          role: 'ИП',
          revenueYear: `₽ ${rng.nextInt(15, 80)},000,000 / год`,
          status: 'Действующее',
          registrationDate: '10.09.2021',
        },
      ],
    },

    assets: {
      vehicles: [
        {
          brandModel: `${car.brand} (${car.year})`,
          plate: carPlate,
          vin: carVin,
          year: car.year,
          color: car.color,
          stsNumber: `${rng.nextInt(10, 99)}${rng.nextInt(10, 99)} ${rng.digits(6)}`,
          osagoNumber: `ХХХ ${rng.digits(10)} (АО «СОГАЗ»)`,
          finesCount: rng.nextInt(2, 16),
          finesSum: `₽ ${rng.nextInt(2, 22)},500 (Оплачены)`,
          registrationDate: `12.07.${car.year}`,
          status: 'В собственности',
        },
      ],
      realEstate: [
        {
          type: 'Квартира',
          address: fullAddress,
          cadastralNumber: `77:01:000${rng.nextInt(1000, 9999)}:${rng.nextInt(100, 999)}`,
          areaSqMeters: rng.nextInt(95, 260),
          estimatedPrice: `₽ ${rng.nextInt(45, 195)},000,000`,
          ownershipShare: '1/1 (Единоличная собственность)',
          registrationDate: '18.10.2019',
          encumbrance: 'Без обременений',
        },
      ],
    },

    socialGraph: [
      {
        id: `rel-${rng.digits(4)}`,
        relation: gender === 'Мужской' ? 'Отец' : 'Мать',
        fio: gender === 'Мужской' ? `${last} ${middle.replace('ович', 'ий').replace('евич', 'ий')} Викторович` : `${last} Елена Николаевна`,
        birthDate: `12.05.${parseInt(birthDate.slice(-4)) - 26}`,
        phone: `+7 (9${rng.digits(2)}) ${rng.digits(3)}-${rng.digits(2)}-${rng.digits(2)}`,
        inn: `77${rng.digits(10)}`,
        notes: 'Пенсионер, совместное владение объектами недвижимости.',
        riskScore: 24,
      },
      {
        id: `rel-${rng.digits(4)}`,
        relation: gender === 'Мужской' ? 'Супруга' : 'Супруг',
        fio: gender === 'Мужской' ? `${last} (Смирнова) Анна Викторовна` : `Белов Сергей Николаевич`,
        birthDate: `18.09.${parseInt(birthDate.slice(-4)) + rng.nextInt(-3, 3)}`,
        phone: `+7 (9${rng.digits(2)}) ${rng.digits(3)}-${rng.digits(2)}-${rng.digits(2)}`,
        inn: `77${rng.digits(10)}`,
        notes: 'Совместные банковские счета и зарубежные поездки.',
        riskScore: 38,
      },
      {
        id: `rel-${rng.digits(4)}`,
        relation: 'Бизнес-партнер',
        fio: 'Орлов Денис Константинович',
        birthDate: '14.03.1986',
        phone: `+7 (9${rng.digits(2)}) ${rng.digits(3)}-${rng.digits(2)}-${rng.digits(2)}`,
        inn: `77${rng.digits(10)}`,
        notes: 'Соучредитель в управляющих компаниях.',
        riskScore: 68,
      },
    ],

    breaches: [
      {
        source: 'Яндекс.Еда (Архив утечки)',
        date: '01.03.2022',
        leakedData: {
          address: `${fullAddress}, домофон ${aptNum}K${rng.nextInt(100, 999)}`,
          phone,
          email: emailName,
          amountSpent: `₽ ${rng.nextInt(240, 950)},000`,
          notes: 'Консьержу сказать, что в квартиру ' + aptNum,
          deviceInfo: 'iOS 16.4 / iPhone 14 Pro',
        },
        severity: 'HIGH',
      },
      {
        source: 'СДЭК Клиентская база (2023)',
        date: '19.06.2023',
        leakedData: {
          address: fullAddress,
          phone,
          email: emailName,
          notes: 'Доставка посылок с экспресс-страховкой',
        },
        severity: 'MEDIUM',
      },
      {
        source: 'Delivery Club & Retail Leaks (2022-2024)',
        date: '14.11.2023',
        leakedData: {
          phone,
          email: emailName,
          clearPassword: `${last.toLowerCase()}${rng.nextInt(1000, 9999)}!`,
          notes: 'Пароль уязвим для подбора по словарю',
        },
        severity: 'CRITICAL',
      },
    ],

    geoHistory: [
      {
        id: `geo-${rng.digits(4)}`,
        date: '19.09.2026',
        time: '21:30',
        locationName: `${city}, ${street}`,
        coordinates: [55.7558 + (rng.next() - 0.5) * 0.08, 37.6173 + (rng.next() - 0.5) * 0.08],
        category: 'Дом',
        source: 'Биллинг БС',
        details: 'Базовая станция оператора (LTE B3/B7/B20)',
      },
      {
        id: `geo-${rng.digits(4)}`,
        date: '18.09.2026',
        time: '14:20',
        locationName: `${city}, Деловой центр`,
        coordinates: [55.7490 + (rng.next() - 0.5) * 0.05, 37.5370 + (rng.next() - 0.5) * 0.05],
        category: 'Работа',
        source: 'Парковки Москвы',
        details: `Фиксация автомобиля ${carPlate} на платной парковке`,
      },
      {
        id: `geo-${rng.digits(4)}`,
        date: '16.09.2026',
        time: '19:45',
        locationName: 'Международный аэропорт Шереметьево (SVO)',
        coordinates: [55.9736, 37.4125],
        category: 'Аэропорт',
        source: 'ФСБ Погранслужба',
        details: 'Пересечение государственной границы РФ',
      },
    ],

    intelligenceNotes: {
      classification: 'ДСП',
      cases: [`Оперативная справка ОРЧ (ЭБ и ПК) № ${rng.nextInt(1000, 9999)}/25`],
      vulnerabilities: [
        'Использование одного номера телефона для доставки еды и банковских карт',
        'Утечка паролей в базах ритейла',
        'Высокая концентрация цифровых активов в некастодиальных кошельках',
      ],
      psychologicalProfile: 'Осторожный, прагматичный стиль принятия решений. Проявляет заботу о приватности в соцсетях, однако оставляет заметный след в сервисах электронной коммерции.',
      lifestylePattern: 'Регулярные авиаперелеты бизнес-классом, владение премиальным транспортом.',
      surveillanceRecommended: riskScore > 75,
    },

    createdTimestamp: '20.09.2026 01:30:00 MSK',
  };
}
