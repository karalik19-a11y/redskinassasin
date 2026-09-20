import React, { useState, useRef, useEffect } from 'react';
import type { Dossier } from '../../types/dossier';
import { Terminal, Send, Trash2 } from 'lucide-react';
import { sound } from '../../utils/sound';
import { exportDossierPDF } from '../../utils/pdfExport';
import {
  validateINN,
  validateSNILS,
  validatePassportRF,
  parseRussianPlate,
  decodeVIN,
} from '../../utils/osint/russianValidators';
import { analyzePhoneNumber } from '../../utils/osint/telecomIntelligence';
import { lookupIpIntelligence, queryDnsRecords, analyzeEmail, calculateCryptoHashes } from '../../utils/osint/networkIntelligence';
import { detectCryptoAddress, fetchLiveCryptoBalance } from '../../utils/osint/cryptoIntelligence';
import { huntUsernameFootprint } from '../../utils/osint/socialHunter';

interface CyberTerminalProps {
  currentDossier: Dossier | null;
  onRunScan: (name: string) => void;
}

interface CommandLog {
  id: string;
  type: 'input' | 'output' | 'error' | 'success' | 'warn';
  text: string;
}

export const CyberTerminal: React.FC<CyberTerminalProps> = ({
  currentDossier,
  onRunScan,
}) => {
  const [input, setInput] = useState('');
  const [logs, setLogs] = useState<CommandLog[]>([
    {
      id: '0',
      type: 'output',
      text: '⚡ TOMAHAWK OSINT // CYBER CLI v5.0 [Real OSINT Engine Initialized]',
    },
    {
      id: '1',
      type: 'output',
      text: 'Введите "help" для просмотра всех доступных утилит разведки.',
    },
  ]);

  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = input.trim();
    if (!cmd) return;

    sound.playHapticTap();
    const newLogs: CommandLog[] = [...logs, { id: `${Date.now()}-in`, type: 'input', text: `> ${cmd}` }];
    const parts = cmd.split(' ');
    const root = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ').trim();

    setInput('');

    switch (root) {
      case 'help':
        newLogs.push({
          id: `${Date.now()}-out`,
          type: 'output',
          text: `ДОСТУПНЫЕ КОМАНДЫ OSINT СИСТЕМЫ:
• ip <ip>             — Геолокация, ISP, ASN в реальном времени
• dns <domain> [MX|A] — DNS-over-HTTPS запрос через Cloudflare
• email <email>       — Валидация почты, проверка MX и disposable
• user <username>     — Поиск цифрового следа на 22+ платформах
• inn <инн>           — Проверка контрольной суммы ИНН (10/12 цифр)
• snils <снилс>       — Проверка контрольной суммы СНИЛС (ПФР)
• passport <серия+№>  — Проверка формата и ОКАТО региона паспорта
• plate <госномер>    — Распознавание региона ГРЗ РФ (например: А777ОС77)
• vin <vin>           — Декодер 17-значного VIN, WMI и года выпуска
• phone <номер>       — DEF маршрутизация, оператор и регион РФ
• crypto <адрес>      — Анализ BTC/ETH/TRON кошелька и баланс
• hash <текст>        — Расчет хэшей MD5, SHA-1, SHA-256
• b64enc / b64dec     — Кодирование/декодирование Base64
• dossier             — Вывести сводку текущего активного дела
• scan <ФИО>          — Создать новое оперативное досье
• export              — Экспорт официального PDF отчета
• clear               — Очистить консоль`,
        });
        break;

      case 'ip':
        if (!arg) {
          newLogs.push({ id: `${Date.now()}-err`, type: 'error', text: 'Ошибка: укажите IP. Пример: ip 185.220.101.5' });
        } else {
          newLogs.push({ id: `${Date.now()}-wait`, type: 'output', text: `[~] Запрос IP геолокации для ${arg}...` });
          setLogs(newLogs);
          const geo = await lookupIpIntelligence(arg);
          setLogs((prev) => [
            ...prev,
            {
              id: `${Date.now()}-res`,
              type: geo.isValid ? 'success' : 'error',
              text: geo.isValid
                ? `IP: ${geo.ip}
Страна/Город: ${geo.country} (${geo.city}, ${geo.region})
Провайдер: ${geo.isp}
ASN/Организация: ${geo.asn} ${geo.org}
Координаты: ${geo.latitude}, ${geo.longitude}
Часовой пояс: ${geo.timezone}`
                : `Ошибка: ${geo.isp}`,
            },
          ]);
          return;
        }
        break;

      case 'dns':
        if (!arg) {
          newLogs.push({ id: `${Date.now()}-err`, type: 'error', text: 'Ошибка: укажите домен. Пример: dns sberbank.ru MX' });
        } else {
          const [domain, typeParam] = arg.split(' ');
          const type = (typeParam || 'A').toUpperCase() as any;
          newLogs.push({ id: `${Date.now()}-wait`, type: 'output', text: `[~] DNS DoH запрос к ${domain} [${type}]...` });
          setLogs(newLogs);
          const recs = await queryDnsRecords(domain, type);
          setLogs((prev) => [
            ...prev,
            {
              id: `${Date.now()}-res`,
              type: recs.length > 0 ? 'success' : 'warn',
              text: recs.length > 0
                ? recs.map((r) => `[${r.type}] ${r.name} -> ${r.data} (TTL: ${r.TTL})`).join('\n')
                : `Записи типа [${type}] для домена "${domain}" не найдены или домен недоступен.`,
            },
          ]);
          return;
        }
        break;

      case 'email':
        if (!arg) {
          newLogs.push({ id: `${Date.now()}-err`, type: 'error', text: 'Ошибка: укажите email. Пример: email target@proton.me' });
        } else {
          newLogs.push({ id: `${Date.now()}-wait`, type: 'output', text: `[~] Анализ почтового адреса ${arg}...` });
          setLogs(newLogs);
          const mailInfo = await analyzeEmail(arg);
          setLogs((prev) => [
            ...prev,
            {
              id: `${Date.now()}-res`,
              type: mailInfo.isValidSyntax ? 'success' : 'error',
              text: mailInfo.isValidSyntax
                ? `EMAIL: ${mailInfo.email}
Категория: ${mailInfo.providerType}
Домен: ${mailInfo.domain}
MX Серверы: ${mailInfo.hasMxRecords ? mailInfo.mxServers.join(', ') : 'Не найдены'}
Disposable: ${mailInfo.isDisposable ? 'ДА (Временная почта)' : 'НЕТ'}
Поиск в утечках HIBP: ${mailInfo.searchLinks.hibp}`
                : `Синтаксис адреса некорректен.`,
            },
          ]);
          return;
        }
        break;

      case 'user':
        if (!arg) {
          newLogs.push({ id: `${Date.now()}-err`, type: 'error', text: 'Ошибка: укажите юзернейм. Пример: user m_sokolov' });
        } else {
          const results = huntUsernameFootprint(arg);
          newLogs.push({
            id: `${Date.now()}-res`,
            type: 'success',
            text: `ЦИФРОВОЙ СЛЕД ЮЗЕРНЕЙМА @${arg} (${results.length} платформ):
${results.map((r) => `• ${r.name} [${r.badge}]: ${r.profileUrl}`).join('\n')}`,
          });
        }
        break;

      case 'inn':
        if (!arg) {
          newLogs.push({ id: `${Date.now()}-err`, type: 'error', text: 'Ошибка: укажите ИНН. Пример: inn 770408192039' });
        } else {
          const val = validateINN(arg);
          newLogs.push({
            id: `${Date.now()}-res`,
            type: val.isValid ? 'success' : 'error',
            text: `[${val.type}]
Статус: ${val.isValid ? 'ВЕРЕН (Контрольная сумма сошлась)' : 'ОШИБКА: ' + val.error}
Формат: ${val.formatted}
Регион ФНС: ${val.details?.regionName || 'Н/Д'}
Инспекция: ${val.details?.inspectionCode || 'Н/Д'}`,
          });
        }
        break;

      case 'snils':
        if (!arg) {
          newLogs.push({ id: `${Date.now()}-err`, type: 'error', text: 'Ошибка: укажите СНИЛС. Пример: snils 148-291-049 88' });
        } else {
          const val = validateSNILS(arg);
          newLogs.push({
            id: `${Date.now()}-res`,
            type: val.isValid ? 'success' : 'error',
            text: `[${val.type}]
Статус: ${val.isValid ? 'ВЕРЕН (Алгоритм ПФР mod 101 пройден)' : 'ОШИБКА: ' + val.error}
Формат: ${val.formatted}`,
          });
        }
        break;

      case 'passport':
        if (!arg) {
          newLogs.push({ id: `${Date.now()}-err`, type: 'error', text: 'Ошибка: укажите серию и номер. Пример: passport 4512783921' });
        } else {
          const val = validatePassportRF(arg);
          newLogs.push({
            id: `${Date.now()}-res`,
            type: val.isValid ? 'success' : 'error',
            text: `[${val.type}]
Статус: ${val.isValid ? 'КОРРЕКТЕН' : 'ОШИБКА: ' + val.error}
Формат: ${val.formatted}
Регион ОКАТО: ${val.details?.regionName || 'Н/Д'} (${val.details?.federalDistrict || ''})
Примерный год выпуска: ${val.details?.issueYearEstimated || 'Н/Д'}`,
          });
        }
        break;

      case 'plate':
        if (!arg) {
          newLogs.push({ id: `${Date.now()}-err`, type: 'error', text: 'Ошибка: укажите госномер. Пример: plate А777ОС77' });
        } else {
          const val = parseRussianPlate(arg);
          newLogs.push({
            id: `${Date.now()}-res`,
            type: val.isValid ? 'success' : 'error',
            text: `[${val.type}]
Формат: ${val.formatted}
Регион РФ: ${val.details?.regionName || 'Н/Д'} (${val.details?.federalDistrict || ''})
Спецсерия: ${val.details?.specialNotes || 'Обычная'}`,
          });
        }
        break;

      case 'vin':
        if (!arg) {
          newLogs.push({ id: `${Date.now()}-err`, type: 'error', text: 'Ошибка: укажите 17-значный VIN. Пример: vin WP0AA2Y13MSA49201' });
        } else {
          const val = decodeVIN(arg);
          newLogs.push({
            id: `${Date.now()}-res`,
            type: val.isValid ? 'success' : 'error',
            text: val.isValid
              ? `[${val.type}]
Производитель: ${val.details?.manufacturer} (${val.details?.originCountry})
WMI: ${val.details?.wmi} | VDS: ${val.details?.vds}
Модельный год: ${val.details?.modelYear} (Символ: ${val.details?.modelYearCode})
Контрольный знак (ISO 3779): ${val.details?.checkDigit} (Валиден: ${val.details?.isNorthAmericanCheckValid ? 'ДА' : 'НЕТ'})`
              : `Ошибка: ${val.error}`,
          });
        }
        break;

      case 'phone':
        if (!arg) {
          newLogs.push({ id: `${Date.now()}-err`, type: 'error', text: 'Ошибка: укажите номер. Пример: phone +79164029188' });
        } else {
          const info = analyzePhoneNumber(arg);
          newLogs.push({
            id: `${Date.now()}-res`,
            type: 'success',
            text: `ТЕЛЕКОМ МАРШРУТИЗАЦИЯ:
Формат: ${info.nationalFormatted} (E.164: ${info.e164})
Оператор: ${info.operator} [${info.operatorCategory}]
Регион: ${info.region}
Часовой пояс: ${info.timeZone}
Telegram: ${info.links.telegramUrl}
WhatsApp: ${info.links.whatsappUrl}`,
          });
        }
        break;

      case 'crypto':
        if (!arg) {
          newLogs.push({ id: `${Date.now()}-err`, type: 'error', text: 'Ошибка: укажите адрес. Пример: crypto bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' });
        } else {
          const det = detectCryptoAddress(arg);
          newLogs.push({ id: `${Date.now()}-wait`, type: 'output', text: `[~] Анализ блокчейн-адреса ${arg}...` });
          setLogs(newLogs);
          let liveBal = '';
          if (det.isValid) {
            const b = await fetchLiveCryptoBalance(det.address, det.network);
            liveBal = `Баланс в сети: ${b.balance}${b.txCount ? ` (Транзакций: ${b.txCount})` : ''}`;
          }
          setLogs((prev) => [
            ...prev,
            {
              id: `${Date.now()}-res`,
              type: det.isValid ? 'success' : 'error',
              text: det.isValid
                ? `БЛОКЧЕЙН: ${det.networkName}
Тип адреса: ${det.addressType}
Оценка риска: ${det.riskAssessment}
${liveBal}
Обозреватель: ${det.explorerUrl}`
                : `Некорректный или неопознанный адрес.`,
            },
          ]);
          return;
        }
        break;

      case 'hash':
        if (!arg) {
          newLogs.push({ id: `${Date.now()}-err`, type: 'error', text: 'Ошибка: укажите текст. Пример: hash SecretPassword123' });
        } else {
          const hashes = await calculateCryptoHashes(arg);
          newLogs.push({
            id: `${Date.now()}-res`,
            type: 'success',
            text: `КРИПТОГРАФИЧЕСКИЕ ХЭШИ:
MD5:    ${hashes.md5}
SHA1:   ${hashes.sha1}
SHA256: ${hashes.sha256}
SHA512: ${hashes.sha512}`,
          });
        }
        break;

      case 'b64enc':
        if (!arg) {
          newLogs.push({ id: `${Date.now()}-err`, type: 'error', text: 'Ошибка: укажите строку для кодирования' });
        } else {
          try {
            const enc = btoa(unescape(encodeURIComponent(arg)));
            newLogs.push({ id: `${Date.now()}-res`, type: 'success', text: `BASE64: ${enc}` });
          } catch {
            newLogs.push({ id: `${Date.now()}-err`, type: 'error', text: 'Ошибка кодирования' });
          }
        }
        break;

      case 'b64dec':
        if (!arg) {
          newLogs.push({ id: `${Date.now()}-err`, type: 'error', text: 'Ошибка: укажите base64 строку для декодирования' });
        } else {
          try {
            const dec = decodeURIComponent(escape(atob(arg)));
            newLogs.push({ id: `${Date.now()}-res`, type: 'success', text: `DECODED: ${dec}` });
          } catch {
            newLogs.push({ id: `${Date.now()}-err`, type: 'error', text: 'Некорректная Base64 строка' });
          }
        }
        break;

      case 'dossier':
        if (!currentDossier) {
          newLogs.push({ id: `${Date.now()}-err`, type: 'error', text: 'Нет активного досье. Выполните scan <ФИО>' });
        } else {
          newLogs.push({
            id: `${Date.now()}-succ`,
            type: 'success',
            text: `АКТИВНОЕ ДОСЬЕ [${currentDossier.id}]:
ФИО: ${currentDossier.fio.full}
Д.Р.: ${currentDossier.birthDate} (${currentDossier.age} лет) • ${currentDossier.birthPlace}
Тотем: ${currentDossier.totemTitle}
Угроза: ${currentDossier.threatLevel} (Оценка риска: ${currentDossier.riskScore}%)
Телефон: ${currentDossier.telecom[0]?.number || 'Н/Д'} (${currentDossier.telecom[0]?.operator || ''})
ИНН: ${currentDossier.finances.taxId} | СНИЛС: ${currentDossier.finances.snils}
Транспорт: ${currentDossier.assets.vehicles.map((v) => `${v.brandModel} [${v.plate}]`).join(', ') || 'Нет'}
Компании: ${currentDossier.finances.companies.map((c) => `${c.name} (${c.role})`).join(', ') || 'Нет'}`,
          });
        }
        break;

      case 'scan':
        if (!arg) {
          newLogs.push({ id: `${Date.now()}-err`, type: 'error', text: 'Ошибка: укажите ФИО. Пример: scan Соколов Михаил Андреевич' });
        } else {
          newLogs.push({ id: `${Date.now()}-succ`, type: 'success', text: `[!] Формирование проверенного досье для "${arg}"...` });
          setTimeout(() => onRunScan(arg), 400);
        }
        break;

      case 'export':
        if (!currentDossier) {
          newLogs.push({ id: `${Date.now()}-err`, type: 'error', text: 'Нет активного досье для экспорта.' });
        } else {
          newLogs.push({ id: `${Date.now()}-succ`, type: 'success', text: '[~] Генерация официального PDF досье...' });
          exportDossierPDF(currentDossier);
        }
        break;

      case 'clear':
        setLogs([]);
        return;

      default:
        newLogs.push({
          id: `${Date.now()}-err`,
          type: 'error',
          text: `Неизвестная команда "${root}". Введите "help" для списка доступных команд.`,
        });
        break;
    }

    setLogs(newLogs);
  };

  return (
    <div className="flex flex-col h-[520px] rounded-[20px] bg-black/85 border border-hair overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,.28)] font-mono text-xs">
      {/* Top CLI Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-panel/90 border-b border-hair">
        <div className="flex items-center space-x-2">
          <Terminal className="w-3.5 h-3.5 text-clay" />
          <span className="text-[11px] font-bold text-white tracking-wider">
            TOMAHAWK CYBER TERMINAL
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setLogs([])}
            className="p-1 hover:bg-white/10 rounded text-muted hover:text-white transition-colors"
            title="Очистить"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Logs Area */}
      <div className="flex-1 p-3 overflow-y-auto space-y-2 no-scrollbar">
        {logs.map((log) => (
          <div
            key={log.id}
            className={`whitespace-pre-wrap leading-relaxed ${
              log.type === 'input'
                ? 'text-gold font-bold'
                : log.type === 'error'
                ? 'text-clay font-medium'
                : log.type === 'success'
                ? 'text-sage'
                : log.type === 'warn'
                ? 'text-amber-400'
                : 'text-ink'
            }`}
          >
            {log.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Command Input Row */}
      <form
        onSubmit={handleCommand}
        className="flex items-center px-3 py-2.5 bg-panel border-t border-hair space-x-2"
      >
        <span className="text-clay font-bold">&gt;</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Введите команду (например: ip 8.8.8.8, inn 770408192039, help)..."
          className="flex-1 bg-transparent text-white placeholder-muted focus:outline-none text-xs font-mono"
        />
        <button
          type="submit"
          className="p-1.5 bg-clay hover:bg-clay/80 text-white rounded-lg transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
