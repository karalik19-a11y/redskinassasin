# TOMAHAWK OSINT ENGINE — движок как библиотека

Профессиональный, детерминированный OSINT-движок на чистом TypeScript: **12 модулей сбора**, слой сведения наблюдений, графовая аналитика, объяснимая модель риска, экспорт в 6 форматов и полная проверка векторами. Ноль зависимостей, ноль Node-API — работает в браузере, веб-воркере, Node, Deno, Bun и edge-рантаймах.

```ts
import { createOsintEngine } from './osint';

const engine = createOsintEngine({ settings: { profile: 'person-fast' } });
const report = await engine.investigate({ input: '+7 (916) 402-91-88, m.sokolov@example.com' });

console.log(report.risk.score, report.risk.level);      // 13.7 'low'
console.log(report.findings.slice(0, 3).map((f) => f.title));
console.log(engine.export(report, 'markdown'));
```

Один импорт — вся функциональность: `import { ... } from './osint'`.

---

## 1. Зачем это, если есть отдельные утилиты

Приложение умеет валидировать ИНН и резолвить DNS. Движок решает другую задачу: **превращает разрозненные проверки в расследование**. Аналитик вставляет одну строку — «Соколов Михаил Андреевич, +7 916…, m.sokolov@example.com, ИНН 7707083893, sokolov-holding.ru» — и получает:

1. **Авто-триаж**: из свободного текста извлекаются и валидируются идентификаторы (телефон → E.164, ИНН → контрольная сумма, домен → registrable domain, VIN → контрольный разряд…). Что не распознано — честно показывается отдельно.
2. **Планирование**: модули декларируют `accepts`/`produces`, планировщик строит DAG и говорит заранее, что будет выполнено, а что пропущено (и почему).
3. **Сбор с расширением по связям**: домен → IP → ASN/сеть/владелец → PTR → домен; e-mail → домен → почтовая защита → утечки; адрес → контрагенты → кластер владельца. Глубина ограничена (`maxDepth`) и бюджетом времени.
4. **Сведение (fusion)**: одно и то же утверждение из разных источников комбинируется в логарифмических шансах с поправкой на корреляцию источников; противоречия помечаются `disputed`, а не «усредняются».
5. **Аналитика**: центральность (degree/harmonic/eigenvector), сообщества, предсказание скрытых связей (Adamic–Adar), кластеризация аккаунтов по никнейму/аватару, темпоральные всплески, оценка часового пояса по часам активности.
6. **Риск**: noisy-OR по взвешенным факторам с вкладом каждого фактора, контрфактикой («что будет, если устранить главный фактор») и разбивкой по категориям.
7. **Отчёт**: сущности, связи, наблюдения с источником и транспортом (`via`), находки с рекомендациями, хронология, покрытие (что проверено и что нет), трассировка запуска и печати SHA-256.

Без фейковых генераторов и симуляций: если источник недоступен — это фиксируется как предупреждение, а не превращается в «данные».

---

## 2. Быстрый старт

### Минимально

```ts
import { createOsintEngine } from './osint';

const engine = createOsintEngine();
const report = await engine.investigate({ input: '7707083893' });
```

### С прогрессом для интерфейса

```ts
const engine = createOsintEngine({
  settings: { profile: 'full-spectrum' },
  onEvent: (event) => {
    if (event.type === 'module.completed') console.log(event.payload.record.moduleId, event.payload.record.evidenceCount);
    if (event.type === 'risk.updated') console.log('риск:', event.payload.risk.score);
  },
});
```

### React-адаптер

```tsx
import { useOsint } from './osint/react/useOsint';

function Panel() {
  const { run, running, phase, progress, report, exportAs } = useOsint({ profile: 'domain-infra' });
  return (
    <>
      <button disabled={running} onClick={() => run('sokolov-holding.ru')}>Проверить домен</button>
      {running && <p>{phase}: {progress.modulesDone} модулей, {progress.evidence} наблюдений</p>}
      {report && <p>Риск {report.risk.score}/100</p>}
      {report && <button onClick={() => download(exportAs('stix2'))}>STIX 2.1</button>}
    </>
  );
}
```

### Превью до запуска (без единого запроса)

```ts
const plan = engine.plan('+7 916 402-91-88');
// plan.modules — какие модули сработают
// plan.skipped.offline / plan.skipped.profile — что и почему не будет выполнено
// plan.estimatedRequests — оценка числа запросов
```

---

## 3. Настройки

