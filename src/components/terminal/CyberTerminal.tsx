import React, { useState, useRef, useEffect } from 'react';
import type { Dossier } from '../../types/dossier';
import { Terminal, Send } from 'lucide-react';
import { sound } from '../../utils/sound';
import { exportDossierPDF } from '../../utils/pdfExport';

interface CyberTerminalProps {
  currentDossier: Dossier | null;
  onRunScan: (name: string) => void;
}

interface CommandLog {
  id: string;
  type: 'input' | 'output' | 'error' | 'success';
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
      text: '⚡ TOMAHAWK CYBER-SHAMAN CLI v4.9 [Obsidian Core Initialized]',
    },
    {
      id: '1',
      type: 'output',
      text: 'Введите "help" для списка доступных команд разведки.',
    },
  ]);

  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = input.trim();
    if (!cmd) return;

    sound.playHapticTap();
    const newLogs: CommandLog[] = [...logs, { id: `${Date.now()}-in`, type: 'input', text: `> ${cmd}` }];
    const parts = cmd.split(' ');
    const root = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ');

    switch (root) {
      case 'help':
        newLogs.push({
          id: `${Date.now()}-out`,
          type: 'output',
          text: `ДОСТУПНЫЕ КОМАНДЫ ТОТЕМА:
• scan <ФИО>        — Запустить штурм-поиск досье
• dossier           — Вывести краткую сводку активной цели
• totem             — Тотемный архетип и уровень риска
• graph             — Проанализировать нити графа «Ловец Снов»
• breaches          — Проверить фиксации в утечках Darknet
• decrypt <hash>    — Расшифровать хэш пароля/токена
• eagle             — GPS координаты и маршруты
• export            — Экспортировать официальное PDF досье
• sound on/off      — Управление звуковыми эффектами
• clear             — Очистить консоль`,
        });
        break;

      case 'scan':
        if (!arg) {
          newLogs.push({ id: `${Date.now()}-err`, type: 'error', text: 'Ошибка: укажите ФИО. Пример: scan Морозов Александр Дмитриевич' });
        } else {
          newLogs.push({ id: `${Date.now()}-succ`, type: 'success', text: `[!] Запуск протокола сканирования для "${arg}"...` });
          setTimeout(() => onRunScan(arg), 600);
        }
        break;

      case 'dossier':
        if (!currentDossier) {
          newLogs.push({ id: `${Date.now()}-err`, type: 'error', text: 'Нет загруженного досье. Выполните scan <ФИО>' });
        } else {
          newLogs.push({
            id: `${Date.now()}-succ`,
            type: 'success',
            text: `ОБЪЕКТ: ${currentDossier.fio.full}
Д.Р.: ${currentDossier.birthDate} (${currentDossier.age} лет)
ТОТЕМ: ${currentDossier.totemTitle}
УГРОЗА: ${currentDossier.threatLevel} (Риск: ${currentDossier.riskScore}%)
ТЕЛЕФОН: ${currentDossier.telecom[0]?.number || 'Н/Д'}
СНИЛС: ${currentDossier.finances.snils}
ИНН: ${currentDossier.finances.taxId}`,
          });
        }
        break;

      case 'totem':
        if (!currentDossier) {
          newLogs.push({ id: `${Date.now()}-err`, type: 'error', text: 'Сначала выберите цель.' });
        } else {
          sound.playTotemResonance();
          newLogs.push({
            id: `${Date.now()}-succ`,
            type: 'success',
            text: `[ТОТЕМНЫЙ ДУХ] ${currentDossier.totemTitle.toUpperCase()}
Архетип: ${currentDossier.totemAnimal}
Биометрическое согласие: ${currentDossier.biometricMatchRate}%
Степень скрытности: ${100 - currentDossier.riskScore}/100`,
          });
        }
        break;

      case 'breaches':
        if (!currentDossier) {
          newLogs.push({ id: `${Date.now()}-err`, type: 'error', text: 'Сначала выполните поиск.' });
        } else {
          const leakList = currentDossier.breaches.map((b) => `• [${b.severity}] ${b.source} (${b.date})`).join('\n');
          newLogs.push({ id: `${Date.now()}-out`, type: 'output', text: `НАЙДЕННЫЕ УТЕЧКИ:\n${leakList}` });
        }
        break;

      case 'decrypt':
        sound.playRadarPing();
        newLogs.push({
          id: `${Date.now()}-succ`,
          type: 'success',
          text: `[✓] ХЭШ РАСШИФРОВАН: "${arg || '$2a$12$e8Kz1V4n9Lm...'}" -> "M0rozov_Capital#2024!" (Rainbow Tables v6)`,
        });
        break;

      case 'eagle':
        if (!currentDossier) {
          newLogs.push({ id: `${Date.now()}-err`, type: 'error', text: 'Нет геоданных.' });
        } else {
          const geoList = currentDossier.geoHistory.map((g) => `• ${g.date} ${g.time} | ${g.locationName} [${g.source}]`).join('\n');
          newLogs.push({ id: `${Date.now()}-out`, type: 'output', text: `ГЕО-МАРШРУТЫ «ОРЛИНЫЙ ГЛАЗ»:\n${geoList}` });
        }
        break;

      case 'export':
        if (!currentDossier) {
          newLogs.push({ id: `${Date.now()}-err`, type: 'error', text: 'Нет активного досье для экспорта.' });
        } else {
          exportDossierPDF(currentDossier);
          newLogs.push({ id: `${Date.now()}-succ`, type: 'success', text: '[✓] Официальное PDF досье успешно сгенерировано и сохранено.' });
        }
        break;

      case 'sound':
        if (arg === 'on') {
          sound.setEnabled(true);
          newLogs.push({ id: `${Date.now()}-succ`, type: 'success', text: 'Звуковые эффекты ВКЛЮЧЕНЫ.' });
        } else if (arg === 'off') {
          sound.setEnabled(false);
          newLogs.push({ id: `${Date.now()}-out`, type: 'output', text: 'Звуковые эффекты ВЫКЛЮЧЕНЫ.' });
        } else {
          newLogs.push({ id: `${Date.now()}-out`, type: 'output', text: `Текущий статус звука: ${sound.isEnabled() ? 'ВКЛ' : 'ВЫКЛ'}` });
        }
        break;

      case 'clear':
        setLogs([]);
        setInput('');
        return;

      default:
        newLogs.push({
          id: `${Date.now()}-err`,
          type: 'error',
          text: `Неизвестная команда: "${cmd}". Введите "help" для справки.`,
        });
        break;
    }

    setLogs(newLogs);
    setInput('');
  };

  return (
    <div className="space-y-3 pb-20 select-none">
      {/* Terminal Window Frame */}
      <div className="ios-glass p-3 rounded-[16px] border border-hair font-mono text-xs shadow-2xl flex flex-col h-[520px]">
        {/* Terminal Header */}
        <div className="flex items-center justify-between border-b border-hair pb-2 mb-2">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-clay" />
            <span className="font-bold text-white text-[11px] tracking-wide">
              REDSKIN_CLI // ROOT@SHAMAN-CORE
            </span>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-clay/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-gold-soft" />
            <span className="w-2.5 h-2.5 rounded-full bg-sage-soft" />
          </div>
        </div>

        {/* Log Output Area */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 no-scrollbar text-[11px] leading-relaxed">
          {logs.map((log) => (
            <div
              key={log.id}
              className={`whitespace-pre-wrap break-words ${
                log.type === 'input'
                  ? 'text-gold font-bold'
                  : log.type === 'error'
                  ? 'text-clay font-semibold'
                  : log.type === 'success'
                  ? 'text-sage font-semibold'
                  : 'text-ink'
              }`}
            >
              {log.text}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {/* Input prompt */}
        <form onSubmit={handleCommand} className="mt-2 pt-2 border-t border-hair flex items-center space-x-2">
          <span className="text-clay font-bold">&gt;</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="help, scan, dossier, decrypt..."
            className="flex-1 bg-panel border border-hair rounded-xl px-3 py-2 text-white text-xs placeholder:text-faint focus:outline-none focus:border-hair font-mono"
          />
          <button
            type="submit"
            className="p-2 bg-clay hover:bg-clay text-white rounded-xl transition-colors shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
