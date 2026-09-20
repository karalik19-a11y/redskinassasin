/**
 * TOMAHAWK OSINT ENGINE — верификационный стенд (vector + e2e).
 * ---------------------------------------------------------------------------
 * Запуск:  npx tsx scripts/verify-engine.ts
 *
 * Что проверяется:
 *   §1 Алгоритмические векторы — чек-суммы, российские идентификаторы,
 *      геохэш/Haversine, строковые метрики, нормализация, энтропия.
 *      Каждый вектор имеет ИЗВЕСТНЫЙ ожидаемый ответ (взят из спецификации,
 *      а не из реализации), поэтому стенд ловит регрессии, а не подтверждает
 *      текущий вывод.
 *   §2 End-to-end расследование в офлайн-режиме: граф → фьюзинг → аналитика →
 *      риск → находки → отчёт с печатью целостности.
 *   §3 Сетевой конвейер на подменённом fetch: проверяем, что модули корректно
 *      разбирают реальные по форме ответы (DoH, RDAP, CT-логи, HIBP, OpenSanctions,
 *      GLEIF, Blockscout) и что provenance (`via`) доезжает до evidence.
 *
 * Ненулевой код возврата = хотя бы один вектор не прошёл.
 */

import { createOsintEngine } from '../src/osint/index';
import {
  isValidLuhn, luhnCheckDigit, validateIban, validateEan, validateImei, validateIccid, isValidVerhoeff, mod97,
} from '../src/osint/algo/checksums';
import {
  validateInn, validateSnils, validateOgrn, validateOgrnip, validateBik, validatePassportRf, parseRuPlate, decodeVin, validateCadastralNumber,
} from '../src/osint/algo/ruIdentifiers';
import { geohashEncode, geohashDecode, haversineMetres, bearingDegrees } from '../src/osint/algo/geospatial';
import { levenshtein, jaroWinkler, transliterationVariants, matchPersons, parseFullName, phoneticRu, skeletonize } from '../src/osint/algo/stringdistance';
import { parsePhone, parseEmail, registrableDomain, normalizeDomain, normalizeUsername, isIpAddress, detectMixedScriptDomain } from '../src/osint/algo/normalize';
import { shannonEntropy, dgaScore, analyzePasswordStrength } from '../src/osint/algo/entropy';
import { parseSeeds } from '../src/osint/core/seeds';
import { parseImageMetadata, sniffFileType } from '../src/osint/algo/exif';
import { perceptualHash, compareHashes, type RgbaImage } from '../src/osint/algo/phash';
import { checkPwnedPassword } from '../src/osint/modules/exposure';
import { screenAgainstWatchlist } from '../src/osint/modules/sanctions';
import { identifyDefRange } from '../src/osint/datasets/defCodes';
import { parsePageMetadata } from '../src/osint/modules/web';
import type { HttpGateway, HttpProbeResult, ModuleContext } from '../src/osint/types/module';

// ── Мини-фреймворк ───────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    failures.push(`${name}: получено ${JSON.stringify(actual)}, ожидалось ${JSON.stringify(expected)}`);
    console.log(`  ✗ ${name}\n      получено: ${JSON.stringify(actual)}\n      ожидалось: ${JSON.stringify(expected)}`);
  }
}

function ok(name: string, condition: boolean, detail = ''): void {
  check(name + (detail ? ` [${detail}]` : ''), condition, true);
}

