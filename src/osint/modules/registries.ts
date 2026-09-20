/**
 * MODULE: registries — official registry query planning (RU + international)
 * ---------------------------------------------------------------------------
 * Most official registries (ЕГРЮЛ, ФССП, кад.арбитр, Росреестр, ГИБДД, реестр
 * залогов) have **no public API and no CORS** — pretending otherwise would mean
 * fabricating data. Instead this module produces a *deterministic, verified
 * query plan*: exact deep-links pre-filled with the subject's identifier, the
 * legal basis for each request, what to extract, and cross-checks to perform.
 * The analyst (or a lawful automated pipeline behind a server) executes it, and
 * the plan itself is stored in the evidence chain with its generation time.
 *
 * Where an official machine-readable endpoint does exist, the module calls it
 * directly (SEC EDGAR company search, EU VIES, GLEIF) — see the screening module.
 */

import type { ModuleInput, ModuleResult, OsintModule } from '../types/module';
import { evidence, risk, DIRECTORY_LINKS, truncate } from './common';
import { transliterate, parseFullName } from '../algo/stringdistance';
import { parseRuPlate, decodeVin, regionByCode } from '../algo/ruIdentifiers';

const MODULE_ID = 'legal.registries';

interface RegistryQuery {
  id: string;
  name: string;
  authority: string;
  url: string;
  purpose: string;
  extract: string[];
  legalBasis: string;
  apiAvailable: boolean;
}

