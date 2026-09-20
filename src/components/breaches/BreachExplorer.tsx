import React, { useState } from 'react';
import { Database, Search, Radio, Building, ExternalLink, CheckCircle2 } from 'lucide-react';
import { OFFICIAL_REGISTRIES_DATABASE } from '../../utils/osint/registryLinks';
import { sound } from '../../utils/sound';

interface BreachKnowledgeItem {
  id: string;
  source: string;
  category: string;
  recordsCount: string;
  date: string;
  format: string;
  hashTypes: string;
  sampleFields: string[];
  impactAnalysis: string;
  verificationAdvice: string;
}

const BREACH_KNOWLEDGE_BASE: BreachKnowledgeItem[] = [
  {
    id: 'kb-01',
    source: 'Яндекс.Еда (Архив заказов и доставок)',
    category: 'Фудтех / Доставка',
    recordsCount: '58,240,000',
    date: 'Март 2022',
    format: 'PostgreSQL SQL Dump / CSV Таблицы',
    hashTypes: 'Пароли отсутствуют (номера телефонов в открытом виде)',
    sampleFields: ['ФИО клиента', 'Телефон (+7...)', 'Точный адрес с подъездом, этажом и домофоном', 'Сумма заказов', 'Комментарии курьеру'],
    impactAnalysis: 'Позволяет с высокой точностью деанонимизировать фактическое место проживания и уровень расходов цели.',
    verificationAdvice: 'Сопоставлять адрес доставки с данными Росреестра и биллингами сотовой связи.',
  },
  {
    id: 'kb-02',
    source: 'СДЭК Доставка (Логистический архив посылок)',
    category: 'Логистика / Почта',
    recordsCount: '25,000,000',
    date: 'Июль 2023 / Февраль 2024',
    format: 'JSON / CSV Dumps',
    hashTypes: 'Plaintext (Телефоны, Email, Паспорта)',
    sampleFields: ['Телефон получателя/отправителя', 'Email', 'Паспортные данные', 'Адрес ПВЗ или доставки', 'Описания отправлений'],
    impactAnalysis: 'Раскрывает деловые и личные связи через отправителей и получателей посылок.',
    verificationAdvice: 'Использовать трек-номера и адреса ПВЗ для выявления регулярных маршрутов.',
  },
  {
    id: 'kb-03',
    source: 'Delivery Club (База клиентов и заказов)',
    category: 'E-Commerce / Фудтех',
    recordsCount: '19,500,000',
    date: 'Май 2022',
    format: 'MySQL Dump',
    hashTypes: 'SHA-1 / bcrypt',
    sampleFields: ['ФИО', 'Телефон', 'Email', 'Хэш пароля', 'Адрес', 'User-Agent устройства'],
    impactAnalysis: 'Содержит хэши паролей, часто повторно используемые фигурантами на других ресурсах.',
    verificationAdvice: 'Проверять хэши по таблицам rainbow-tables и словарям утечек.',
  },
  {
    id: 'kb-04',
    source: 'Гемотест & Инвитро (Медицинские реестры)',
    category: 'Здравоохранение / Медицина',
    recordsCount: '31,000,000',
    date: 'Май 2022',
    format: 'CSV / Excel',
    hashTypes: 'Plaintext',
    sampleFields: ['ФИО', 'Дата рождения', 'Телефон', 'Email', 'Паспорт РФ', 'Коды медицинских анализов'],
    impactAnalysis: 'Критическая утечка персональных и медицинских данных высокой степени достоверности.',
    verificationAdvice: 'Сверять паспортные данные и дату рождения с реестрами МВД и Госуслуг.',
  },
  {
    id: 'kb-05',
    source: 'Парковки Москвы & ЦОДД (Геофиксации ТС)',
    category: 'Транспорт / Геолокация',
    recordsCount: '84,000,000',
    date: '2021 — 2024',
    format: 'CSV / GeoJSON',
    hashTypes: 'Plaintext',
    sampleFields: ['Госномер (ГРЗ)', 'Номер зоны парковки', 'Телефон плательщика', 'Время начала/окончания', 'Сумма оплаты'],
    impactAnalysis: 'Точная геолокация перемещений транспортного средства в Москве с временными метками.',
    verificationAdvice: 'Сопоставлять номер парковочной зоны с картой Моспаркинг для привязки к конкретному дому/офису.',
  },
  {
    id: 'kb-06',
    source: 'Telegram Darknet Combolists & Bot Dumps',
    category: 'Мессенджеры / OSINT',
    recordsCount: '142,000,000+',
    date: '2020 — 2026',
    format: 'JSON Lines / SQLite',
    hashTypes: 'TG Bot Auth Tokens / User IDs',
    sampleFields: ['Telegram User ID', 'Username (@)', 'Номер телефона', 'Связанные группы/каналы', 'Слитые переписки ботов'],
    impactAnalysis: 'Позволяет однозначно связать анонимный Telegram ID с реальным телефонным номером.',
    verificationAdvice: 'Использовать боты проверки истории юзернеймов и привязки ID к телефону.',
  },
];