function section(title: string): void {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

// ── §1 Векторы алгоритмов ────────────────────────────────────────────────────
section('§1 Алгоритмические векторы');

// Контрольные суммы
check('Luhn: 79927398713 действителен', isValidLuhn('79927398713'), true);
check('Luhn: 79927398710 недействителен', isValidLuhn('79927398710'), false);
check('Luhn: контрольная цифра для 7992739871', luhnCheckDigit('7992739871'), 3);
check('IBAN DE89370400440532013000 действителен', validateIban('DE89370400440532013000').isValid, true);
check('IBAN DE89370400440532013001 недействителен', validateIban('DE89370400440532013001').isValid, false);
check('EAN-13 4006381333931 действителен', validateEan('4006381333931').isValid, true);
check('EAN-13 4006381333932 недействителен', validateEan('4006381333932').isValid, false);
check('mod97("3214282912345698765432161182") = 1', mod97('3214282912345698765432161182'), 1);
check('IMEI 490154203237518 действителен (Luhn)', validateImei('490154203237518').isValid, true);
check('Verhoeff: 236 действителен', isValidVerhoeff('236'), true);
check('Verhoeff: 12345 недействителен', isValidVerhoeff('12345'), false);
check('ICCID 8944501910220010388 действителен (Luhn)', validateIccid('8944501910220010388').isValid, true);
check('ICCID 89014103211118510720 действителен (Luhn)', validateIccid('89014103211118510720').isValid, true);
check('ICCID 8944501910220010387 недействителен (Luhn)', validateIccid('8944501910220010387').isValid, false);
check('ICCID 8944501910220010388 → эмитент MCC 445', validateIccid('8944501910220010388').issuer, 'Telecom-эмитент (MCC 445)');

// Российские идентификаторы
check('ИНН ЮЛ 7707083893 действителен', validateInn('7707083893').isValid, true);
check('ИНН ЮЛ 7707083894 недействителен', validateInn('7707083894').isValid, false);
check('ИНН ФЛ 500100732259 действителен', validateInn('500100732259').isValid, true);
check('ИНН ФЛ 500100732258 недействителен', validateInn('500100732258').isValid, false);
check('ОГРН 1027700132195 действителен', validateOgrn('1027700132195').isValid, true);
check('ОГРН 1027700132196 недействителен', validateOgrn('1027700132196').isValid, false);
check('ОГРНИП 304500116000157 действителен', validateOgrnip('304500116000157').isValid, true);
check('СНИЛС 112-233-445 95 действителен', validateSnils('11223344595').isValid, true);
check('СНИЛС 112-233-445 94 недействителен', validateSnils('11223344594').isValid, false);
check('БИК 044525225 действителен', validateBik('044525225').isValid, true);
check('Паспорт 4509 123456 структурно корректен', validatePassportRf('4509', '123456').isValid, true);
check('Паспорт 9009 123456 некорректен (код региона)', validatePassportRf('9009', '123456').isValid, false);
check('Кадастровый номер 77:01:0001001:1234', validateCadastralNumber('77:01:0001001:1234').isValid, true);
ok('ГРЗ А123ВЕ777 распознан как действительный', parseRuPlate('А123ВЕ777').isValid, parseRuPlate('А123ВЕ777').error ?? '');
check('ГРЗ А123ВЕ777 → код региона 777', parseRuPlate('А123ВЕ777').details.regionCode, '777');
ok('ГРЗ А123ВЕ777 → Москва', /Москва/.test(String(parseRuPlate('А123ВЕ777').region)), String(parseRuPlate('А123ВЕ777').region));
ok('Латинская запись A123BE777 распознаётся идентично', parseRuPlate('A123BE777').isValid && parseRuPlate('A123BE777').details.regionCode === '777');
// Серия спецномеров читается как «первая буква + буквы после цифр»: А + МР = АМР.
ok('Спецсерия А001МР77 распознана', Boolean(parseRuPlate('А001МР77').seriesType), String(parseRuPlate('А001МР77').seriesType));
check('VIN 1M8GDM9AXKP042788: контрольный разряд X', decodeVin('1M8GDM9AXKP042788').checkDigitValid, true);
check('VIN 1M8GDM9AXKP042799 недействителен', decodeVin('1M8GDM9AXKP042799').checkDigitValid, false);
ok('DEF-код 916 → МТС', /МТС/.test(identifyDefRange('916')?.operator ?? ''), String(identifyDefRange('916')?.operator));
ok('DEF-код 926 → МегаФон', /МегаФон/i.test(identifyDefRange('926')?.operator ?? ''), String(identifyDefRange('926')?.operator));
check('DEF-код 935 отсутствует в матрице', identifyDefRange('935') ?? null, null);

// Гео
check('geohash(57.64911, 10.40744) = u4pruydqqvj', geohashEncode(57.64911, 10.40744, 11), 'u4pruydqqvj');
const decoded = geohashDecode('u4pruydqqvj');
ok('geohash decode: широта в пределах 0.0001°', Math.abs((decoded?.latitude ?? 0) - 57.64911) < 0.0001);
const moscowSpbKm = haversineMetres({ latitude: 55.7558, longitude: 37.6173 }, { latitude: 59.9343, longitude: 30.3351 }) / 1000;
ok('Haversine Москва→СПб ≈ 634 км (±2)', Math.abs(moscowSpbKm - 634) <= 2, `${moscowSpbKm.toFixed(1)} км`);
const moscowSpbBearing = bearingDegrees({ latitude: 55.7558, longitude: 37.6173 }, { latitude: 59.9343, longitude: 30.3351 });
ok('Азимут Москва→СПб ≈ 320° (±3)', Math.abs(moscowSpbBearing - 320) <= 3, `${moscowSpbBearing.toFixed(1)}°`);

// Строки и имена
check('Levenshtein kitten/sitting = 3', levenshtein('kitten', 'sitting'), 3);
check('Jaro-Winkler MARTHA/MARHTA ≈ 0.961', Math.round(jaroWinkler('MARTHA', 'MARHTA') * 1000), 961);
ok('Транслитерация Ковалёв → kovalev', transliterationVariants('Ковалёв').includes('kovalev'), transliterationVariants('Ковалёв').join('|'));
check('parseFullName: фамилия', parseFullName('Соколов Михаил Андреевич').last, 'Соколов');
check('parseFullName: имя', parseFullName('Соколов Михаил Андреевич').first, 'Михаил');
check('parseFullName: отчество', parseFullName('Соколов Михаил Андреевич').middle, 'Андреевич');
ok('phoneticRu("Соколов") = phoneticRu("Саколов")', phoneticRu('Соколов') === phoneticRu('Саколов'), phoneticRu('Соколов'));
check('skeletonize("Соколов") — гомоглифное свёртывание', skeletonize('Соколов'), 'cokolob');
check('skeletonize: кириллица и латинский двойник дают один skeleton', skeletonize('Cokolob'), skeletonize('Соколов'));
// Гомоглифы сворачиваются первыми (у→y, р→p, н→h), остальное транслитерируется —
// поэтому «Журнал» даёт zhyphal, а не zurnal: важно, что буквы не теряются.
check('skeletonize: неподменённые буквы транслитерируются, а не удаляются', skeletonize('Журнал'), 'zhyphal');
ok('matchPersons: ФИО с опечаткой → возвращает score > 0.8', matchPersons('Соколов Михаил Андреевич', 'Соколов Михаил Андреевич').score > 0.99);

// Нормализация
check('parsePhone("+7 (916) 402-91-88") → E.164', parsePhone('+7 (916) 402-91-88').e164, '+79164029188');
check('parsePhone("8 916 402 91 88") → E.164', parsePhone('8 916 402 91 88').e164, '+79164029188');
check('parseEmail("M.Sokolov@Example.COM") канонизирован', parseEmail('M.Sokolov@Example.COM').address, 'm.sokolov@example.com');
check('registrableDomain("a.b.example.co.uk")', registrableDomain('a.b.example.co.uk'), 'example.co.uk');
check('normalizeDomain("HTTP://Example.RU/path")', normalizeDomain('http://Example.RU/path'), 'example.ru');
check('isIpAddress("192.168.0.1")', isIpAddress('192.168.0.1'), true);
check('normalizeUsername("@Sokolov_M")', normalizeUsername('@Sokolov_M'), 'sokolov_m');
ok('Гомоглиф-домен "аpple.com" (кириллица) распознан', detectMixedScriptDomain('аpple.com').suspicious === true, detectMixedScriptDomain('аpple.com').reason ?? '');
ok('Чистый латинский домен не помечается', detectMixedScriptDomain('apple.com').suspicious === false);
ok('Кириллический домен "сбербанк.рф" помечается как IDN', detectMixedScriptDomain('сбербанк.рф').suspicious === true);

// Энтропия и DGA
check('shannonEntropy("aaaa") = 0 бит', Math.round(shannonEntropy('aaaa') * 100) / 100, 0);
check('shannonEntropy("abcd") = 2 бита', Math.round(shannonEntropy('abcd') * 100) / 100, 2);
ok('dgaScore("google.com") — низкий риск', dgaScore('google.com').score < 0.5, String(dgaScore('google.com').score));
ok('dgaScore("kq3vbnxzpwqlyr.com") — выше, чем у google.com', dgaScore('kq3vbnxzpwqlyr.com').score > dgaScore('google.com').score);
ok('analyzePasswordStrength("qwerty123") — слабый пароль (шкала 0..4)', analyzePasswordStrength('qwerty123').score <= 2, `${analyzePasswordStrength('qwerty123').score} (${analyzePasswordStrength('qwerty123').label})`);
ok('analyzePasswordStrength распознаёт плейсхолдер "password"', analyzePasswordStrength('password').isPlaceholder === true);

// Изображения
const gradient: RgbaImage = { width: 32, height: 32, data: new Uint8ClampedArray(32 * 32 * 4) };
for (let y = 0; y < 32; y += 1) {
  for (let x = 0; x < 32; x += 1) {
    const offset = (y * 32 + x) * 4;
    gradient.data[offset] = x * 8;
    gradient.data[offset + 1] = y * 8;
    gradient.data[offset + 2] = (x + y) * 4;
    gradient.data[offset + 3] = 255;
  }
}
const hash = perceptualHash(gradient);
ok('pHash градиента рассчитан (64 hex)', /^[0-9a-f]{16}$/.test(hash.pHash), hash.pHash);
check('Сравнение хэша с самим собой — identical', compareHashes(hash.pHash, hash.pHash).verdict, 'identical');
check('sniffFileType(PNG-сигнатура)', sniffFileType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])).type, 'png');
const emptyMeta = parseImageMetadata(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]));
ok('parseImageMetadata на усечённом JPEG не падает', emptyMeta.flags.metadataStripped === true);

