import React, { useState } from 'react';
import { Database, Search, Radio } from 'lucide-react';

interface BreachRecord {
  id: string;
  source: string;
  category: string;
  recordsCount: string;
  date: string;
  status: string;
  sampleFields: string[];
}

const DATABASE_CATALOG: BreachRecord[] = [
  {
    id: 'db-01',
    source: 'Яндекс.Еда (Архив заказов и адресов)',
    category: 'Доставка / E-Commerce',
    recordsCount: '58,240,000',
    date: 'Март 2022',
    status: 'Проиндексировано 100%',
    sampleFields: ['ФИО', 'Телефон', 'Точный адрес с домофоном', 'Сумма заказов', 'Комментарии курьеру'],
  },
  {
    id: 'db-02',
    source: 'СДЭК Доставка (Логистические треки)',
    category: 'Логистика / Экспресс-почта',
    recordsCount: '25,000,000',
    date: 'Июль 2023',
    status: 'Проиндексировано 100%',
    sampleFields: ['Телефон', 'Email', 'Паспортные данные', 'Адрес ПВЗ / дома', 'Описания посылок'],
  },
  {
    id: 'db-03',
    source: 'Delivery Club (База клиентов)',
    category: 'Фудтех / Заказы',
    recordsCount: '19,500,000',
    date: 'Май 2022',
    status: 'Проиндексировано 100%',
    sampleFields: ['ФИО', 'Телефон', 'Email', 'Хэши паролей sha1/bcrypt', 'Адреса'],
  },
  {
    id: 'db-04',
    source: 'Альфа-Банк (Премиум клиенты Darknet Dump)',
    category: 'Банки / Финансы',
    recordsCount: '3,800,000',
    date: 'Апрель 2024',
    status: 'Секретно // Расшифровано',
    sampleFields: ['ФИО', 'Телефон', 'Паспорт', 'Остатки на счетах', 'Менеджер А-Клуба'],
  },
  {
    id: 'db-05',
    source: 'Гемотест & Инвитро (Медицинские анализы)',
    category: 'Здравоохранение / Биометрия',
    recordsCount: '31,000,000',
    date: 'Май 2022 / 2024',
    status: 'Проиндексировано',
    sampleFields: ['ФИО', 'Дата рождения', 'Телефон', 'Группа крови', 'Результаты тестов'],
  },
  {
    id: 'db-06',
    source: 'Telegram Darknet Dumps & Combolists',
    category: 'Мессенджеры / OSINT',
    recordsCount: '142,000,000',
    date: '2020 — 2026 Live',
    status: 'Онлайн-поток',
    sampleFields: ['User ID', 'Username', 'Номер телефона', 'Слитые сообщения', 'Владельцы каналов'],
  },
  {
    id: 'db-07',
    source: 'Парковки Москвы & ЦОДД',
    category: 'Транспорт / Геолокация',
    recordsCount: '84,000,000',
    date: '2021 — 2025',
    status: 'Проиндексировано',
    sampleFields: ['Госномер', 'Марка авто', 'Телефон', 'Таймстампы парковок', 'Геокоординаты'],
  },
  {
    id: 'db-08',
    source: 'ФСБ Кордон / Авиаперелеты & Погранслужба',
    category: 'Спецреестры / Границы',
    recordsCount: '12,400,000',
    date: '2018 — 2026',
    status: 'Оперативный учет',
    sampleFields: ['Загранпаспорт', 'Авиакомпания', 'Номер рейса', 'Маршрут', 'Визовые отметки'],
  },
];

export const BreachExplorer: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCatalog = DATABASE_CATALOG.filter(
    (item) =>
      item.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-3 pb-20 select-none">
      {/* Header */}
      <div className="ios-glass p-3.5 rounded-[16px] border border-hair space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Radio className="w-4 h-4 text-clay animate-pulse" />
            <span className="text-xs font-bold text-white uppercase tracking-tight">
              Дымовые Сигналы // Сканер Баз Утечек
            </span>
          </div>
          <span className="text-[10px] font-mono text-sage font-bold bg-sage-soft px-2 py-0.5 rounded-full border border-hair">
            4.8 МЛРД ЗАПИСЕЙ
          </span>
        </div>

        <p className="text-[11px] text-ink">
          Каталог проиндексированных утечек баз данных для мгновенного сопоставления связей и верификации досье.
        </p>

        {/* Search input */}
        <div className="relative pt-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Поиск по реестрам (Яндекс, СДЭК, Альфа, ФСБ...)"
            className="w-full px-3.5 py-2 bg-panel border border-hair rounded-xl text-white text-xs placeholder:text-faint focus:outline-none focus:border-hair"
          />
          <Search className="absolute right-3 top-3 w-4 h-4 text-muted pointer-events-none" />
        </div>
      </div>

      {/* Database Cards List */}
      <div className="space-y-2.5">
        {filteredCatalog.map((db) => (
          <div
            key={db.id}
            className="ios-glass p-3 rounded-[16px] border border-hair space-y-2 hover:border-hair transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                  <Database className="w-3.5 h-3.5 text-clay shrink-0" />
                  <span>{db.source}</span>
                </div>
                <div className="text-[10px] text-gold font-mono mt-0.5">
                  {db.category} • {db.date}
                </div>
              </div>

              <span className="text-[9px] font-mono text-sage bg-sage-soft px-1.5 py-0.2 rounded border border-hair whitespace-nowrap">
                {db.status}
              </span>
            </div>

            <div className="flex items-center justify-between text-[10px] bg-panel px-2.5 py-1.5 rounded-lg font-mono">
              <span className="text-muted">Количество строк:</span>
              <span className="text-white font-bold">{db.recordsCount}</span>
            </div>

            {/* Field Tags */}
            <div className="flex flex-wrap gap-1 pt-0.5">
              {db.sampleFields.map((field, fIdx) => (
                <span
                  key={fIdx}
                  className="px-1.5 py-0.2 bg-white/5 rounded text-[9px] text-ink border border-hair font-mono"
                >
                  {field}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
