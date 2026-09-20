/**
 * TOMAHAWK OSINT ENGINE — interoperability exports
 * ---------------------------------------------------------------------------
 * A finding that cannot leave the tool is not intelligence. Supported formats:
 *   • JSON          — full fidelity (re-importable)
 *   • JSONL         — one record per line for SIEM/ELK ingestion
 *   • CSV           — entities / edges / evidence / findings for Excel
 *   • GraphML       — Gephi, yEd, Cytoscape (analyst-grade graph work)
 *   • STIX 2.1      — OpenCTI, MISP, Anomali, ThreatConnect (SCO/SDO + report)
 *   • Markdown      — a human-readable investigation summary
 * All deterministic: identical reports serialise byte-for-byte identically.
 */

import type { InvestigationReport } from '../types/report';
import type { Entity, EntityType } from '../types/entity';
import { md5 } from '../algo/hashes';
import { stableStringify } from './ids';

/** Deterministic, RFC-4122-shaped id (content-addressed, dedup-friendly). */
export function deterministicUuid(seed: string): string {
  const hex = md5(seed);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function xmlEscape(value: string): string {
  return value.replace(/[<>&'"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char] as string);
}

function csvCell(value: unknown): string {
  const text = typeof value === 'string' ? value : typeof value === 'object' && value !== null ? stableStringify(value) : String(value ?? '');
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csv(rows: Array<Array<unknown>>, delimiter = ','): string {
  return rows.map((row) => row.map(csvCell).join(delimiter)).join('\n');
}

export type ExportFormat = 'json' | 'jsonl' | 'csv' | 'graphml' | 'stix2' | 'markdown';

export function toJson(report: InvestigationReport, pretty = true): string {
  return pretty ? JSON.stringify(report, null, 2) : JSON.stringify(report);
}

export function toJsonl(report: InvestigationReport): string {
  const lines: string[] = [];
  for (const entity of report.entities) lines.push(JSON.stringify({ record: 'entity', ...entity }));
  for (const edge of report.edges) lines.push(JSON.stringify({ record: 'edge', ...edge }));
  for (const evidence of report.evidence) lines.push(JSON.stringify({ record: 'evidence', ...evidence }));
  for (const finding of report.findings) lines.push(JSON.stringify({ record: 'finding', ...finding }));
  return lines.join('\n');
}

export function toCsv(report: InvestigationReport, section: 'entities' | 'edges' | 'evidence' | 'findings' | 'timeline' = 'entities', delimiter = ','): string {
  switch (section) {
    case 'entities':
      return csv(
        [
          ['id', 'type', 'value', 'label', 'confidence', 'depth', 'tags', 'sources', 'properties'],
          ...report.entities.map((entity) => [
            entity.id, entity.type, entity.value, entity.label, entity.confidence, entity.depth,
            entity.tags.join('|'), entity.sources.join('|'), stableStringify(entity.properties),
          ]),
        ],
        delimiter,
      );
    case 'edges':
      return csv(
        [['id', 'from', 'to', 'relation', 'weight', 'confidence', 'evidence'], ...report.edges.map((edge) => [edge.id, edge.from, edge.to, edge.relation, edge.weight, edge.confidence, edge.evidenceIds.join('|')])],
        delimiter,
      );
    case 'evidence':
      return csv(
        [
          ['id', 'module', 'entity', 'key', 'claim', 'value', 'source', 'source_kind', 'prior', 'posterior', 'corroboration', 'disputed', 'via', 'url'],
          ...report.evidence.map((record) => [
            record.id, record.moduleId, record.entityId ?? '', record.key, record.claim, stableStringify(record.value),
            record.source.name, record.source.kind, record.prior, record.confidence, record.corroboration, record.disputed,
            record.source.via ?? '', record.source.url ?? '',
          ]),
        ],
        delimiter,
      );
    case 'findings':
      return csv(
        [
          ['id', 'severity', 'score', 'confidence', 'title', 'detail', 'recommendation', 'module', 'entities'],
          ...report.findings.map((finding) => [finding.id, finding.severity, finding.score, finding.confidence, finding.title, finding.detail, finding.recommendation ?? '', finding.moduleId, finding.entityIds.join('|')]),
        ],
        delimiter,
      );
    case 'timeline':
      return csv(
        [['timestamp', 'iso', 'label', 'category', 'precision', 'entity'], ...report.timeline.map((event) => [event.timestamp, new Date(event.timestamp).toISOString(), event.label, event.category, event.precision, event.entityId ?? ''])],
        delimiter,
      );
  }
}

/** GraphML for Gephi/yEd/Cytoscape with typed attributes. */
export function toGraphML(report: InvestigationReport): string {
  const typeKeys = [...new Set(report.entities.map((entity) => entity.type))];
  const relationKeys = [...new Set(report.edges.map((edge) => String(edge.relation)))];
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<graphml xmlns="http://graphml.graphdrawing.org/xmlns" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">',
    '  <key id="label" for="node" attr.name="label" attr.type="string"/>',
    '  <key id="type" for="node" attr.name="type" attr.type="string"/>',
    '  <key id="confidence" for="node" attr.name="confidence" attr.type="double"/>',
    '  <key id="degree_score" for="node" attr.name="centrality" attr.type="double"/>',
    '  <key id="relation" for="edge" attr.name="relation" attr.type="string"/>',
    '  <key id="weight" for="edge" attr.name="weight" attr.type="double"/>',
    '  <key id="evidence" for="edge" attr.name="evidence_count" attr.type="int"/>',
    '  <graph id="tomahawk" edgedefault="undirected">',
  ];
  for (const entity of report.entities) {
    lines.push(`    <node id="${xmlEscape(entity.id)}">`);
    lines.push(`      <data key="label">${xmlEscape(entity.label)}</data>`);
    lines.push(`      <data key="type">${xmlEscape(entity.type)}</data>`);
    lines.push(`      <data key="confidence">${entity.confidence}</data>`);
    lines.push(`      <data key="degree_score">${report.graph.centrality[entity.id]?.score ?? 0}</data>`);
    lines.push('    </node>');
  }
  for (const edge of report.edges) {
    lines.push(`    <edge id="${xmlEscape(edge.id)}" source="${xmlEscape(edge.from)}" target="${xmlEscape(edge.to)}">`);
    lines.push(`      <data key="relation">${xmlEscape(String(edge.relation))}</data>`);
    lines.push(`      <data key="weight">${edge.weight}</data>`);
    lines.push(`      <data key="evidence">${edge.evidenceIds.length}</data>`);
    lines.push('    </edge>');
  }
  lines.push(`    <!-- типы: ${typeKeys.join(', ')}; связи: ${relationKeys.slice(0, 32).join(', ')} -->`);
  lines.push('  </graph>');
  lines.push('</graphml>');
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// STIX 2.1
// ─────────────────────────────────────────────────────────────────────────────

interface StixObject {
  type: string;
  id: string;
  spec_version?: string;
  [key: string]: unknown;
}

const STIX_SCO_BY_TYPE: Partial<Record<EntityType, string>> = {
  email: 'email-addr',
  phone: 'phone-number',
  domain: 'domain-name',
  subdomain: 'domain-name',
  ip: 'ipv4-addr',
  url: 'url',
  username: 'user-account',
  social_profile: 'user-account',
  crypto_address: 'x-crypto-wallet',
  location: 'location',
  image: 'artifact',
  vehicle: 'x-vehicle',
  document: 'x-identity-document',
  tax_id: 'x-ru-identifier',
  bank_account: 'x-bank-account',
  certificate: 'x509-certificate',
};

function stixObjectFor(entity: Entity): StixObject {
  const id = `${STIX_SCO_BY_TYPE[entity.type] ?? 'x-observable'}--${deterministicUuid(`stix:${entity.id}`)}`;
  if (entity.type === 'person' || entity.type === 'organization') {
    return {
      type: 'identity',
      id: `identity--${deterministicUuid(`stix:${entity.id}`)}`,
      spec_version: '2.1',
      name: entity.label,
      identity_class: entity.type === 'person' ? 'individual' : 'organization',
      description: `${entity.label} — сущность, собранная движком TOMAHAWK OSINT (уверенность ${(entity.confidence * 100).toFixed(0)}%)`,
      x_tomahawk_properties: entity.properties,
      x_tomahawk_aliases: entity.aliases,
    };
  }
  const base: StixObject = {
    type: STIX_SCO_BY_TYPE[entity.type] ?? 'x-observable',
    id,
    spec_version: '2.1',
    x_tomahawk_type: entity.type,
    x_tomahawk_confidence: entity.confidence,
    x_tomahawk_properties: entity.properties,
  };
  switch (entity.type) {
    case 'email':
      return { ...base, value: entity.value };
    case 'phone':
      return { ...base, value: entity.value, x_national_number: entity.properties.nationalNumber };
    case 'domain':
    case 'subdomain':
      return { ...base, value: entity.value };
    case 'ip':
      return { ...base, value: entity.value };
    case 'url':
      return { ...base, value: entity.value };
    case 'username':
    case 'social_profile':
      return { ...base, account_login: entity.value, display_name: entity.label };
    case 'crypto_address':
      return { ...base, address: entity.value, x_chain: entity.properties.chain };
    case 'location':
      return { ...base, name: entity.label, latitude: entity.properties.latitude, longitude: entity.properties.longitude };
    default:
      return { ...base, name: entity.label, value: entity.value };
  }
}

/**
 * STIX 2.1 bundle with SCOs, relationships derived from graph edges, indicators
 * for high-risk infrastructure and a `report` object summarising the case.
 */
export function toStixBundle(report: InvestigationReport): string {
  const objects: StixObject[] = [];
  const idMap = new Map<string, string>();

  for (const entity of report.entities) {
    const stix = stixObjectFor(entity);
    objects.push(stix);
    idMap.set(entity.id, stix.id as string);
  }

  for (const edge of report.edges) {
    const source = idMap.get(edge.from);
    const target = idMap.get(edge.to);
    if (!source || !target) continue;
    objects.push({
      type: 'relationship',
      id: `relationship--${deterministicUuid(`rel:${edge.id}`)}`,
      spec_version: '2.1',
      relationship_type: String(edge.relation).replace(/_/g, '-'),
      source_ref: source,
      target_ref: target,
      description: `Связь «${edge.relation}» выявлена на основе ${edge.evidenceIds.length} наблюдений (уверенность ${(edge.confidence * 100).toFixed(0)}%)`,
      confidence: Math.round(edge.confidence * 100),
    });
  }

  const indicatorTypes: EntityType[] = ['domain', 'ip', 'url', 'crypto_address'];
  const indicatorRefs: string[] = [];
  for (const entity of report.entities.filter((candidate) => indicatorTypes.includes(candidate.type))) {
    const flagged = entity.tags.some((tag) => ['suspicious-domain', 'dga', 'typosquat', 'invalid-checksum', 'sanctioned', 'darknet'].includes(tag));
    const riskDriver = report.risk.factors.some((factor) => factor.evidenceIds.some((evidenceId) => entity.evidenceIds.includes(evidenceId)));
    if (!flagged && !riskDriver) continue;

    const pattern =
      entity.type === 'domain'
        ? `[domain-name:value = '${entity.value}']`
        : entity.type === 'ip'
          ? `[ipv4-addr:value = '${entity.value}']`
          : entity.type === 'url'
            ? `[url:value = '${entity.value}']`
            : `[x-crypto-wallet:address = '${entity.value}']`;

    const indicatorId = `indicator--${deterministicUuid(`ind:${entity.id}`)}`;
    objects.push({
      type: 'indicator',
      id: indicatorId,
      spec_version: '2.1',
      created: new Date(report.generatedAt).toISOString(),
      modified: new Date(report.generatedAt).toISOString(),
      name: `${entity.type}: ${entity.label}`,
      description: `Индикатор выявлен движком TOMAHAWK OSINT. Теги: ${entity.tags.join(', ') || '—'}`,
      indicator_types: ['anomalous-activity'],
      pattern,
      pattern_type: 'stix',
      valid_from: new Date(report.generatedAt).toISOString(),
      confidence: Math.round(entity.confidence * 100),
      x_tomahawk_evidence: entity.evidenceIds,
    });
    indicatorRefs.push(indicatorId);
  }

  const noteRefs: string[] = [];
  for (const finding of report.findings.slice(0, 40)) {
    const noteId = `note--${deterministicUuid(`note:${finding.id}`)}`;
    objects.push({
      type: 'note',
      id: noteId,
      spec_version: '2.1',
      created: new Date(report.generatedAt).toISOString(),
      modified: new Date(report.generatedAt).toISOString(),
      abstract: finding.title,
      content: `${finding.detail}${finding.recommendation ? `\n\nРекомендация: ${finding.recommendation}` : ''}`,
      object_refs: [...finding.entityIds.map((id) => idMap.get(id)).filter((id): id is string => Boolean(id)), ...indicatorRefs.slice(0, 5)],
      confidence: Math.round(finding.confidence * 100),
      x_tomahawk_severity: finding.severity,
    });
    noteRefs.push(noteId);
  }

  const reportId = `report--${deterministicUuid(`report:${report.id}`)}`;
  objects.push({
    type: 'report',
    id: reportId,
    spec_version: '2.1',
    created: new Date(report.generatedAt).toISOString(),
    modified: new Date(report.generatedAt).toISOString(),
    name: `TOMAHAWK OSINT // ${report.narrative.headline}`,
    description: report.narrative.summary,
    report_types: ['osint', 'threat-report'],
    published: new Date(report.generatedAt).toISOString(),
    object_refs: [...idMap.values(), ...indicatorRefs, ...noteRefs],
    confidence: Math.round(report.risk.confidence * 100),
    x_tomahawk_risk_score: report.risk.score,
    x_tomahawk_risk_level: report.risk.level,
    x_tomahawk_evidence_digest: report.integrity.evidenceDigest,
  });

  return JSON.stringify(
    {
      type: 'bundle',
      id: `bundle--${deterministicUuid(`bundle:${report.id}`)}`,
      objects,
    },
    null,
    2,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Markdown
// ─────────────────────────────────────────────────────────────────────────────

export function toMarkdown(report: InvestigationReport): string {
  const lines: string[] = [];
  const date = new Date(report.generatedAt).toISOString().replace('T', ' ').slice(0, 19);

  lines.push(`# TOMAHAWK OSINT — отчёт ${report.id}`);
  lines.push('');
  lines.push(`**Объект:** ${report.narrative.headline}  `);
  lines.push(`**Профиль:** ${report.profile}  `);
  lines.push(`**Дата формирования:** ${date} UTC  `);
  lines.push(`**Уровень риска:** ${report.risk.level} (${report.risk.score}/100, уверенность ${(report.risk.confidence * 100).toFixed(0)}%)  `);
  lines.push(`**Собрано:** ${report.entities.length} сущностей, ${report.edges.length} связей, ${report.evidence.length} наблюдений за ${(report.trace.durationMs / 1000).toFixed(1)} с`);
  lines.push('');
  lines.push('## Резюме');
  lines.push('');
  lines.push(report.narrative.summary);
  lines.push('');
  for (const point of report.narrative.keyPoints) lines.push(`- ${point}`);
  lines.push('');

  lines.push('## Ключевые находки');
  lines.push('');
  if (!report.findings.length) lines.push('_Значимых находок не выявлено._');
  else {
    lines.push('| Приоритет | Находка | Уверенность | Модуль |');
    lines.push('| --- | --- | --- | --- |');
    for (const finding of report.findings.slice(0, 30)) {
      lines.push(`| ${finding.severity.toUpperCase()} (${finding.score}) | ${finding.title} | ${(finding.confidence * 100).toFixed(0)}% | ${finding.moduleId} |`);
    }
    lines.push('');
    for (const finding of report.findings.slice(0, 12)) {
      lines.push(`### ${finding.title}`);
      lines.push('');
      lines.push(finding.detail);
      if (finding.recommendation) {
        lines.push('');
        lines.push(`> **Действие:** ${finding.recommendation}`);
      }
      lines.push('');
    }
  }

  lines.push('## Факторы риска');
  lines.push('');
  for (const factor of report.risk.drivers) {
    lines.push(`- **${factor.label}** — вклад ${(factor.contribution * 100).toFixed(2)} п.п. (категория ${factor.category}, серьёзность ${(factor.severity * 100).toFixed(0)}%)`);
  }
  lines.push('');
  lines.push(`> Остаточный риск после устранения главного фактора: ${report.risk.residualAfterTopRemediation}/100`);
  lines.push('');

  lines.push('## Сущности');
  lines.push('');
  lines.push('| Тип | Значение | Уверенность | Источники |');
  lines.push('| --- | --- | --- | --- |');
  for (const entity of report.entities.slice(0, 120)) {
    lines.push(`| ${entity.type} | ${entity.label.replace(/\|/g, '/')} | ${(entity.confidence * 100).toFixed(0)}% | ${entity.sources.join(', ')} |`);
  }
  lines.push('');

  if (report.graph.predictions.length) {
    lines.push('## Предполагаемые скрытые связи');
    lines.push('');
    for (const prediction of report.graph.predictions.slice(0, 10)) {
      const from = report.entities.find((entity) => entity.id === prediction.from)?.label ?? prediction.from;
      const to = report.entities.find((entity) => entity.id === prediction.to)?.label ?? prediction.to;
      lines.push(`- ${from} ↔ ${to} — оценка ${(prediction.score * 100).toFixed(0)}%, ${prediction.reason}`);
    }
    lines.push('');
  }

  lines.push('## Хронология');
  lines.push('');
  for (const event of report.timeline.slice(-40)) {
    lines.push(`- ${new Date(event.timestamp).toISOString().slice(0, 10)} — ${event.label} _(${event.precision})_`);
  }
  lines.push('');

  lines.push('## Ограничения и достоверность');
  lines.push('');
  for (const caveat of report.narrative.caveats) lines.push(`- ${caveat}`);
  lines.push('');

  lines.push('## Целостность отчёта');
  lines.push('');
  lines.push('```');
  lines.push(`evidence SHA-256 : ${report.integrity.evidenceDigest}`);
  lines.push(`report   SHA-256 : ${report.integrity.reportDigest}`);
  lines.push(`engine           : ${report.integrity.generatedBy} v${report.integrity.engineVersion}`);
  lines.push('```');
  return lines.join('\n');
}

export function exportReport(report: InvestigationReport, format: ExportFormat, section?: Parameters<typeof toCsv>[1]): string {
  switch (format) {
    case 'json':
      return toJson(report);
    case 'jsonl':
      return toJsonl(report);
    case 'csv':
      return toCsv(report, section ?? 'entities');
    case 'graphml':
      return toGraphML(report);
    case 'stix2':
      return toStixBundle(report);
    case 'markdown':
      return toMarkdown(report);
  }
}