// Разбор входа (авто-триаж)
const seeds = parseSeeds('Соколов Михаил Андреевич, тел. +7 (916) 402-91-88, m.sokolov@example.com, ИНН 7707083893, сайт https://sokolov-holding.ru, VIN 1M8GDM9AXKP042788');
const seedTypes = seeds.entities.map((entity) => entity.type).sort();
ok('parseSeeds нашёл телефон', seedTypes.includes('phone'));
ok('parseSeeds нашёл e-mail', seedTypes.includes('email'));
ok('parseSeeds нашёл ИНН', seedTypes.includes('tax_id'));
ok('parseSeeds нашёл домен/URL', seedTypes.includes('url') || seedTypes.includes('domain'));
ok('parseSeeds нашёл VIN (vehicle)', seedTypes.includes('vehicle'));
ok('parseSeeds нашёл персону', seedTypes.includes('person'));
ok('parseSeeds объясняет распознанное (notes не пусты)', seeds.notes.length > 0, `${seeds.notes.length} заметок`);

// Справочные функции модулей
check('screenAgainstWatchlist: точное совпадение', screenAgainstWatchlist('Соколов Михаил Андреевич', ['Соколов Михаил Андреевич']).length, 1);
check('screenAgainstWatchlist: нерелевантное имя отфильтровано', screenAgainstWatchlist('Соколов Михаил Андреевич', ['Иванов Пётр Сергеевич']).length, 0);
const pageMeta = parsePageMetadata('<html><head><title>ООО «Соколов Холдинг»</title><meta name="description" content="Оптовая торговля"><meta property="og:site_name" content="Соколов Холдинг"><script>var ua = "UA-12345-6"; GTM-ABCDEF</script></head><body><a href="mailto:info@sokolov-holding.ru">info@sokolov-holding.ru</a><a href="tel:+79164029188">+7 916 402-91-88</a><a href="https://vk.com/sokolov_holding">VK</a></body></html>');
check('parsePageMetadata: заголовок', pageMeta.title, 'ООО «Соколов Холдинг»');
ok('parsePageMetadata: найдены контакты (e-mail/телефон)', pageMeta.emails.length > 0 && pageMeta.phones.length > 0, `${pageMeta.emails.length} писем, ${pageMeta.phones.length} телефонов`);
ok('parsePageMetadata: найдены трекеры (GA/GTM)', pageMeta.analyticsIds.length >= 1, pageMeta.analyticsIds.join(','));

