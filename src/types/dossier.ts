export type ThreatLevel = 'LOW' | 'GUARDED' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
export type TotemAnimal = 'Ястреб' | 'Волк' | 'Медведь' | 'Громовая Птица' | 'Змей' | 'Рысь' | 'Бизон';

export interface Relative {
  id: string;
  relation: string;
  fio: string;
  birthDate: string;
  phone?: string;
  inn?: string;
  notes?: string;
  riskScore?: number;
}

export interface DocumentInfo {
  type: string;
  number: string;
  series?: string;
  issueDate: string;
  issuedBy?: string;
  departmentCode?: string;
  status: 'Действителен' | 'Недействителен' | 'Архив';
  extra?: Record<string, string>;
}

export interface PhoneRecord {
  number: string;
  operator: string;
  region: string;
  imsi: string;
  imei: string;
  period: string;
  status: 'Активен' | 'Архив' | 'Блокирован';
  tags: string[];
  messengerStatus?: {
    telegram?: boolean;
    whatsapp?: boolean;
    signal?: boolean;
  };
}

export interface TelegramProfile {
  id: string;
  username?: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  bio?: string;
  leakedMessagesCount: number;
  groups: string[];
  lastSeen?: string;
}

export interface BankAccount {
  bank: string;
  accountMasked: string;
  currency: string;
  balanceEstimated?: string;
  openDate: string;
  status: 'Активен' | 'Арестован' | 'Закрыт';
}

export interface CryptoWallet {
  network: 'Bitcoin (BTC)' | 'Ethereum (ETH)' | 'Tether (USDT TRC20)' | 'Solana (SOL)' | 'Monero (XMR)';
  address: string;
  balance: string;
  totalTx: number;
  lastActivity: string;
  riskCategory: 'Чистый' | 'Миксер/Darknet' | 'Биржа' | 'P2P Офшор';
}

export interface Vehicle {
  brandModel: string;
  plate: string;
  vin: string;
  year: number;
  color: string;
  stsNumber: string;
  osagoNumber: string;
  finesCount: number;
  finesSum: string;
  registrationDate: string;
  status: 'В собственности' | 'Продан' | 'В розыске' | 'Лизинг';
}

export interface RealEstate {
  type: 'Квартира' | 'Апартаменты' | 'Загородный дом' | 'Земельный участок' | 'Коммерческая недвижимость';
  address: string;
  cadastralNumber: string;
  areaSqMeters: number;
  estimatedPrice: string;
  ownershipShare: string;
  registrationDate: string;
  encumbrance?: string;
}

export interface BusinessEntity {
  name: string;
  inn: string;
  ogrn: string;
  role: 'Генеральный директор' | 'Учредитель (100%)' | 'Соучредитель (50%)' | 'Бенефициарный владелец' | 'ИП';
  revenueYear: string;
  status: 'Действующее' | 'В процессе ликвидации' | 'Ликвидировано';
  registrationDate: string;
}

export interface BreachEntry {
  source: string;
  date: string;
  leakedData: {
    address?: string;
    phone?: string;
    email?: string;
    passwordHash?: string;
    clearPassword?: string;
    notes?: string;
    amountSpent?: string;
    deviceInfo?: string;
  };
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

export interface GeoMovement {
  id: string;
  date: string;
  time: string;
  locationName: string;
  coordinates: [number, number];
  category: 'Дом' | 'Работа' | 'Аэропорт' | 'Ресторан/Клуб' | 'Банк' | 'Транзит' | 'Отель';
  source: 'Биллинг БС' | 'Авиаперелет' | 'Парковки Москвы' | 'Яндекс.Еда' | 'Wi-Fi Сниффер' | 'ФСБ Погранслужба';
  details: string;
}

export interface Dossier {
  id: string;
  fio: {
    last: string;
    first: string;
    middle: string;
    full: string;
  };
  aliases: string[];
  birthDate: string;
  birthPlace: string;
  age: number;
  gender: 'Мужской' | 'Женский';
  zodiac: string;
  totemAnimal: TotemAnimal;
  totemTitle: string;
  threatLevel: ThreatLevel;
  riskScore: number;
  avatarUrl?: string;
  biometricMatchRate: number;
  summary: string;
  
  documents: DocumentInfo[];
  telecom: PhoneRecord[];
  telegram?: TelegramProfile;
  emails: string[];
  socialLinks: { platform: string; url: string; username: string }[];
  ipAddresses: { ip: string; isp: string; city: string; lastSeen: string }[];
  
  finances: {
    estimatedNetWorth: string;
    taxId: string;
    snils: string;
    banks: BankAccount[];
    crypto: CryptoWallet[];
    companies: BusinessEntity[];
  };
  
  assets: {
    vehicles: Vehicle[];
    realEstate: RealEstate[];
  };
  
  socialGraph: Relative[];
  breaches: BreachEntry[];
  geoHistory: GeoMovement[];
  
  intelligenceNotes: {
    classification: 'СОВЕРШЕННО СЕКРЕТНО' | 'ДСП' | 'ОПЕРАТИВНЫЙ УЧЕТ';
    cases: string[];
    vulnerabilities: string[];
    psychologicalProfile: string;
    lifestylePattern: string;
    surveillanceRecommended: boolean;
  };

  createdTimestamp: string;
}

export interface SearchQuery {
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
  email?: string;
  telegram?: string;
  depth: 'FAST' | 'DEEP_TOTEM' | 'DARKNET_FULL';
}
