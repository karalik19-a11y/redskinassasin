// ============================================================================
// REDSKIN ASSASSIN // TOMAHAWK OSINT - OFFICIAL RUSSIAN & GLOBAL REGISTRIES DIRECTORY
// Complete Registry Index with Query Generators & Legal Reference
// ============================================================================

export interface RegistryItem {
  id: string;
  name: string;
  category: 'ФНС / Налоги & Бизнес' | 'ФССП & Долги' | 'Судебная система' | 'Транспорт & ГИБДД' | 'Банкротство & Залоги' | 'Спецучет & Безопасность' | 'Утечки & Киберразведка';
  authority: string;
  description: string;
  officialUrl: string;
  badge: string;
  buildQueryUrl?: (target: { fio?: string; inn?: string; birthDate?: string; vin?: string; plate?: string; email?: string; phone?: string }) => string;
}

export const OFFICIAL_REGISTRIES_DATABASE: RegistryItem[] = [
  // 1. FNS
  {
    id: 'fns-egrul',
    name: 'ФНС России // ЕГРЮЛ & ЕГРИП',
    category: 'ФНС / Налоги & Бизнес',
    authority: 'Федеральная налоговая служба РФ',
    description: 'Официальный государственный реестр юридических лиц и индивидуальных предпринимателей. Выписки с ЭЦП ФНС, учредители, доли, директор.',
    officialUrl: 'https://egrul.nalog.ru/',
    badge: 'Госреестр ФНС',
    buildQueryUrl: (t) => `https://egrul.nalog.ru/index.html?query=${encodeURIComponent(t.inn || t.fio || '')}`,
  },
  {
    id: 'fns-pb',
    name: 'ФНС Прозрачный Бизнес',
    category: 'ФНС / Налоги & Бизнес',
    authority: 'ФНС России',
    description: 'Комплексная налоговая проверка контрагентов, финансовая отчетность, уплаченные налоги, задолженности, среднесписочная численность сотрудников.',
    officialUrl: 'https://pb.nalog.ru/',
    badge: 'Налоговая отчетность',
    buildQueryUrl: (t) => `https://pb.nalog.ru/search.html#search-result?mode=quick&page=1&pageSize=10&querySearch=${encodeURIComponent(t.inn || t.fio || '')}`,
  },
  {
    id: 'fns-disq',
    name: 'Реестр дисквалифицированных лиц',
    category: 'ФНС / Налоги & Бизнес',
    authority: 'ФНС России',
    description: 'База лиц, лишенных права занимать руководящие должности в исполнительных органах управления предприятий по решениям судов.',
    officialUrl: 'https://service.nalog.ru/disqualified.do',
    badge: 'Ограничения',
    buildQueryUrl: () => `https://service.nalog.ru/disqualified.do`,
  },

  // 2. FSSP
  {
    id: 'fssp-bdip',
    name: 'ФССП // Банк данных исполнительных производств',
    category: 'ФССП & Долги',
    authority: 'Федеральная служба судебных приставов РФ',
    description: 'Поиск всех открытых и прекращенных исполнительных производств, взысканий задолженностей, алиментов, арестов счетов и запретов на выезд.',
    officialUrl: 'https://fssp.gov.ru/iss/ip',
    badge: 'Исполнительные листы',
    buildQueryUrl: () => `https://fssp.gov.ru/iss/ip`,
  },
  {
    id: 'fssp-wanted',
    name: 'ФССП // Реестр лиц в розыске по исполнительным производствам',
    category: 'ФССП & Долги',
    authority: 'ФССП России',
    description: 'Официальный публичный реестр граждан и должников, объявленных в розыск судебными приставами за уклонение от уплаты.',
    officialUrl: 'https://fssp.gov.ru/iss/suspect',
    badge: 'Розыск ФССП',
    buildQueryUrl: () => `https://fssp.gov.ru/iss/suspect`,
  },

  // 3. Courts
  {
    id: 'arbitr-kad',
    name: 'КАД Арбитр // Картотека арбитражных дел',
    category: 'Судебная система',
    authority: 'Верховный Суд РФ / Электронное правосудие',
    description: 'Все экономические споры, коммерческие иски, дела о банкротстве компаний и граждан по всем арбитражным судам Российской Федерации.',
    officialUrl: 'https://kad.arbitr.ru/',
    badge: 'Арбитражные суды',
    buildQueryUrl: () => `https://kad.arbitr.ru/`,
  },
  {
    id: 'gas-pravosudie',
    name: 'ГАС «Правосудие» (Суды общей юрисдикции)',
    category: 'Судебная система',
    authority: 'Судебный департамент при ВС РФ',
    description: 'Единая база гражданских, административных и уголовных дел в районных, городских и областных судах общей юрисдикции.',
    officialUrl: 'https://bsr.sudrf.ru/bigs/portal.html',
    badge: 'Уголовные & Гражданские',
    buildQueryUrl: () => `https://bsr.sudrf.ru/bigs/portal.html`,
  },
  {
    id: 'mos-gorsud',
    name: 'Суды общей юрисдикции г. Москвы',
    category: 'Судебная система',
    authority: 'Московский городской суд',
    description: 'База судебных заседаний, решений и исполнительных документов всех районных судов г. Москвы и Мосгорсуда.',
    officialUrl: 'https://mos-gorsud.ru/search',
    badge: 'Суды Москвы',
    buildQueryUrl: (t) => `https://mos-gorsud.ru/search?formType=shortForm&participant=${encodeURIComponent(t.fio || '')}`,
  },

  // 4. GIBDD & Transport
  {
    id: 'gibdd-check-auto',
    name: 'ГИБДД РФ // Проверка автомобиля по VIN / Кузову',
    category: 'Транспорт & ГИБДД',
    authority: 'ГУОБДД МВД России',
    description: 'Проверка истории регистрации ТС, участия в ДТП, нахождения в федеральном розыске и наличия судебных/таможенных ограничений на регдействия.',
    officialUrl: 'https://xn--b1afbneg2a.xn--p1ai/check/auto',
    badge: 'Проверка ТС',
    buildQueryUrl: (t) => `https://xn--b1afbneg2a.xn--p1ai/check/auto#${t.vin || ''}`,
  },
  {
    id: 'gibdd-check-driver',
    name: 'ГИБДД РФ // Проверка водительского удостоверения',
    category: 'Транспорт & ГИБДД',
    authority: 'ГУОБДД МВД России',
    description: 'Проверка действительности водительских прав, даты выдачи, категорий и фактов лишения права управления транспортными средствами.',
    officialUrl: 'https://xn--b1afbneg2a.xn--p1ai/check/driver',
    badge: 'Водительские права',
    buildQueryUrl: () => `https://xn--b1afbneg2a.xn--p1ai/check/driver`,
  },

  // 5. Fedresurs & Notariat
  {
    id: 'fedresurs-bankrot',
    name: 'ЕФРСБ // Единый реестр сведений о банкротстве',
    category: 'Банкротство & Залоги',
    authority: 'Федресурс / Минэкономразвития РФ',
    description: 'Карточки должников-банкротов (физлиц и юрлиц), отчеты финансовых управляющих, реестры кредиторов, торги арестованным имуществом.',
    officialUrl: 'https://bankrot.fedresurs.ru/',
    badge: 'Банкротство РФ',
    buildQueryUrl: () => `https://bankrot.fedresurs.ru/Bankrupts.aspx`,
  },
  {
    id: 'notariat-dover',
    name: 'Федеральная нотариальная палата // Проверка доверенностей',
    category: 'Банкротство & Залоги',
    authority: 'ФНП России',
    description: 'Проверка подлинности нотариально удостоверенных доверенностей, сведений об отмене или отзыве полномочий представителя.',
    officialUrl: 'https://www.reestr-dover.ru/',
    badge: 'Нотариат РФ',
    buildQueryUrl: () => `https://www.reestr-dover.ru/`,
  },
  {
    id: 'notariat-zalog',
    name: 'Реестр уведомлений о залоге движимого имущества',
    category: 'Банкротство & Залоги',
    authority: 'ФНП России',
    description: 'Проверка нахождения автомобилей, спецтехники и оборудования в залоге у банков, лизинговых компаний и кредиторов.',
    officialUrl: 'https://www.reestr-zalogov.ru/search/index',
    badge: 'Залоги имущества',
    buildQueryUrl: () => `https://www.reestr-zalogov.ru/search/index`,
  },

  // 6. Security & Watchlists
  {
    id: 'fedsfm-extremists',
    name: 'Росфинмониторинг // Перечень террористов и экстремистов',
    category: 'Спецучет & Безопасность',
    authority: 'Федеральная служба по финансовому мониторингу РФ',
    description: 'Официальный перечень физических и юридических лиц, в отношении которых имеются сведения об их причастности к экстремизму или терроризму (блокировка счетов).',
    officialUrl: 'https://www.fedsfm.ru/documents/terrorists-catalog-portal-act',
    badge: 'Финмониторинг',
    buildQueryUrl: () => `https://www.fedsfm.ru/documents/terrorists-catalog-portal-act`,
  },
  {
    id: 'interpol-red',
    name: 'Интерпол // Реестр международного розыска (Red Notices)',
    category: 'Спецучет & Безопасность',
    authority: 'INTERPOL General Secretariat (Lyon)',
    description: 'Международные ордеры на арест и розыск беглецов от правосудия по всему миру.',
    officialUrl: 'https://www.interpol.int/How-we-work/Notices/Red-Notices/View-Red-Notices',
    badge: 'Международный розыск',
    buildQueryUrl: (t) => `https://www.interpol.int/How-we-work/Notices/Red-Notices/View-Red-Notices?name=${encodeURIComponent(t.fio || '')}`,
  },

  // 7. Leaks & Cyber OSINT
  {
    id: 'hibp-breaches',
    name: 'Have I Been Pwned? (HIBP v3)',
    category: 'Утечки & Киберразведка',
    authority: 'Troy Hunt / Global Breach Archive',
    description: 'Проверка компрометации Email и логинов в крупнейших публичных утечках баз данных по всему миру (более 14 млрд записей).',
    officialUrl: 'https://haveibeenpwned.com/',
    badge: 'Утечки баз данных',
    buildQueryUrl: (t) => `https://haveibeenpwned.com/account/${encodeURIComponent(t.email || '')}`,
  },
  {
    id: 'intelx-search',
    name: 'Intelligence X (IntelX OSINT Engine)',
    category: 'Утечки & Киберразведка',
    authority: 'Intelligence X Archive',
    description: 'Поисковый архив Darknet, пастбинов, утечек, дампов баз данных, WHOIS архивов и правительственных документов.',
    officialUrl: 'https://intelx.io/',
    badge: 'Darknet Архив',
    buildQueryUrl: (t) => `https://intelx.io/?s=${encodeURIComponent(t.email || t.phone || t.inn || '')}`,
  },
];