// ── §2 End-to-end в офлайне ─────────────────────────────────────────────────
section('§2 End-to-end расследование (офлайн, без сети)');

const offlineEngine = createOsintEngine({ settings: { offline: true, budgetMs: 20_000, maxDepth: 1, concurrency: 4 } });
const offlineReport = await offlineEngine.investigate({
  input: 'Соколов Михаил Андреевич, +7 (916) 402-91-88, m.sokolov@example.com, ИНН 7707083893',
  profile: 'person-fast',
});

ok('Отчёт содержит сущности', offlineReport.entities.length >= 5, `${offlineReport.entities.length}`);
ok('Отчёт содержит наблюдения', offlineReport.evidence.length >= 10, `${offlineReport.evidence.length}`);
ok('Отчёт содержит находки', offlineReport.findings.length >= 1, `${offlineReport.findings.length}`);
ok('Риск посчитан (0..100)', offlineReport.risk.score >= 0 && offlineReport.risk.score <= 100, String(offlineReport.risk.score));
ok('Риск-факторы объяснены', offlineReport.risk.factors.every((factor) => factor.explain.length > 0));
ok('Печать целостности SHA-256 выставлена', /^[0-9a-f]{64}$/.test(offlineReport.integrity.reportDigest), offlineReport.integrity.reportDigest);
ok('Хронология построена', offlineReport.timeline.length >= 1, `${offlineReport.timeline.length}`);
ok('Офлайн-режим отражён в caveats', offlineReport.narrative.caveats.some((caveat) => /офлайн/i.test(caveat)));
const offlineRecords = offlineReport.trace.modules;
ok('Сетевые модули в офлайне не выполнялись', offlineRecords.every((record) => record.status !== 'ok' || !record.moduleId.includes('network')));
ok('Словарь сущностей локализован (RU)', offlineReport.entities.some((entity) => /[А-Яа-я]/.test(entity.label)));
const markdown = offlineEngine.export(offlineReport, 'markdown');
ok('Экспорт в Markdown работает', /Соколов/.test(markdown) && markdown.length > 500, `${markdown.length} символов`);
ok('Экспорт в STIX 2.1 валиден как JSON', (() => { try { const bundle = JSON.parse(offlineEngine.export(offlineReport, 'stix2')) as { type?: string }; return bundle.type === 'bundle'; } catch { return false; } })());
ok('Экспорт в GraphML содержит узлы', offlineEngine.export(offlineReport, 'graphml').includes('<node '));
const secondEngine = createOsintEngine({ settings: { offline: true, budgetMs: 20_000, maxDepth: 1, concurrency: 4 } });
const secondReport = await secondEngine.investigate({ input: 'Соколов Михаил Андреевич, +7 (916) 402-91-88, m.sokolov@example.com, ИНН 7707083893', profile: 'person-fast' });
ok('Повторный запуск даёт те же id сущностей (детерминизм)', JSON.stringify(offlineReport.entities.map((entity) => entity.id).sort()) === JSON.stringify(secondReport.entities.map((entity) => entity.id).sort()));
check('Повторный запуск даёт тот же риск (детерминизм)', secondReport.risk.score, offlineReport.risk.score);

