import React, { useState } from 'react';
import type { InvestigationReport } from '../../osint/types/report';
import { ENTITY_LABEL_RU } from '../../osint/types/entity';
import {
  Shield,
  Search,
  Clock,
  Database,
  Layers,
  AlertTriangle,
  FileText,
  Network,
  ExternalLink,
  Activity,
  Eye,
  Link2,
  Copy,
  Check,
} from 'lucide-react';
import { sound } from '../../utils/sound';

interface Props {
  report: InvestigationReport;
  onExport?: (format: 'json' | 'markdown' | 'stix2' | 'graphml' | 'csv') => void;
}

const RISK_COLOR: Record<string, string> = {
  critical: 'text-red-400 bg-red-500/10 border-red-500/30',
  severe: 'text-red-300 bg-red-500/10 border-red-500/30',
  high: 'text-orange-300 bg-orange-500/10 border-orange-500/30',
  elevated: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  moderate: 'text-yellow-200 bg-yellow-500/10 border-yellow-500/30',
  medium: 'text-yellow-100 bg-yellow-500/10 border-yellow-500/30',
  low: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  minimal: 'text-emerald-200 bg-emerald-500/10 border-emerald-500/30',
  info: 'text-sky-200 bg-sky-500/10 border-sky-500/30',
};