| Параметр | По умолчанию | Смысл |
|---|---|---|
| `profile` | `full-spectrum` | Профиль: набор категорий, глубина, бюджет (`person-fast`, `company-full`, `domain-infra`, `infra-deep`, …) |
| `offline` | `false` | Только локальные алгоритмы и справочники; сетевые модули пропускаются |
| `maxDepth` | профиль | Глубина расширения по пивотам |
| `budgetMs` | профиль | Жёсткий бюджет времени на весь запуск |
| `concurrency` | 5–6 | Параллельных модулей |
| `maxEntities` | 400 | Лимит узлов графа (защита от комбинаторного взрыва) |
| `transit` | `['direct', …]` | Цепочка CORS-транзитов: `direct`, `allorigins`, `codetabs`, `jina`… Каждый факт помнит, каким путём он получен |
| `includeHeuristics` | `true` | Отключает эвристические факторы риска (для комплаенса) |
| `apiKeys` | `{}` | Ключи (HIBP, Shodan…). Возможность **не деградирует молча**: без ключа модуль выдаёт план проверки, а не пустоту |
| `userAgent` | `TOMAHAWK-OSINT/1.0` | Заголовок для внешних API |

Приватность по умолчанию: проверка пароля — только k-anonymity (первые 5 символов SHA-1, `add-padding: true`); полный хеш и пароль не покидают устройство.

---

## 4. Модули

| Модуль | Категория | Что делает | Сеть |
|---|---|---|---|
| `identity.identifiers` | identity | ИНН/ОГРН/СНИЛС/БИК/паспорт/ГРЗ/VIN/IMEI/IBAN/EAN — контрольные суммы, регионы, подсказки | нет |
| `identity.artifacts` | identity | Разбор произвольных цифровых артефактов (номеров, кодов, хэшей) | нет |
| `identity.person` | identity | Сопоставление ФИО с учётом транслитерации, опечаток и порядка слов | частично |
| `telecom.phone` | telecom | E.164, оператор и регион по DEF-коду, MVNO-пометки, мессенджеры | нет |
| `infrastructure.network` | infrastructure | DoH (A/AAAA/MX/TXT/NS/CNAME/SOA/CAA), SPF/DKIM/DMARC/MTA-STS/BIMI, RDAP домена и сети, гео/ASN IP, PTR-пивоты | да |
| `infrastructure.certificates` | infrastructure | Certificate Transparency (crt.sh): поддомены, чувствительные имена, история выпусков, общий сертификат → общий владелец | да |
| `web.page` | web | Метаданные страницы с регекс-парсером: контакты, соцсети, счётчики аналитики (владелец), security.txt/robots.txt | да |
| `social.footprint` | social | 24 площадки: API-проверка (GitHub, GitLab, Reddit, Bluesky…) и soft-404 пробы (Telegram, VK, Instagram…) | да |
| `exposure.breach` | exposure | Утечки: k-anonymity проверка пароля, локальный анализ силы, ролевые/одноразовые адреса, MX, план проверок | да/нет |
| `finance.crypto` | crypto | BTC/EVM/TRON/SOL/XMR: контрольные суммы, баланс, активность, **кластеризация по общим входам**, контрагенты, метки микшеров | да |
| `legal.screening` | legal | Санкции/PEP (OpenSanctions), реестр LEI (GLEIF), VAT (VIES), Wikidata; локальный fuzzy-скрининг с порогом | да |
| `legal.registries` | legal | Детерминированный план проверок по официальным реестрам РФ и мира с правовым основанием и ссылками | нет |
| `media.image` | media | EXIF/XMP/IPTC/PNG-чанки, GPS → геокоордината, pHash/dHash/aHash, ELA, план обратного поиска, Gravatar | частично |
| `geospatial.location` | geospatial | Обратное геокодирование (OSM), геохэши и соседи, оценка часового пояса, расстояния/азимуты, проверка реализуемости перемещений | да |
| `temporal.timeline` | temporal | Нормализованная хронология, всплески (Пуассон), часовой пояс по активности, аномалии режима | нет |

Добавить свой модуль:

```ts
import type { OsintModule } from './osint';

const myModule: OsintModule = {
  id: 'custom.registry',
  name: 'Внутренний реестр клиентов',
  category: 'custom',
  accepts: ['person', 'tax_id'],
  produces: ['organization'],
  requiresNetwork: false,
  async run(input, ctx) {
    return { evidence: [...], entities: [...], notes: ['источник: CRM'] };
  },
};

engine.register(myModule);
```

---

## 5. Что гарантируется