export const BreachExplorer: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'registries' | 'leaks'>('registries');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRegistries = OFFICIAL_REGISTRIES_DATABASE.filter((item) => {
    return (
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.authority.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const filteredLeaks = BREACH_KNOWLEDGE_BASE.filter((item) => {
    return (
      item.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.impactAnalysis.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="space-y-3 pb-20 select-none">
      {/* Header */}
      <div className="relative overflow-hidden rounded-[20px] ios-glass-card p-4 border border-hair">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center space-x-2">
            <Radio className="w-3.5 h-3.5 text-clay animate-pulse" />
            <span className="text-[10px] font-mono tracking-widest text-gold font-bold uppercase">
              ОФИЦИАЛЬНЫЕ РЕЕСТРЫ & БАЗЫ ДАННЫХ
            </span>
          </div>
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-clay/20 text-clay font-mono">
            ГОСРЕЕСТРЫ РФ + OSINT
          </span>
        </div>

        <h1 className="text-xl font-semibold text-white tracking-tight ">
          КАТАЛОГ ИСТОЧНИКОВ РАЗВЕДКИ
        </h1>
        <p className="text-xs text-ink mt-1 leading-relaxed">
          Прямой доступ к государственным реестрам РФ, базам судов, ФНС, ГИБДД, ФССП и справочнику утечек.
        </p>
      </div>

      {/* Segmented Mode Switcher */}
      <div className="grid grid-cols-2 gap-1 p-1 bg-panel rounded-[16px] border border-hair backdrop-blur-md">
        <button
          onClick={() => {
            sound.playHapticTap();
            setActiveTab('registries');
          }}
          className={`flex items-center justify-center space-x-2 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'registries'
              ? 'bg-gradient-to-r from-[#c2664f] to-[#a8834c] text-white shadow-[0_10px_30px_rgba(0,0,0,.28)] border border-hair font-bold'
              : 'text-muted hover:text-white hover:bg-white/5'
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>Госреестры РФ ({OFFICIAL_REGISTRIES_DATABASE.length})</span>
        </button>

        <button
          onClick={() => {
            sound.playHapticTap();
            setActiveTab('leaks');
          }}
          className={`flex items-center justify-center space-x-2 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'leaks'
              ? 'bg-gradient-to-r from-[#c2664f] to-[#a8834c] text-white shadow-[0_10px_30px_rgba(0,0,0,.28)] border border-hair font-bold'
              : 'text-muted hover:text-white hover:bg-white/5'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Справочник утечек ({BREACH_KNOWLEDGE_BASE.length})</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3 w-4 h-4 text-muted" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Поиск по реестрам, базам данных, категориям..."
          className="w-full pl-10 pr-4 py-2.5 bg-panel border border-hair rounded-[16px] text-xs text-white placeholder-muted focus:outline-none focus:border-clay transition-colors"
        />
      </div>

      {/* ==================================================================== */}
      {/* 1. OFFICIAL REGISTRIES TAB */}
      {/* ==================================================================== */}
      {activeTab === 'registries' && (
        <div className="space-y-2.5">
          {filteredRegistries.map((reg) => (
            <div
              key={reg.id}
              className="ios-glass p-3.5 rounded-[16px] border border-hair space-y-2.5 hover:border-hair/80 transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-bold text-white tracking-tight flex items-center space-x-1.5">
                    <Building className="w-3.5 h-3.5 text-gold shrink-0" />
                    <span>{reg.name}</span>
                  </div>
                  <div className="text-[10px] text-muted font-mono mt-0.5">{reg.authority}</div>
                </div>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 text-ink font-mono border border-hair shrink-0">
                  {reg.badge}
                </span>
              </div>

              <p className="text-[11px] text-ink leading-relaxed">
                {reg.description}
              </p>

              <div className="pt-1 flex items-center justify-between border-t border-hair">
                <span className="text-[9px] font-mono text-muted">{reg.category}</span>
                <a
                  href={reg.officialUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="py-1 px-2.5 bg-white/5 hover:bg-white/15 text-white rounded-lg text-[10px] font-semibold flex items-center space-x-1 border border-hair transition-all"
                >
                  <ExternalLink className="w-3 h-3 text-gold" />
                  <span>Открыть портал</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. LEAKS KNOWLEDGE BASE TAB */}
      {/* ==================================================================== */}
      {activeTab === 'leaks' && (
        <div className="space-y-3">
          {filteredLeaks.map((item) => (
            <div
              key={item.id}
              className="ios-glass p-3.5 rounded-[16px] border border-hair space-y-2.5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-bold text-white tracking-tight">{item.source}</div>
                  <div className="text-[10px] text-gold font-mono">{item.category} • {item.date}</div>
                </div>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-clay/20 text-clay border border-hair">
                  {item.recordsCount} строк
                </span>
              </div>

              <div className="bg-panel p-2.5 rounded-xl border border-hair space-y-1.5 text-[11px]">
                <div>
                  <span className="text-muted text-[10px]">Формат данных: </span>
                  <span className="font-mono text-white">{item.format}</span>
                </div>
                <div>
                  <span className="text-muted text-[10px]">Поля утечки: </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {item.sampleFields.map((f, i) => (
                      <span key={i} className="px-1.5 py-0.2 bg-white/5 rounded text-[9px] font-mono text-ink border border-hair">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-ink leading-relaxed">
                <span className="text-gold font-semibold">Аналитическое значение: </span>
                {item.impactAnalysis}
              </div>

              <div className="text-[10px] text-sage bg-sage-soft/30 p-2 rounded-lg border border-hair flex items-start space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span><b className="text-white">Совет аналитику:</b> {item.verificationAdvice}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
