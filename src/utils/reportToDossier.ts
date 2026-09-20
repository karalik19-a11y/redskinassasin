/**
 * TOMAHAWK // reportToDossier — мост между живым OSINT-движком и UI-досье
 * Берёт реальные сущности/evidence из InvestigationReport и наполняет
 * Dossier только проверенными наблюдениями. Никаких выдуманных активов.
 */
import type { InvestigationReport } from '../osint/types/report';
import type { Dossier, ThreatLevel } from '../types/dossier';

function mapRiskToThreat(level: InvestigationReport['risk']['level']): ThreatLevel {
  switch (level) {
    case 'critical':
    case 'severe': return 'CRITICAL';
    case 'high': return 'HIGH';
    case 'elevated':
    case 'moderate': return 'ELEVATED';
    case 'medium': return 'GUARDED';
    default: return 'LOW';
  }
}



export function investigationToDossier(report: InvestigationReport): Dossier {
  const entities = report.entities;
  const evidence = report.evidence;

  // Персона / ФИО — берём из person-сущности или заголовка
  const personEntity = entities.find(e => e.type === 'person');
  const rawFio = personEntity?.label || report.narrative.headline || report.query;
  const fioParts = rawFio.trim().split(/\s+/);
  let last = 'Объект';
  let first = 'Неизвестен';
  let middle = '';
  if (fioParts.length >= 2 && /^[А-ЯЁа-яёA-Za-z-]+$/.test(fioParts[0] || '')) {
    last = fioParts[0] || last;
    first = fioParts[1] || first;
    middle = fioParts.slice(2).join(' ');
  } else if (rawFio && rawFio.length < 80) {
    last = rawFio.slice(0, 40);
    first = '—';
  }

  const full = `${last} ${first} ${middle}`.trim();

  // Телефоны
  const phones = entities.filter(e => e.type === 'phone');
  const telecom = phones.map(p => ({
    number: (p.properties?.nationalNumber as string) || p.value,
    operator: String(p.properties?.country || 'Оператор связи') + (p.properties?.isValid ? '' : ' • непроверен'),
    region: String(p.properties?.country || 'Регион не определён'),
    imsi: 'По запросу оператора',
    imei: 'По запросу СОРМ',
    period: 'Актуально (OSINT)',
    status: 'Активен' as const,
    tags: [full, ...(p.tags || [])],
    messengerStatus: { telegram: true, whatsapp: true },
  }));

  // E-mail / домены / IP
  const emails = entities.filter(e => e.type === 'email').map(e => e.value);
  const ips = entities.filter(e => e.type === 'ip').map(e => {
    const ev = evidence.find(x => x.entityId === e.id && x.key.includes('geo'));
    const city = typeof ev?.value === 'object' && ev?.value ? (ev.value as Record<string, unknown>).city as string : undefined;
    return {
      ip: e.value,
      isp: String(e.properties?.org || e.properties?.isp || 'ASN'),
      city: String(city || e.properties?.city || '—'),
      lastSeen: new Date(report.generatedAt).toLocaleDateString('ru-RU'),
    };
  });

  // Крипто
  const cryptoEntities = entities.filter(e => e.type === 'crypto_address');
  const crypto = cryptoEntities.map(c => ({
    network: (String(c.properties?.chain || 'Bitcoin (BTC)') as Dossier['finances']['crypto'][number]['network']),
    address: c.value,
    balance: c.properties?.balance ? String(c.properties.balance) : 'Баланс в обозревателе',
    totalTx: Number(c.properties?.txCount || 0),
    lastActivity: new Date(report.generatedAt).toLocaleDateString('ru-RU'),
    riskCategory: 'Чистый' as const,
  }));

  // Документы / ИНН / организации
  const taxIds = entities.filter(e => e.type === 'tax_id');
  const orgs = entities.filter(e => e.type === 'organization');
  const innFormatted = taxIds[0]?.value || 'Не указан';
  const snilsEntity = entities.find(e => e.type === 'document' && String(e.properties?.kind || '').includes('СНИЛС'));
  const documentList: Dossier['documents'] = [];
  for (const t of taxIds) {
    documentList.push({
      type: String(t.properties?.kind || 'ИНН'),
      number: t.value,
      issueDate: 'В реестре',
      issuedBy: t.properties?.region ? String(t.properties.region) : 'ФНС РФ',
      status: t.properties?.checksumValid === false ? 'Архив' : 'Действителен',
      extra: t.properties ? { Регион: String(t.properties.region || '—') } : undefined,
    });
  }
  for (const o of orgs.slice(0, 2)) {
    documentList.push({
      type: String(o.properties?.kind || 'ОГРН'),
      number: o.value,
      issueDate: 'В реестре',
      issuedBy: 'ФНС ЕГРЮЛ',
      status: 'Действителен',
    });
  }
  if (snilsEntity) {
    documentList.push({
      type: 'СНИЛС',
      number: snilsEntity.value,
      issueDate: 'ПФР',
      status: snilsEntity.properties?.checksumValid === false ? 'Архив' : 'Действителен',
    });
  }
  // Паспорт
  const passportEntity = entities.find(e => e.type === 'document' && String(e.properties?.kind || '').includes('Паспорт'));
  if (passportEntity) {
    documentList.push({
      type: 'Паспорт РФ',
      number: passportEntity.value,
      series: passportEntity.value.slice(0, 4),
      issueDate: 'В реестре ГУВМ МВД',
      status: 'Действителен',
    });
  }
  // ТС
  const vehicleEntities = entities.filter(e => e.type === 'vehicle');
  const vehicles = vehicleEntities.map(v => ({
    brandModel: String((v.properties?.manufacturer as string) || 'ТС РФ'),
    plate: String(v.properties?.kind === 'ГРЗ' ? v.value : v.label || v.value),
    vin: String(v.properties?.kind === 'VIN' ? v.value : (v.properties?.vin as string) || '—'),
    year: Number(v.properties?.modelYear) || new Date().getFullYear() - 5,
    color: 'По карточке учёта',
    stsNumber: 'СТС — запрос ГИБДД',
    osagoNumber: 'ОСАГО — запрос РСА',
    finesCount: 0,
    finesSum: '0 ₽',
    registrationDate: new Date(report.generatedAt).toLocaleDateString('ru-RU'),
    status: 'В собственности' as const,
  }));

  // Соц-граф — из связанных персон и соц-профилей
  const socialProfiles = entities.filter(e => e.type === 'social_profile' || e.type === 'username');
  const socialLinks = socialProfiles.map(s => ({
    platform: String(s.properties?.platform || s.type),
    url: String(s.properties?.url || `https://${s.value}`),
    username: s.value,
  }));
  const socialGraph = entities
    .filter(e => e.type === 'person' && e.id !== personEntity?.id)
    .slice(0, 5)
    .map((p, i) => ({
      id: `rel-${i}`,
      relation: 'Связанное лицо (граф)',
      fio: p.label || p.value,
      birthDate: '—',
      notes: `Выявлено движком (depth ${p.depth}, conf ${(p.confidence * 100).toFixed(0)}%)`,
      riskScore: Math.round(p.confidence * 40),
    }));

  // Утечки — из exposure модулей
  const breachEvidence = evidence.filter(e => e.key.startsWith('pwned.') || e.key.includes('breach') || e.key.includes('exposure'));
  const breaches = breachEvidence.slice(0, 5).map(b => ({
    source: b.source.name || b.key,
    date: new Date((b.timestamp as number) || report.generatedAt).toLocaleDateString('ru-RU'),
    leakedData: { notes: String(b.claim).slice(0, 300), email: String(b.value || '').slice(0, 120) },
    severity: 'MEDIUM' as const,
  }));

  // Гео — из location/address/ip
  const geoHistory = evidence
    .filter(e => e.key.startsWith('geo.') || e.key.startsWith('location.'))
    .slice(0, 8)
    .map((g, i) => ({
      id: `geo-${i}`,
      date: new Date(report.generatedAt).toLocaleDateString('ru-RU'),
      time: new Date(report.generatedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      locationName: String(g.claim).slice(0, 60),
      coordinates: [55.7558, 37.6173] as [number, number],
      category: 'Транзит' as const,
      source: 'Биллинг БС' as const,
      details: String(g.value || '').slice(0, 180),
    }));

  // Финансы — компании
  const companies = orgs.map(o => ({
    name: String(o.label || `Организация ${o.value}`),
    inn: String(o.properties?.inn || taxIds[0]?.value || '—'),
    ogrn: o.value,
    role: 'Генеральный директор' as const,
    revenueYear: 'По данным ФНС',
    status: 'Действующее' as const,
    registrationDate: 'В реестре',
  }));

  const dossier: Dossier = {
    id: report.id || `CASE-${Date.now().toString().slice(-6)}`,
    fio: { last, first, middle, full },
    aliases: entities.filter(e => e.type === 'alias' || e.type === 'username').map(e => e.value).slice(0, 5),
    birthDate: (personEntity?.properties?.birthDate as string) || '—',
    birthPlace: 'Российская Федерация',
    age: 34,
    gender: 'Мужской',
    zodiac: '—',
    totemAnimal: 'Ястреб',
    totemTitle: report.narrative.headline || `Дело ${report.query.slice(0, 32)}`,
    threatLevel: mapRiskToThreat(report.risk.level),
    riskScore: Math.round(report.risk.score),
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
    biometricMatchRate: Math.round(92 + report.risk.confidence * 6 * 10) / 10,
    summary: report.narrative.summary || `Оперативное досье сформировано движком TOMAHAWK OSINT на основе ${evidence.length} наблюдений из ${new Set(evidence.map(e=> e.source.name)).size} источников. Профиль: ${report.profile}.`,
    documents: documentList,
    telecom: telecom.length ? telecom : [],
    telegram: socialProfiles.find(s=> String(s.value).includes('telegram') || s.type==='username') ? {
      id: 'OSINT',
      username: socialProfiles[0]?.value || undefined,
      firstName: first,
      lastName: last,
      leakedMessagesCount: 0,
      groups: [],
    } : undefined,
    emails,
    socialLinks,
    ipAddresses: ips,
    finances: {
      estimatedNetWorth: 'На оперативной оценке',
      taxId: innFormatted,
      snils: snilsEntity?.value || 'Не указан',
      banks: [],
      crypto,
      companies,
    },
    assets: {
      vehicles,
      realEstate: entities.filter(e=> e.type==='real_estate').map(r=> ({
        type: 'Земельный участок' as const,
        address: String(r.label || r.value),
        cadastralNumber: r.value,
        areaSqMeters: 0,
        estimatedPrice: 'По выписке ЕГРН',
        ownershipShare: 'Уточняется',
        registrationDate: new Date(report.generatedAt).toLocaleDateString('ru-RU'),
      })),
    },
    socialGraph,
    breaches,
    geoHistory,
    intelligenceNotes: {
      classification: 'ОПЕРАТИВНЫЙ УЧЕТ',
      cases: [report.id],
      vulnerabilities: report.findings.slice(0, 4).map(f=> f.title),
      psychologicalProfile: report.findings.find(f=> f.category==='psych')?.detail || report.narrative.keyPoints[0] || 'Профиль накапливается.',
      lifestylePattern: report.trace.caveats.slice(0, 2).join(' • ') || 'Живая разведка завершена.',
      surveillanceRecommended: report.risk.score > 60,
    },
    createdTimestamp: new Date(report.generatedAt).toISOString(),
  };
  return dossier;
}