- **Каждый факт — с источником**: `Evidence.source` (имя, класс, URL, лицензия) и `via` (какой транспорт доставил). Нет источника — нет факта.
- **Воспроизводимость**: идентификаторы детерминированы (содержательные, не случайные), отчёт печатается SHA-256. `integrity.contentDigest` — печать содержимого без временных меток: два прогона на одних данных дают одинаковую строку, её можно сравнить или опубликовать вместе с отчётом. `integrity.reportDigest` дополнительно фиксирует отчёт целиком вместе со временем запуска, `evidenceDigest` — цепочку наблюдений. Детерминизм проверяется в `npm run verify`.
- **Честный отказ**: недоступный источник → `notes`, статус `error`/`empty` в трассировке, предупреждение в `narrative.caveats`. Никаких «правдоподобных» значений.
- **Бюджет и отмена**: `AbortSignal`, лимит времени, лимит запросов и узлов; по исчерпании бюджетa отчёт помечается `budgetExhausted`.
- **Оффлайн-режим**: `offline: true` → сеть не используется вообще, работают контрольные суммы, эвристики, разбор входных данных и планировщик.
- **Ноль зависимостей и ноль Node-API**: только `fetch`, Web Crypto и стандартные типы. Хэширование (MD5/SHA-1/SHA-256/Keccak-256), CRC, контрольные суммы, pHash, EXIF-парсер — собственные реализации с векторами.

---

## 6. Экспорт

```ts
engine.export(report, 'json');       // полный отчёт
engine.export(report, 'jsonl');      // поток записей (entity/edge/evidence/finding)
engine.export(report, 'csv', 'evidence');
engine.export(report, 'graphml');    // Gephi/yEd: узлы с центральностью, рёбра с весами
engine.export(report, 'stix2');      // STIX 2.1 bundle: identity/indicator/relationship
engine.export(report, 'markdown');   // готовый документ для отчёта
```

---

## 7. Проверка (векторы)

```bash
npm run verify     # npx tsx scripts/verify-engine.ts
```

126 проверок с **заранее известными** ответами: Luhn/IBAN/EAN/Verhoeff, алгоритмы ФНС/ПФР/ГИБДД, ГОСТ Р 50577 (ГРЗ в кириллице и латинице, спецсерии), ISO 3779 (VIN), геохэш/Haversine/азимут, Левенштейн/Джаро-Уинклер/фонетика RU, нормализация телефонов/почты/доменов (IDN-гомоглифы), энтропия/DGA, pHash/EXIF, авто-триаж входной строки, полный прогон движка в оффлайне и сетевой прогон на подменённом `fetch` (DoH, RDAP, CT, HIBP, OpenSanctions, GLEIF, mempool.space), а также инварианты приватности (k-anonymity) и детерминизма.

Стенд проверяет не «код запустился», а **физику и математику**: например, что `+7 916 402-91-88` распознаётся как телефон, а не как СНИЛС; что кириллическая `аpple.com` помечается как гомоглифная атака; что в HIBP уходит ровно 5 символов префикса.

---

## 8. Архитектура

```
src/osint/
  types/         контракты: entity, evidence, module, report, events (дискриминированные union'ы)
  core/          ids, cache, concurrency, errors, graph, fusion, analytics, risk, findings,
                 planner, seeds (авто-триаж), export, store, engine (оркестратор)
  algo/          hashes, keccak, base58, bech32, checksums, ruIdentifiers, stringdistance,
                 normalize, geospatial, entropy, phash, exif, …
  net/           transit (CORS-цепочка), http (лимиты, кэш, ретраи, provenance), dns (DoH, почтовая защита)
  datasets/      defCodes (DEF-матрица РФ, федеральные округа)
  presets/       profiles (профили расследований)
  modules/       модули сбора + index (createDefaultModules)
  react/         необязательный адаптер (useOsint)
  index.ts       единственная публичная точка входа
```

Слои зависят только вниз: `types → core → algo → net → modules`. UI никогда не входит в ядро; сеть доступна только через внедрённый `HttpGateway`, поэтому движок одинаково работает в браузере, воркере и на сервере (там можно указать `transit: ['direct']`).

---

## 9. Правовые и этические рамки

Движок работает **только с открытыми источниками** и публичными API. Модуль `legal.registries` не выполняет запросы к реестрам ограниченного доступа (ЕГРН-ПД, ЗАГС, операторы связи) — он выдаёт план проверок с правовым основанием для каждой, а решение и законное основание остаются за аналитиком. Проверка паролей ограничена k-anonymity. Приватные метаданные изображений могут содержать персональные данные — используйте их только в законных целях (ФЗ-152 и применимое законодательство).
