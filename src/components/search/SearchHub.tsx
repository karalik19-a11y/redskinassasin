import React, { useState } from 'react';
import { User, Phone, Shield, Car, Camera, Sparkles, Filter, ChevronRight } from 'lucide-react';
import type { SearchQuery, Dossier } from '../../types/dossier';
import { PresetSelector } from './PresetSelector';
import { BiometricFaceScanner } from './BiometricFaceScanner';
import { sound } from '../../utils/sound';

interface SearchHubProps {
  onSearch: (query: SearchQuery) => void;
  onSelectPreset: (dossier: Dossier) => void;
}

type VectorTab = 'fio' | 'phone' | 'docs' | 'auto' | 'face';

export const SearchHub: React.FC<SearchHubProps> = ({ onSearch, onSelectPreset }) => {
  const [activeVector, setActiveVector] = useState<VectorTab>('fio');

  // Input states
  const [fio, setFio] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [telegram, setTelegram] = useState('');
  const [email, setEmail] = useState('');
  const [passport, setPassport] = useState('');
  const [inn, setInn] = useState('');
  const [snils, setSnils] = useState('');
  const [carPlate, setCarPlate] = useState('');

  // Options
  const [depth, setDepth] = useState<'FAST' | 'DEEP_TOTEM' | 'DARKNET_FULL'>('DEEP_TOTEM');
  const [includeBreaches, setIncludeBreaches] = useState(true);
  const [includeCrypto, setIncludeCrypto] = useState(true);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    sound.playHapticTap();

    const query: SearchQuery = {
      fio: fio.trim() || undefined,
      birthDate: birthDate.trim() || undefined,
      phone: phone.trim() || undefined,
      telegram: telegram.trim() || undefined,
      email: email.trim() || undefined,
      passport: passport.trim() || undefined,
      inn: inn.trim() || undefined,
      snils: snils.trim() || undefined,
      carPlate: carPlate.trim() || undefined,
      depth,
    };

    onSearch(query);
  };

  const handleFaceMatch = (matchedName: string) => {
    setFio(matchedName);
    onSearch({
      fio: matchedName,
      depth: 'DEEP_TOTEM',
    });
  };

  return (
    <div className="w-full space-y-4 pb-20">
      {/* Native American Shamanic Cyber Banner */}
      <div className="relative overflow-hidden rounded-3xl ios-glass-card p-4 border border-red-500/30">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,1)] animate-ping" />
            <span className="text-[10px] font-mono tracking-widest text-amber-400 font-bold uppercase">
              TOMAHAWK OSINT // CYBER-SHAMAN ENGINE
            </span>
          </div>
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-mono">
            4.8 МЛРД ЗАПИСЕЙ
          </span>
        </div>

        <h1 className="text-xl font-black text-white tracking-tight totem-glow">
          ПОИСК & ПОЛНОЕ ДОСЬЕ
        </h1>
        <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
          Введи ФИО, дату рождения или цифровой след для глубокой деанонимизации и генерации тотемного профиля.
        </p>
      </div>

      {/* Vector Selector Segmented Bar */}
      <div className="grid grid-cols-5 gap-1 p-1 bg-black/60 rounded-2xl border border-white/10 backdrop-blur-md">
        {[
          { id: 'fio', label: 'ФИО', icon: User },
          { id: 'phone', label: 'Тел/TG', icon: Phone },
          { id: 'docs', label: 'Паспорт', icon: Shield },
          { id: 'auto', label: 'Авто', icon: Car },
          { id: 'face', label: 'Face ID', icon: Camera },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeVector === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                sound.playHapticTap();
                setActiveVector(tab.id as VectorTab);
              }}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all ${
                isActive
                  ? 'bg-gradient-to-b from-red-600 to-amber-700 text-white shadow-[0_0_12px_rgba(239,68,68,0.5)] font-bold'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5 font-medium'
              }`}
            >
              <Icon className="w-4 h-4 mb-1" />
              <span className="text-[10px] tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Search Inputs by Vector */}
      <form onSubmit={handleSubmit} className="space-y-3">
        {activeVector === 'fio' && (
          <div className="ios-glass p-3.5 rounded-2xl border border-white/10 space-y-3">
            <div>
              <label className="block text-[10px] font-mono font-bold text-neutral-400 uppercase mb-1">
                Фамилия Имя Отчество (ФИО) *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={fio}
                  onChange={(e) => setFio(e.target.value)}
                  placeholder="Например: Морозов Александр Дмитриевич"
                  className="w-full px-3.5 py-2.5 bg-neutral-950/80 border border-red-500/30 rounded-xl text-white text-xs placeholder:text-neutral-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                />
                <User className="absolute right-3 top-2.5 w-4 h-4 text-neutral-500 pointer-events-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1">
                  Дата рождения (ДД.ММ.ГГГГ)
                </label>
                <input
                  type="text"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  placeholder="14.08.1989"
                  className="w-full px-3 py-2 bg-neutral-950/80 border border-white/10 rounded-xl text-white text-xs placeholder:text-neutral-600 focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1">
                  Регион / Город поиска
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Москва / Все регионы"
                  className="w-full px-3 py-2 bg-neutral-950/80 border border-white/10 rounded-xl text-white text-xs placeholder:text-neutral-600 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>
          </div>
        )}

        {activeVector === 'phone' && (
          <div className="ios-glass p-3.5 rounded-2xl border border-white/10 space-y-3">
            <div>
              <label className="block text-[10px] font-mono font-bold text-neutral-400 uppercase mb-1">
                Номер мобильного телефона
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7 (926) 840-19-22"
                className="w-full px-3.5 py-2.5 bg-neutral-950/80 border border-red-500/30 rounded-xl text-white text-xs placeholder:text-neutral-600 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1">
                  Telegram Username / ID
                </label>
                <input
                  type="text"
                  value={telegram}
                  onChange={(e) => setTelegram(e.target.value)}
                  placeholder="@morozov_vc"
                  className="w-full px-3 py-2 bg-neutral-950/80 border border-white/10 rounded-xl text-white text-xs placeholder:text-neutral-600 focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1">
                  Email адрес
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="target@mail.ru"
                  className="w-full px-3 py-2 bg-neutral-950/80 border border-white/10 rounded-xl text-white text-xs placeholder:text-neutral-600 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>
          </div>
        )}

        {activeVector === 'docs' && (
          <div className="ios-glass p-3.5 rounded-2xl border border-white/10 space-y-3">
            <div>
              <label className="block text-[10px] font-mono font-bold text-neutral-400 uppercase mb-1">
                Серия и номер паспорта РФ
              </label>
              <input
                type="text"
                value={passport}
                onChange={(e) => setPassport(e.target.value)}
                placeholder="4512 883921"
                className="w-full px-3.5 py-2.5 bg-neutral-950/80 border border-red-500/30 rounded-xl text-white text-xs placeholder:text-neutral-600 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1">
                  ИНН Физического лица
                </label>
                <input
                  type="text"
                  value={inn}
                  onChange={(e) => setInn(e.target.value)}
                  placeholder="771098451203"
                  className="w-full px-3 py-2 bg-neutral-950/80 border border-white/10 rounded-xl text-white text-xs placeholder:text-neutral-600 focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1">
                  СНИЛС
                </label>
                <input
                  type="text"
                  value={snils}
                  onChange={(e) => setSnils(e.target.value)}
                  placeholder="158-920-441 90"
                  className="w-full px-3 py-2 bg-neutral-950/80 border border-white/10 rounded-xl text-white text-xs placeholder:text-neutral-600 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>
          </div>
        )}

        {activeVector === 'auto' && (
          <div className="ios-glass p-3.5 rounded-2xl border border-white/10 space-y-3">
            <div>
              <label className="block text-[10px] font-mono font-bold text-neutral-400 uppercase mb-1">
                Государственный регистрационный знак (Госномер)
              </label>
              <input
                type="text"
                value={carPlate}
                onChange={(e) => setCarPlate(e.target.value)}
                placeholder="А777МР77 или В001ВВ777"
                className="w-full px-3.5 py-2.5 bg-neutral-950/80 border border-red-500/30 rounded-xl text-white text-xs placeholder:text-neutral-600 focus:outline-none focus:border-red-500"
              />
            </div>
          </div>
        )}

        {activeVector === 'face' && (
          <div className="ios-glass p-3.5 rounded-2xl border border-white/10">
            <BiometricFaceScanner onScanMatch={handleFaceMatch} />
          </div>
        )}

        {/* Scan Depth Settings (Segmented Buttons) */}
        {activeVector !== 'face' && (
          <div className="ios-glass p-3 rounded-2xl border border-white/5 space-y-2">
            <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono">
              <span className="flex items-center space-x-1">
                <Filter className="w-3 h-3 text-red-400" />
                <span>РЕЖИМ СКАНИРОВАНИЯ ТОТЕМА</span>
              </span>
              <span className="text-amber-400">
                {depth === 'FAST' ? 'БЫСТРЫЙ' : depth === 'DEEP_TOTEM' ? 'ГЛУБОКИЙ ТОТЕМ' : 'DARKNET FULL'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'FAST', label: 'Быстрый' },
                { id: 'DEEP_TOTEM', label: 'Тотемный ★' },
                { id: 'DARKNET_FULL', label: 'Darknet' },
              ].map((d) => (
                <button
                  type="button"
                  key={d.id}
                  onClick={() => {
                    sound.playHapticTap();
                    setDepth(d.id as typeof depth);
                  }}
                  className={`py-1.5 text-[10px] font-semibold rounded-xl border transition-all ${
                    depth === d.id
                      ? 'bg-red-600/30 text-amber-300 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]'
                      : 'bg-black/40 text-neutral-400 border-white/5 hover:text-white'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {/* Quick Toggles */}
            <div className="flex items-center justify-between pt-1 text-[11px] text-neutral-300">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeBreaches}
                  onChange={(e) => setIncludeBreaches(e.target.checked)}
                  className="rounded accent-red-600"
                />
                <span>Утечки 2020-2026</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCrypto}
                  onChange={(e) => setIncludeCrypto(e.target.checked)}
                  className="rounded accent-red-600"
                />
                <span>Крипто-кошельки</span>
              </label>
            </div>
          </div>
        )}

        {/* Big Launch Button */}
        {activeVector !== 'face' && (
          <button
            type="submit"
            className="w-full py-3.5 px-4 bg-gradient-to-r from-red-600 via-amber-600 to-red-600 hover:brightness-110 active:scale-[0.98] text-white font-black text-xs tracking-wider uppercase rounded-2xl shadow-[0_0_30px_rgba(239,68,68,0.6)] flex items-center justify-center space-x-2 transition-all border border-amber-400/30"
          >
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>НАЧАТЬ ТОТЕМНЫЙ ШТУРМ OSINT</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </form>

      {/* Preset VIP Targets */}
      <PresetSelector onSelectPreset={onSelectPreset} />
    </div>
  );
};