function buildQueries(input: ModuleInput): RegistryQuery[] {
  const value = (input.entity.label || input.entity.value).trim();
  const parts = parseFullName(value);
  const fio = `${parts.last ?? ''} ${parts.first ?? ''} ${parts.middle ?? ''}`.trim() || value;
  const latinFio = transliterate(fio, 'icao');
  const queries: RegistryQuery[] = [];

  if (['person', 'alias', 'document', 'tax_id'].includes(input.entity.type)) {
    const identifier = /^\d{10,12}$/.test(value.replace(/\D/g, '')) ? value.replace(/\D/g, '') : '';
    queries.push(
      {
        id: 'fns-egrul-fl',
        name: 'ЕГРЮЛ/ЕГРИП — поиск по ФИО и ИНН',
        authority: 'ФНС России',
        url: DIRECTORY_LINKS.egrul(identifier || fio),
        purpose: 'Установить участие в юрлицах, статус ИП, должности руководителя и учредителя',
        extract: ['ИНН организации', 'ОГРН', 'роль (директор/учредитель)', 'доля участия', 'статус (действующее/ликвидировано)'],
        legalBasis: 'Открытые данные ФНС (ст. 5 ФЗ №129-ФЗ), выписки доступны без регистрации',
        apiAvailable: false,
      },
      {
        id: 'fssp-ip',
        name: 'Банк данных исполнительных производств',
        authority: 'ФССП России',
        url: DIRECTORY_LINKS.fssp(),
        purpose: 'Выявить взыскания, алименты, аресты, запреты на выезд (ключевой индикатор платёжеспособности)',
        extract: ['номер ИП', 'сумма', 'предмет исполнения', 'отдел приставов', 'статус'],
        legalBasis: 'ФЗ №229-ФЗ «Об исполнительном производстве», публичный реестр',
        apiAvailable: false,
      },
      {
        id: 'kad-arbitr',
        name: 'Картотека арбитражных дел',
        authority: 'Верховный Суд РФ / sudact',
        url: DIRECTORY_LINKS.kadArbitr(fio),
        purpose: 'Найти участие в арбитражных спорах: банкротства, субсидиарная ответственность, корпоративные конфликты',
        extract: ['роль (истец/ответчик/третье лицо)', 'номер дела', 'сумма иска', 'связанные компании', 'исход'],
        legalBasis: 'ФЗ №95-ФЗ, открытые данные судебной системы',
        apiAvailable: false,
      },
      {
        id: 'sudrf-gosuslugi',
        name: 'ГАС «Правосудие» / мировые судьи',
        authority: 'Судебный департамент',
        url: DIRECTORY_LINKS.sudrf(fio),
        purpose: 'Уголовные и административные дела, лишение прав, административные наказания',
        extract: ['статья', 'результат рассмотрения', 'дата', 'суд'],
        legalBasis: 'ФЗ №262-ФЗ «Об обеспечении доступа к информации о деятельности судов»',
        apiAvailable: false,
      },
      {
        id: 'rosreestr',
        name: 'ЕГРН / Публичная кадастровая карта',
        authority: 'Росреестр',
        url: DIRECTORY_LINKS.rosreestr(fio),
        purpose: 'Выявить недвижимость, доли, кадастровую стоимость, обременения',
        extract: ['кадастровый номер', 'тип объекта', 'площадь', 'доля', 'обременения', 'кадастровая стоимость'],
        legalBasis: 'ФЗ №218-ФЗ «О государственной регистрации недвижимости»; сведения о правообладателе — по запросу',
        apiAvailable: false,
      },
      {
        id: 'nalog-debts',
        name: 'Задолженность по налогам и сборам',
        authority: 'ФНС России',
        url: 'https://service.nalog.ru/debt/',
        purpose: 'Проверить налоговые задолженности субъекта',
        extract: ['сумма задолженности', 'вид налога', 'пеня'],
        legalBasis: 'Публичный сервис ФНС',
        apiAvailable: false,
      },
      {
        id: 'fedresurs',
        name: 'ЕФРСБ (Федресурс) — реестр банкротств',
        authority: 'АО «Интерфакс» по поручению Правительства РФ',
        url: `https://fedresurs.ru/search/faces?searchString=${encodeURIComponent(fio)}`,
        purpose: 'Установить процедуры банкротства физического лица, сообщения о существенных фактах',
        extract: ['номер дела о банкротстве', 'дата процедуры', 'арбитражный управляющий', 'торги'],
        legalBasis: 'ФЗ №127-ФЗ, ФЗ №218 (открытые сведения)',
        apiAvailable: false,
      },
      {
        id: 'disqualified',
        name: 'Реестр дисквалифицированных лиц',
        authority: 'ФНС России',
        url: 'https://service.nalog.ru/disqualified.do',
        purpose: 'Проверить запрет на занятие руководящих должностей',
        extract: ['дата дисквалификации', 'срок', 'орган, вынесший решение'],
        legalBasis: 'КоАП РФ ст. 3.11, публичный реестр ФНС',
        apiAvailable: false,
      },
      {
        id: 'international-legal',
        name: 'Международные корпоративные реестры',
        authority: 'OpenCorporates / Companies House / SEC EDGAR',
        url: DIRECTORY_LINKS.opensecrets(latinFio),
        purpose: 'Определить участие в зарубежных компаниях и офшорных структурах',
        extract: ['наименование компании', 'юрисдикция', 'роль', 'дата регистрации'],
        legalBasis: 'Публичные реестры соответствующих юрисдикций',
        apiAvailable: false,
      },
    );
  }

  if (input.entity.type === 'organization' || /^\d{13}$|^\d{15}$/.test(value.replace(/\D/g, ''))) {
    const digits = value.replace(/\D/g, '');
    queries.push(
      {
        id: 'pb-nalog',
        name: 'Прозрачный бизнес — комплексная проверка контрагента',
        authority: 'ФНС России',
        url: `https://pb.nalog.ru/search.html#search-result?querySearch=${encodeURIComponent(digits || value)}`,
        purpose: 'Налоговая отчётность, среднесписочная численность, недоимки, дисквалификации, адрес массовой регистрации',
        extract: ['выручка', 'налоги уплачены', 'численность', 'недоимка', 'признаки однодневки'],
        legalBasis: 'Открытые данные ФНС (приказ ФНС от 30.06.2020)',
        apiAvailable: false,
      },
      {
        id: 'egrul-full',
        name: 'Выписка из ЕГРЮЛ (гендиректор, учредители, ОКВЭД)',
        authority: 'ФНС России',
        url: DIRECTORY_LINKS.egrul(digits || value),
        purpose: 'Структура владения, руководитель, филиалы, история изменений',
        extract: ['учредители и доли', 'руководитель', 'ОКВЭД', 'адрес', 'обособленные подразделения'],
        legalBasis: 'ФЗ №129-ФЗ ст. 6 — сведения открыты и общедоступны',
        apiAvailable: false,
      },
      {
        id: 'fssp-org',
        name: 'Исполнительные производства юрлица',
        authority: 'ФССП России',
        url: DIRECTORY_LINKS.fssp(),
        purpose: 'Взыскания в пользу контрагентов и бюджета, арест счетов',
        extract: ['сумма взысканий', 'номер ИП', 'пристав'],
        legalBasis: 'ФЗ №229-ФЗ',
        apiAvailable: false,
      },
      {
        id: 'fas-rnp',
        name: 'Реестр недобросовестных поставщиков / антимонопольные дела',
        authority: 'ФАС России',
        url: 'https://rnp.fas.gov.ru/',
        purpose: 'Проверить exclusion из госзакупок и нарушения антимонопольного законодательства',
        extract: ['запись РНП', 'основание', 'срок'],
        legalBasis: 'ФЗ №44-ФЗ ст. 104',
        apiAvailable: false,
      },
      {
        id: 'rosstat-okpo',
        name: 'Коды организации (ОКПО, ОКТМО, ОКВЭД)',
        authority: 'Росстат',
        url: 'https://www.gks.ru/accounting_report',
        purpose: 'Верифицировать профиль деятельности компании',
        extract: ['ОКВЭД', 'ОКТМО', 'ОКПО'],
        legalBasis: 'Открытые данные Росстата',
        apiAvailable: false,
      },
      {
        id: 'tm-view',
        name: 'Реестр товарных знаков',
        authority: 'Роспатент (ФИПС)',
        url: 'https://www1.fips.ru/registers-web/',
        purpose: 'Определить интеллектуальную собственность и связанные заявки',
        extract: ['номер свидетельства', 'правообладатель', 'дата приоритета'],
        legalBasis: 'Публичные реестры Роспатента',
        apiAvailable: false,
      },
    );
  }

  if (input.entity.type === 'vehicle' || /^[A-HJ-NPR-Z0-9]{17}$/i.test(value) || /[А-ЯA-Z]\s?\d{3}/i.test(value)) {
    const isVin = /^[A-HJ-NPR-Z0-9]{17}$/i.test(value.replace(/\s/g, ''));
    const vin = isVin ? decodeVin(value.replace(/\s/g, '')) : undefined;
    const plate = !isVin ? parseRuPlate(value) : undefined;
    queries.push(
      {
        id: 'gibdd-check',
        name: 'Проверка автомобиля в ГИБДД (история регистраций, ДТП, ограничения)',
        authority: 'МВД РФ',
        url: 'https://гибдд.рф/check/auto',
        purpose: 'Установить историю регистраций, участие в ДТП, нахождение в розыске, ограничения на регистрационные действия',
        extract: ['период регистрации', 'регион', 'число владельцев', 'ДТП', 'розыск', 'ограничения'],
        legalBasis: 'Постановление Правительства РФ №1156, публичный сервис',
        apiAvailable: false,
      },
      {
        id: 'reestr-zalogov',
        name: 'Реестр уведомлений о залоге движимого имущества',
        authority: 'Федеральная нотариальная палата',
        url: `https://www.reestr-zalogov.ru/search/index?searchType=vehicle&number=${encodeURIComponent(isVin ? value : (plate?.details.normalized as string) ?? value)}`,
        purpose: 'Выявить залог/лизинг: распространённая схема сокрытия обременения при продаже',
        extract: ['залогодержатель', 'дата уведомления', 'номер уведомления', 'рейтинг (кредитная история)'],
        legalBasis: 'Основы законодательства РФ о нотариате, ст. 34.4 — реестр открыт',
        apiAvailable: false,
      },
      {
        id: 'osago-rsa',
        name: 'Проверка полиса ОСАГО',
        authority: 'РСА (Российский союз автостраховщиков)',
        url: 'https://dkbm-web.autoins.ru/dkbm-web-1.0/osagovehicle.htm',
        purpose: 'Проверить действительность полиса и период страхования (косвенно — период владения ТС)',
        extract: ['статус полиса', 'период действия', 'страховая компания'],
        legalBasis: 'ФЗ №40-ФЗ «Об ОСАГО», публичный сервис РСА',
        apiAvailable: false,
      },
      {
        id: 'avtoteka',
        name: 'Электронный ПТС / история регистраций',
        authority: 'АО «Электронный паспорт»',
        url: 'https://avtoteka.ru/',
        purpose: 'Получить открытые сведения об электронном ПТС и смене владельцев',
        extract: ['число владельцев', 'записи о смене собственника'],
        legalBasis: 'Открытые сведения системы ЭПТС',
        apiAvailable: false,
      },
    );
    if (vin?.modelYear) {
      queries.push({
        id: 'vin-decoder',
        name: 'Расшифровка VIN (заводские данные)',
        authority: 'NHTSA vPIC / производитель',
        url: `https://vpic.nhtsa.dot.gov/decoder/Decoder/Index?VIN=${encodeURIComponent(value)}`,
        purpose: 'Сверить заводскую комплектацию и год выпуска с заявленными продавцом',
        extract: ['модель', 'год', 'сборка', 'тип двигателя', 'комплектация'],
        legalBasis: 'Открытое API NHTSA vPIC (публичные данные)',
        apiAvailable: true,
      });
    }
  }

  if (input.entity.type === 'real_estate') {
    queries.push({
      id: 'rosreestr-object',
      name: 'ЕГРН по объекту недвижимости',
      authority: 'Росреестр',
      url: DIRECTORY_LINKS.rosreestr(value),
      purpose: 'Правообладатель, обременения, аресты, история переходов прав',
      extract: ['правообладатель', 'обременения', 'кадастровая стоимость', 'история прав'],
      legalBasis: 'ФЗ №218-ФЗ; сведения ограниченного доступа — только по законному запросу',
      apiAvailable: false,
    });
  }

  if (input.entity.type === 'domain') {
    queries.push(
      {
        id: 'nic-ru',
        name: 'WHOIS истории доменов .RU/.РФ',
        authority: 'Координационный центр .RU/.РФ / ТЦИ',
        url: `https://www.nic.ru/whois/?searchWord=${encodeURIComponent(value)}`,
        purpose: 'Дата регистрации, организация администратора, история делегирования',
        extract: ['registered', 'org', 'admin-contact', 'nserver'],
        legalBasis: 'Правила регистрации доменов, публичный WHOIS',
        apiAvailable: false,
      },
      {
        id: 'rospatent-tm',
        name: 'Проверка домена на бренд (товарные знаки)',
        authority: 'Роспатент',
        url: 'https://www1.fips.ru/registers-web/',
        purpose: 'Установить наличие товарного знака — важно для оценки правомерности использования домена',
        extract: ['номер ТЗ', 'правообладатель'],
        legalBasis: 'Публичные реестры Роспатента',
        apiAvailable: false,
      },
    );
  }

  return queries;
}