export const OsintLiveReport: React.FC<Props> = ({ report, onExport }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'entities' | 'evidence' | 'findings' | 'graph' | 'trace'>('overview');
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1600);
    sound.playHapticTap();
  };

  const tabs = [
    { id: 'overview', label: 'Сводка', icon: FileText },
    { id: 'entities', label: `Сущности ${report.entities.length}`, icon: Layers },
    { id: 'evidence', label: `Наблюдения ${report.evidence.length}`, icon: Eye },
    { id: 'findings', label: `Выводы ${report.findings.length}`, icon: AlertTriangle },
    { id: 'graph', label: 'Граф', icon: Network },
    { id: 'trace', label: 'Трасса', icon: Activity },
  ] as const;

  return (
    <div className="space-y-3 pb-6">
      {/* Header */}
      <div className="ios-glass p-4 rounded-[20px] border border-hair space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className={`w-2.5 h-2.5 rounded-full ${report.risk.score > 60 ? 'bg-red-400 animate-pulse' : 'bg-emerald-400'}`} />
            <span className="text-[10px] font-mono tracking-widest text-gold font-bold uppercase">
              TOMAHAWK OSINT // LIVE REPORT {report.id}
            </span>
          </div>
          <span className={`text-[9px] font-mono px-2 py-1 rounded-full border font-bold ${RISK_COLOR[report.risk.level] || RISK_COLOR.info}`}>
            РИСК {report.risk.level.toUpperCase()} • {report.risk.score}/100
          </span>
        </div>

        <h2 className="text-[15px] font-bold text-white leading-tight">{report.narrative.headline}</h2>
        <p className="text-xs text-ink leading-relaxed">{report.narrative.summary}</p>

        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="bg-panel p-2 rounded-xl border border-hair text-center">
            <div className="text-[9px] text-muted tracking-widest">СУЩНОСТЕЙ</div>
            <div className="text-sm font-bold text-white">{report.entities.length}</div>
          </div>
          <div className="bg-panel p-2 rounded-xl border border-hair text-center">
            <div className="text-[9px] text-muted tracking-widest">НАБЛЮДЕНИЙ</div>
            <div className="text-sm font-bold text-gold">{report.evidence.length}</div>
          </div>
          <div className="bg-panel p-2 rounded-xl border border-hair text-center">
            <div className="text-[9px] text-muted tracking-widest">ВРЕМЯ</div>
            <div className="text-sm font-bold text-white">{(report.trace.durationMs / 1000).toFixed(1)}c</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {report.narrative.keyPoints.slice(0, 3).map((kp, i) => (
            <span key={i} className="text-[10px] px-2 py-1 rounded-full bg-white/5 border border-hair text-ink">
              {kp}
            </span>
          ))}
        </div>

        <div className="flex gap-2 pt-2 border-t border-hair">
          {(['json', 'markdown', 'stix2'] as const).map((fmt) => (
            <button
              key={fmt}
              onClick={() => onExport?.(fmt)}
              className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[11px] font-semibold text-white border border-hair flex items-center justify-center space-x-1"
            >
              <Database className="w-3.5 h-3.5 text-gold" />
              <span>{fmt.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Integrity */}
      <div className="ios-glass p-3 rounded-[16px] border border-hair flex items-center justify-between text-[10px] font-mono">
        <div className="flex items-center space-x-2 text-muted">
          <Shield className="w-3.5 h-3.5 text-sage" />
          <span>Печать SHA-256</span>
        </div>
        <button onClick={() => copy(report.integrity.contentDigest, 'digest')} className="text-white flex items-center space-x-1">
          <span className="truncate max-w-[160px]">{report.integrity.contentDigest.slice(0, 16)}…</span>
          {copied === 'digest' ? <Check className="w-3 h-3 text-sage" /> : <Copy className="w-3 h-3 text-muted" />}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-panel rounded-[16px] border border-hair overflow-x-auto no-scrollbar">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as typeof activeTab)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap ${activeTab === t.id ? 'bg-clay text-white shadow' : 'text-muted hover:text-white'}`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-3">
          {/* Risk breakdown */}
          <div className="ios-glass p-3.5 rounded-[16px] border border-hair space-y-2">
            <div className="text-xs font-bold text-white flex items-center space-x-2">
              <Shield className="w-4 h-4 text-clay" />
              <span>Факторы риска (noisy-OR)</span>
              <span className="ml-auto text-[10px] font-mono text-muted">conf {(report.risk.confidence * 100).toFixed(0)}%</span>
            </div>
            {report.risk.factors.length === 0 ? (
              <div className="text-xs text-muted py-2">Факторы не выявлены — требуется ручная проверка.</div>
            ) : (
              <div className="space-y-1.5">
                {report.risk.factors.slice(0, 8).map((f) => (
                  <div key={f.id} className="bg-panel p-2.5 rounded-xl border border-hair flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white">{f.label}</div>
                      <div className="text-[11px] text-ink leading-snug">{f.explain}</div>
                      <div className="text-[9px] font-mono text-muted">{f.category} • {f.moduleId}</div>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-gold shrink-0">+{(f.contribution * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono pt-1">
              <div className="bg-panel p-2 rounded-lg border border-hair flex justify-between">
                <span className="text-muted">Итоговый</span>
                <span className="text-white font-bold">{report.risk.score}/100</span>
              </div>
              <div className="bg-panel p-2 rounded-lg border border-hair flex justify-between">
                <span className="text-muted">После устранения топ-1</span>
                <span className="text-sage font-bold">{report.risk.residualAfterTopRemediation}/100</span>
              </div>
            </div>
          </div>

          {/* Caveats */}
          {report.trace.caveats.length > 0 && (
            <div className="ios-glass p-3.5 rounded-[16px] border border-hair space-y-2">
              <div className="text-xs font-bold text-white flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Оговорки и ограничения</span>
              </div>
              <ul className="space-y-1">
                {report.trace.caveats.slice(0, 10).map((c, i) => (
                  <li key={i} className="text-[11px] text-ink bg-panel p-2 rounded-lg border border-hair">
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Timeline */}
          {report.timeline.length > 0 && (
            <div className="ios-glass p-3.5 rounded-[16px] border border-hair space-y-2">
              <div className="text-xs font-bold text-white flex items-center space-x-2">
                <Clock className="w-4 h-4 text-gold" />
                <span>Хронология ({report.timeline.length})</span>
              </div>
              <div className="space-y-1 max-h-[260px] overflow-y-auto no-scrollbar">
                {report.timeline.slice(0, 20).map((ev, i) => (
                  <div key={i} className="bg-panel p-2 rounded-lg border border-hair flex items-center justify-between">
                    <span className="text-xs text-white">{ev.label}</span>
                    <span className="text-[10px] font-mono text-muted">{new Date(ev.timestamp).toLocaleString('ru-RU')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Entities */}
      {activeTab === 'entities' && (
        <div className="space-y-2">
          {report.entities.map((e) => (
            <div key={e.id} className="ios-glass p-3 rounded-[16px] border border-hair space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-hair text-gold">
                  {ENTITY_LABEL_RU[e.type] || e.type}
                </span>
                <span className="text-[9px] font-mono text-muted">conf {(e.confidence * 100).toFixed(0)}% • depth {e.depth}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-white truncate">{e.label}</span>
                <button onClick={() => copy(e.value, e.id)} className="p-1 rounded-lg bg-white/5 border border-hair">
                  {copied === e.id ? <Check className="w-3 h-3 text-sage" /> : <Copy className="w-3 h-3 text-muted" />}
                </button>
              </div>
              <div className="text-[11px] font-mono text-muted break-all">{e.value}</div>
              {e.properties && Object.keys(e.properties).length > 0 && (
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  {Object.entries(e.properties).slice(0, 6).map(([k, v]) => (
                    <div key={k} className="bg-panel p-1.5 rounded-lg border border-hair">
                      <div className="text-[9px] text-muted">{k}</div>
                      <div className="text-[11px] text-white truncate">{String(v)}</div>
                    </div>
                  ))}
                </div>
              )}
              {e.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {e.tags.slice(0, 6).map((t) => (
                    <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-hair text-ink font-mono">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Evidence */}
      {activeTab === 'evidence' && (
        <div className="space-y-2">
          {report.evidence.map((ev) => (
            <div key={ev.id} className="ios-glass p-3 rounded-[16px] border border-hair space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-white">{ev.key}</span>
                <span className="text-[9px] font-mono text-gold">{ev.source.kind} • {(ev.confidence * 100).toFixed(0)}%</span>
              </div>
              <div className="text-xs text-ink leading-relaxed">{ev.claim}</div>
              <div className="bg-panel p-2 rounded-lg border border-hair text-[11px] font-mono text-white break-all max-h-[84px] overflow-y-auto no-scrollbar">
                {typeof ev.value === 'string' ? ev.value : JSON.stringify(ev.value, null, 2)}
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-muted">
                <span className="flex items-center gap-1">
                  <Database className="w-3 h-3" />
                  {ev.source.name}
                </span>
                {ev.source.url && (
                  <a href={ev.source.url} target="_blank" rel="noreferrer" className="text-gold flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" />
                    источник
                  </a>
                )}
              </div>
              {ev.source.via && <div className="text-[9px] font-mono text-muted">via: {ev.source.via}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Findings */}
      {activeTab === 'findings' && (
        <div className="space-y-2">
          {report.findings.length === 0 ? (
            <div className="ios-glass p-6 rounded-[16px] border border-hair text-center text-sm text-muted">Находок пока нет — система не выявила критичных паттернов.</div>
          ) : (
            report.findings.map((f) => (
              <div key={f.id} className="ios-glass p-3 rounded-[16px] border border-hair space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border font-bold ${RISK_COLOR[f.severity] || RISK_COLOR.info}`}>
                    {f.severity.toUpperCase()}
                  </span>
                  <span className="text-[9px] font-mono text-muted">score {f.score} • {(f.confidence * 100).toFixed(0)}%</span>
                </div>
                <div className="text-xs font-bold text-white">{f.title}</div>
                <div className="text-[11px] text-ink leading-relaxed">{f.detail}</div>
                {f.recommendation && <div className="text-[11px] text-sage bg-sage-soft/20 p-2 rounded-lg border border-hair">Рекомендация: {f.recommendation}</div>}
                <div className="text-[9px] font-mono text-muted">{f.category} • {f.moduleId}</div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Graph */}
      {activeTab === 'graph' && (
        <div className="space-y-3">
          <div className="ios-glass p-3.5 rounded-[16px] border border-hair grid grid-cols-2 gap-2 text-center">
            <div className="bg-panel p-2 rounded-xl border border-hair">
              <div className="text-[9px] text-muted">УЗЛОВ</div>
              <div className="text-sm font-bold text-white">{report.graph.entityCount}</div>
            </div>
            <div className="bg-panel p-2 rounded-xl border border-hair">
              <div className="text-[9px] text-muted">СВЯЗЕЙ</div>
              <div className="text-sm font-bold text-gold">{report.graph.edgeCount}</div>
            </div>
            <div className="bg-panel p-2 rounded-xl border border-hair">
              <div className="text-[9px] text-muted">ПЛОТНОСТЬ</div>
              <div className="text-sm font-bold text-white">{report.graph.density.toFixed(3)}</div>
            </div>
            <div className="bg-panel p-2 rounded-xl border border-hair">
              <div className="text-[9px] text-muted">КОМПОНЕНТ</div>
              <div className="text-sm font-bold text-white">{report.graph.componentCount}</div>
            </div>
          </div>

          <div className="ios-glass p-3.5 rounded-[16px] border border-hair space-y-2">
            <div className="text-xs font-bold text-white flex items-center space-x-2">
              <Link2 className="w-4 h-4 text-gold" />
              <span>Связи</span>
              <span className="ml-auto text-[10px] font-mono text-muted">{report.edges.length}</span>
            </div>
            <div className="space-y-1 max-h-[340px] overflow-y-auto no-scrollbar">
              {report.edges.slice(0, 30).map((e) => (
                <div key={e.id} className="bg-panel p-2 rounded-lg border border-hair flex items-center justify-between text-[11px]">
                  <span className="text-white font-mono truncate flex-1">{e.from.slice(0, 28)}</span>
                  <span className="mx-2 text-gold">—{e.relation}→</span>
                  <span className="text-white font-mono truncate flex-1 text-right">{e.to.slice(0, 28)}</span>
                </div>
              ))}
            </div>
          </div>

          {report.graph.predictions.length > 0 && (
            <div className="ios-glass p-3.5 rounded-[16px] border border-hair space-y-2">
              <div className="text-xs font-bold text-white">Предсказанные скрытые связи</div>
              {report.graph.predictions.slice(0, 6).map((p, i) => (
                <div key={i} className="bg-panel p-2 rounded-lg border border-hair text-[11px]">
                  <div className="text-white font-mono truncate">
                    {p.from} ↔ {p.to}
                  </div>
                  <div className="text-muted">{p.reason}</div>
                  <div className="text-gold font-mono">score {p.score.toFixed(3)}</div>
                </div>
              ))}
            </div>
          )}

          {report.graph.hubs.length > 0 && (
            <div className="ios-glass p-3.5 rounded-[16px] border border-hair">
              <div className="text-xs font-bold text-white mb-2">Хабы (центральные узлы)</div>
              <div className="flex flex-wrap gap-1.5">
                {report.graph.hubs.map((h) => (
                  <span key={h} className="text-[10px] font-mono px-2 py-1 rounded-full bg-clay/15 border border-hair text-white">
                    {h.slice(0, 36)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trace */}
      {activeTab === 'trace' && (
        <div className="space-y-3">
          <div className="ios-glass p-3.5 rounded-[16px] border border-hair grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-panel p-2 rounded-lg border border-hair flex justify-between">
              <span className="text-muted">Модулей</span>
              <span className="text-white font-bold">{report.trace.modules.length}</span>
            </div>
            <div className="bg-panel p-2 rounded-lg border border-hair flex justify-between">
              <span className="text-muted">Запросов</span>
              <span className="text-white font-bold">
                {report.trace.counters.requests} ({report.trace.counters.requestFailures} fail)
              </span>
            </div>
            <div className="bg-panel p-2 rounded-lg border border-hair flex justify-between">
              <span className="text-muted">Кэш</span>
              <span className="text-sage font-bold">{report.trace.counters.cacheHits}</span>
            </div>
            <div className="bg-panel p-2 rounded-lg border border-hair flex justify-between">
              <span className="text-muted">Пивоты</span>
              <span className="text-white font-bold">{report.trace.counters.pivotsExpanded}</span>
            </div>
          </div>

          <div className="space-y-1">
            {report.trace.modules.map((m, i) => (
              <div key={i} className="bg-panel p-2.5 rounded-xl border border-hair flex items-center justify-between gap-2 text-[11px]">
                <div className="min-w-0">
                  <div className="text-white font-semibold truncate">{m.moduleId}</div>
                  <div className="text-[10px] font-mono text-muted truncate">{m.entityId.slice(0, 36)}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full border inline-block ${m.status === 'ok' ? 'bg-sage-soft text-sage border-sage/30' : m.status === 'empty' ? 'bg-white/5 text-muted border-hair' : m.status === 'error' ? 'bg-clay-soft text-clay border-clay/30' : 'bg-white/5 text-muted border-hair'}`}>
                    {m.status}
                  </div>
                  <div className="text-[9px] font-mono text-muted">{m.durationMs}ms • {m.evidenceCount} ev • {m.entityCount} ent</div>
                </div>
              </div>
            ))}
          </div>

          <div className="ios-glass p-3 rounded-[16px] border border-hair space-y-1">
            <div className="text-xs font-bold text-white flex items-center space-x-2">
              <Search className="w-3.5 h-3.5 text-gold" />
              <span>Покрытие по модулям</span>
            </div>
            {Object.entries(report.coverage.byModule).map(([mod, cov]) => (
              <div key={mod} className="flex items-center justify-between text-[11px] bg-panel p-2 rounded-lg border border-hair">
                <span className="text-white truncate flex-1">{mod}</span>
                <span className="text-muted font-mono ml-2">
                  {cov.ok}/{cov.ran} ok • {cov.failed} fail
                </span>
              </div>
            ))}
            <div className="text-[10px] font-mono text-muted pt-1">
              Источники: {Object.entries(report.coverage.sourceKinds).map(([k, v]) => `${k}×${v}`).join(' • ') || '—'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