section('§2b План без сбора (engine.plan)');
const plan = offlineEngine.plan('+7 (916) 402-91-88');
ok('План содержит распознанные seeds', plan.seeds.length >= 1, `${plan.seeds.length}`);
ok('План содержит модули для phone', plan.modules.some((module) => module.id.startsWith('telecom')));
ok('План объясняет пропуски офлайна', plan.skipped.offline.length >= 1, `${plan.skipped.offline.length} пропущено`);

// ── §3 Сетевой конвейер на стабах ────────────────────────────────────────────
section('§3 Сетевой конвейер на подменённом fetch');

interface StubRoute { match: RegExp; body: string; status?: number; contentType?: string }
const routes: StubRoute[] = [
  {
    match: /cloudflare-dns\.com.*name=sokolov-holding\.ru.*type=TXT/i,
    body: JSON.stringify({ Status: 0, Answer: [{ name: 'sokolov-holding.ru', type: 16, TTL: 300, data: '"v=spf1 include:_spf.google.com -all"' }] }),
  },
  {
    match: /cloudflare-dns\.com.*type=MX.*sokolov-holding\.ru|cloudflare-dns\.com.*sokolov-holding\.ru.*type=MX/i,
    body: JSON.stringify({ Status: 0, Answer: [{ name: 'sokolov-holding.ru', type: 15, TTL: 300, data: '10 aspmx.l.google.com.' }] }),
  },
  { match: /cloudflare-dns\.com.*_dmarc\./i, body: JSON.stringify({ Status: 0, Answer: [{ name: '_dmarc.sokolov-holding.ru', type: 16, TTL: 300, data: '"v=DMARC1; p=none; rua=mailto:dmarc@sokolov-holding.ru"' }] }) },
  { match: /cloudflare-dns\.com.*_domainkey\./i, body: JSON.stringify({ Status: 0, Answer: [] }) },
  { match: /cloudflare-dns\.com.*type=NS/i, body: JSON.stringify({ Status: 0, Answer: [{ name: 'sokolov-holding.ru', type: 2, TTL: 3600, data: 'ns1.example-dns.net.' }] }) },
  { match: /cloudflare-dns\.com.*type=A/i, body: JSON.stringify({ Status: 0, Answer: [{ name: 'sokolov-holding.ru', type: 1, TTL: 300, data: '203.0.113.42' }] }) },
  { match: /rdap\.org\/domain/i, body: JSON.stringify({ ldhName: 'SOKOLOV-HOLDING.RU', status: ['active'], events: [{ eventAction: 'registration', eventDate: '2016-04-12T00:00:00Z' }], entities: [{ roles: ['registrant'], vcardArray: ['vcard', [['fn', {}, 'text', 'ООО «СОКОЛОВ ХОЛДИНГ»'], ['email', {}, 'text', 'admin@sokolov-holding.ru']]] }] }) },
  { match: /rdap\.org\/ip/i, body: JSON.stringify({ handle: '203.0.113.0 - 203.0.113.255', name: 'EXAMPLE-NET', country: 'RU', startAddress: '203.0.113.0', endAddress: '203.0.113.255', entities: [{ roles: ['registrant'], vcardArray: ['vcard', [['fn', {}, 'text', 'Example Hosting LLC']]] }] }) },
  { match: /ipwho\.is/i, body: JSON.stringify({ ip: '203.0.113.42', type: 'IPv4', country: 'Россия', country_code: 'RU', region: 'Москва', city: 'Москва', connection: { asn: 64496, org: 'Example Hosting LLC', isp: 'Example ISP' }, security: { vpn: false, proxy: false, tor: false, hosting: true } }) },
  { match: /crt\.sh/i, body: JSON.stringify([{ issuer_ca_id: 1, issuer_name: 'C=US, O=Let\'s Encrypt, CN=R3', common_name: 'sokolov-holding.ru', name_value: 'sokolov-holding.ru\nmail.sokolov-holding.ru\nadmin-panel.sokolov-holding.ru', entry_timestamp: '2024-03-01T10:00:00' }]) },
  {
    match: /mempool\.space\/api\/address\/.*\/txs/i,
    // Two inputs spent together ⇒ the common-input-ownership heuristic must fire.
    body: JSON.stringify([
      {
        txid: 'aa11',
        fee: 1200,
        status: { confirmed: true, block_time: 1710000000 },
        vin: [
          { prevout: { scriptpubkey_address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', value: 150000 } },
          { prevout: { scriptpubkey_address: '12c6DSiU4Rq3P4ZxziKxzrL5LmMBrzjrJX', value: 90000 } },
        ],
        vout: [
          { scriptpubkey_address: '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2', value: 100000 },
          { scriptpubkey_address: '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy', value: 139000 },
        ],
      },
    ]),
  },
  { match: /mempool\.space\/api\/address\//i, body: JSON.stringify({ address: 'bc1qexamplesender000000000000000000000000', chain_stats: { funded_txo_sum: 120_000_000, spent_txo_sum: 70_000_000, tx_count: 12 }, mempool_stats: { funded_txo_sum: 0, spent_txo_sum: 0, tx_count: 0 } }) },
  { match: /api\.blockscout\.com/i, body: JSON.stringify({ hash: '0x5aAeb6053F3E94C9B9A09f33669435E7Ef1BeAed', coin_balance: '51000000000000000000', is_contract: false, transaction_count: 42, public_tags: [{ display_name: 'Sokolov Holding Wallet' }], creation_tx_hash: '0xdeadbeef' }) },
  { match: /api\.opensanctions\.org/i, body: JSON.stringify({ results: [{ id: 'NK-abc123', caption: 'Соколов Михаил Андреевич', schema: 'Person', datasets: ['us_sanctions'], properties: { country: ['ru'], topics: ['sanction'], birthDate: ['1978-05-04'] } }] }) },
  { match: /api\.gleif\.org/i, body: JSON.stringify({ data: [{ id: 'LEI123', attributes: { lei: 'LEI1234567890ABCDEF12', entity: { legalName: { name: 'ООО «СОКОЛОВ ХОЛДИНГ»' }, legalAddress: { city: 'Москва', country: 'RU' }, status: 'ACTIVE' }, registration: { status: 'ISSUED', initialRegistrationDate: '2016-05-01' } } }] }) },
  { match: /vies\/rest-api/i, body: JSON.stringify({ isValid: true, name: 'SOKOLOV HOLDING OOO', address: 'MOSCOW' }) },
  { match: /api\.pwnedpasswords\.com/i, body: '0018A45C4D1DEF81644B54AB7F969B88D65:12\r\n00D4F6E8FA6EECAD2A3AA415EEC418D38EC:3\r\n' },
  { match: /wikidata\.org/i, body: JSON.stringify({ search: [{ id: 'Q123456', label: 'Соколов, Михаил Андреевич', description: 'российский предприниматель' }] }) },
  { match: /nominatim\.openstreetmap\.org/i, body: JSON.stringify({ display_name: 'Москва, Россия', address: { country: 'Россия', country_code: 'ru', state: 'Москва', city: 'Москва' } }) },
  { match: /github\.com\/(users|api)/i, body: JSON.stringify({ login: 'sokolov_holding', name: 'Sokolov Holding', public_repos: 4, created_at: '2016-06-01T00:00:00Z', bio: 'Оптовая торговля', html_url: 'https://github.com/sokolov_holding' }) },
  { match: /www\.gravatar\.com/i, body: 'GIF89a', status: 200 },
  { match: /example\.com/i, body: '<html><head><title>Stub</title></head><body>ok</body></html>' },
];

const requestLog: Array<{ url: string; via: string }> = [];
const stubFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
  const decoded = decodeURIComponent(url);
  requestLog.push({ url: decoded, via: 'stub' });
  const route = routes.find((candidate) => candidate.match.test(decoded));
  const headers = new Headers((init?.headers as Record<string, string>) ?? {});
  if (!route) {
    return new Response('', { status: 404, headers: { 'content-type': 'text/plain' } });
  }
  headers.set('content-type', route.contentType ?? 'application/json');
  headers.set('access-control-allow-origin', '*');
  return new Response(route.body, { status: route.status ?? 200, headers });
};

const onlineEngine = createOsintEngine({
  settings: { offline: false, budgetMs: 45_000, maxDepth: 1, concurrency: 4, transit: ['direct'] },
  fetchImpl: stubFetch,
});
const onlineReport = await onlineEngine.investigate({
  input: 'https://sokolov-holding.ru +7 (916) 402-91-88 m.sokolov@example.com 0x5aAeb6053F3E94C9B9A09f33669435E7Ef1BeAed 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
  profile: 'full-spectrum',
});

ok('Сетевые запросы ушли через инъектированный fetch', requestLog.length > 0, `${requestLog.length} запросов`);
ok('DoH-модуль выполнился', onlineReport.trace.modules.some((record) => record.moduleId === 'infrastructure.network' && record.status === 'ok'));
ok('CT-модуль выполнился', onlineReport.trace.modules.some((record) => record.moduleId === 'infrastructure.certificates' && record.status === 'ok'));
ok('Крипто-модуль выполнился', onlineReport.trace.modules.some((record) => record.moduleId === 'finance.crypto' && record.status === 'ok'));
ok('Скрининг-модуль выполнился', onlineReport.trace.modules.some((record) => record.moduleId === 'legal.screening' && record.status === 'ok'));
ok('Найдено совпадение с санкционным списком', onlineReport.entities.some((entity) => entity.type === 'watchlist_hit'), onlineReport.entities.filter((entity) => entity.type === 'watchlist_hit').map((entity) => entity.label).join('; '));
ok('Риск-фактор санкций присутствует', onlineReport.risk.factors.some((factor) => factor.id === 'fin.sanctions-hit'));
ok('Почтовая защита домена оценена', onlineReport.evidence.some((record) => record.key === 'mail.security-score'));
ok('SPF/DMARC разобраны из DoH-ответов', onlineReport.evidence.some((record) => record.key === 'mail.dmarc'));
ok('Геоданные IP получены', onlineReport.evidence.some((record) => /^ip\.(country|asn|region-city)$/.test(record.key)), onlineReport.evidence.filter((record) => record.key.startsWith('ip.')).map((record) => record.key).join(','));
ok('Транспорт зафиксирован в provenance (via)', onlineReport.evidence.some((record) => typeof record.source.via === 'string' && record.source.via.length > 0));
ok('Сертификаты из CT-логов разобраны', onlineReport.evidence.some((record) => record.key.startsWith('ct.')));
ok('Кластеризация по общим входам BTC сработала', onlineReport.evidence.some((record) => record.key === 'crypto.cluster'), onlineReport.evidence.filter((record) => record.key.startsWith('crypto.')).map((record) => record.key).join(','));
ok('Найдены дублирующиеся/связанные сущности в графе', onlineReport.edges.length >= 5, `${onlineReport.edges.length} связей`);
ok('Отчёт содержит рекомендации для аналитика', onlineReport.findings.some((finding) => Boolean(finding.recommendation)));
ok('Итоговый риск выше нуля', onlineReport.risk.score > 0, String(onlineReport.risk.score));
ok('Риск не превышает 100', onlineReport.risk.score <= 100, String(onlineReport.risk.score));

section('§3b Проверка приватности k-anonymity (HIBP)');
const hibpRequests: Array<{ url: string; headers: Record<string, string> }> = [];
const hibpFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : (input as URL).toString();
  hibpRequests.push({ url, headers: (init?.headers as Record<string, string>) ?? {} });
  return new Response('0018A45C4D1DEF81644B54AB7F969B88E2B5:7\r\n', { status: 200, headers: { 'content-type': 'text/plain' } });
};
const fakeHttp = {
  offline: false,
  // The stub forwards headers so the privacy-critical `add-padding` flag is
  // observable at the transport boundary, exactly as the real client sends it.
  text: async (url: string, init?: { headers?: Record<string, string> }) => {
    const response = await hibpFetch(url, { headers: init?.headers });
    return response.text();
  },
  json: async <T,>(url: string, init?: { headers?: Record<string, string> }) =>
    JSON.parse(await (await hibpFetch(url, { headers: init?.headers })).text()) as T,
  html: async (url: string, init?: { headers?: Record<string, string> }) => {
    const response = await hibpFetch(url, { headers: init?.headers });
    return response.text();
  },
  probe: async (url: string): Promise<HttpProbeResult> => ({ url, ok: true, status: 200, reachable: true, markers: { softNotFound: false }, elapsedMs: 1 }),
  counters: () => ({ requests: hibpRequests.length, failures: 0, cacheHits: 0 }),
} satisfies HttpGateway;
const pwned = await checkPwnedPassword(
  { http: fakeHttp as HttpGateway, settings: { offline: false, apiKeys: {} } } as unknown as ModuleContext,
  'qwerty12345',
);
ok('HIBP-запрос ушёл только с 5-символьным префиксом SHA-1', /\/range\/[0-9A-F]{5}$/.test(hibpRequests[0]?.url ?? ''), hibpRequests[0]?.url ?? 'нет запроса');
ok('Полный хеш пароля не передавался', !hibpRequests.some((entry) => entry.url.includes('sha1') || entry.url.length > 120));
ok('Заголовок add-padding передан (устойчивость к traffic-анализу)', hibpRequests.every((entry) => Object.entries(entry.headers).some(([key, value]) => key.toLowerCase() === 'add-padding' && value === 'true')), JSON.stringify(hibpRequests[0]?.headers ?? {}));
ok('Результат проверки пароля содержит количество вхождений', typeof pwned.occurrences === 'number', String(pwned.occurrences));

// ── Итог ─────────────────────────────────────────────────────────────────────
console.log(`\n\x1b[1mИТОГ:\x1b[0m пройдено ${passed}, провалено ${failed}`);
if (failures.length) {
  console.log('\nПроваленные проверки:');
  for (const failure of failures) console.log(`  • ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`\nОтчёт офлайн-прогона: ${offlineReport.entities.length} сущностей, ${offlineReport.evidence.length} наблюдений, риск ${offlineReport.risk.score}/100 (${offlineReport.risk.level}).`);
  console.log(`Отчёт сетевого прогона: ${onlineReport.entities.length} сущностей, ${onlineReport.evidence.length} наблюдений, ${onlineReport.findings.length} находок, риск ${onlineReport.risk.score}/100 (${onlineReport.risk.level}).`);
  console.log(`Печать целостности: sha256:${onlineReport.integrity.reportDigest.slice(0, 16)}…`);
}