export const registriesModule: OsintModule = {
  id: MODULE_ID,
  name: 'Официальные реестры: план проверок и правовые основания',
  category: 'legal',
  description:
    'Формирует детерминированный план проверок по официальным реестрам РФ и зарубежья с предзаполненными ссылками, перечнем извлекаемых данных и правовым основанием каждого запроса. Там, где публичного API нет, модуль честно помечает обязательный ручной шаг вместо фабрикации данных.',
  accepts: ['person', 'organization', 'vehicle', 'real_estate', 'tax_id', 'document', 'domain', 'alias'],
  produces: ['service', 'organization'],
  requiresNetwork: false,
  cost: 0.5,
  priority: 84,
  tags: ['registries', 'offline-planning', 'legal'],
  dataSources: ['ЕГРЮЛ/ЕГРИП (ФНС)', 'ФССП', 'КАД Арбитр', 'ГАС «Правосудие»', 'ЕГРН (Росреестр)', 'ГИБДД', 'Реестр залогов (ФНП)', 'ЕФРСБ', 'Роспатент', 'OpenCorporates', 'SEC EDGAR'],
  run(input: ModuleInput): ModuleResult {
    const queries = buildQueries(input);
    const out: ModuleResult = { evidence: [], riskFactors: [], notes: [], entities: [] };

    if (!queries.length) {
      return { notes: [`Для типа «${input.entity.type}» реестровый план не сформирован (нет применимых реестров)`] };
    }

    out.evidence?.push(
      evidence(
        'registry.plan',
        `Сформирован план из ${queries.length} официальных проверок для «${input.entity.label}»`,
        queries,
        { name: 'Каталог официальных реестров TOMAHAWK', kind: 'dataset' },
        { reliability: 0.9, tags: ['registry', 'plan'] },
      ),
    );

    for (const query of queries) {
      out.evidence?.push(
        evidence(`registry.${query.id}`, `${query.name} (${query.authority}): ${query.purpose}`, { url: query.url, extract: query.extract, legalBasis: query.legalBasis, apiAvailable: query.apiAvailable }, { name: query.authority, kind: 'registry', url: query.url }, { reliability: 0.9, tags: ['registry', query.id] }),
      );
      out.entities?.push({
        type: 'service',
        value: query.name,
        label: query.name,
        tags: ['registry-check'],
        confidence: 0.85,
        properties: { authority: query.authority, url: query.url, apiAvailable: query.apiAvailable },
      });
    }

    out.evidence?.push(
      evidence(
        'registry.compliance',
        'Правовая рамка: обработка ведётся по открытым государственным источникам; для запросов ограниченного доступа (персональные данные из ЕГРН, ЗАГС, операторы связи) требуется законное основание, и такие шаги модуль не выполняет автоматически',
        { openRegistries: queries.filter((query) => query.apiAvailable === false).length, note: 'ФЗ №152-ФЗ «О персональных данных»' },
        { name: 'Комплаенс-заметка TOMAHAWK', kind: 'heuristic' },
        { reliability: 1, tags: ['compliance'] },
      ),
    );

    const automatic = queries.filter((query) => query.apiAvailable);
    if (automatic.length) {
      out.notes?.push(`${automatic.length} из ${queries.length} проверок имеют публичный API и могут быть автоматизированы: ${automatic.map((query) => query.id).join(', ')}`);
    }
    out.notes?.push(`Ручных проверок: ${queries.length - automatic.length}. Ссылки предзаполнены и готовы к использованию аналитиком`);

    const region = typeof input.entity.properties.region === 'string' ? (regionByCode(String(input.entity.properties.region).slice(0, 2))?.name ?? null) : null;
    if (region) {
      out.evidence?.push(evidence('registry.region-context', `Региональный контекст проверок: ${region} (коды регионов определяют подсудность и налоговый орган)`, region, { name: 'Классификатор субъектов РФ', kind: 'dataset' }, { reliability: 0.9, tags: ['geo', 'legal'] }));
    }

    out.riskFactors?.push(risk('legal.enforcement-proceedings', 0.25, `Выполнение плана из ${queries.length} проверок обязательно: наличие исполнительных производств и судебных дел не проверено автоматически`, [], { label: 'Реестровые проверки не выполнены автоматически', explain: truncate(`Официальные реестры (ФССП, кад.арбитр, ЕГРН) не имеют публичного API — требуется ручная или серверная проверка по сформированному плану`, 220) }));

    out.metrics = { plannedChecks: queries.length, automatedChecks: automatic.length };
    return out;
  },
};

export const registryModules = [registriesModule];
