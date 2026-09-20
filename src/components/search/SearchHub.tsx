import React, { useState, useEffect } from 'react';
import {
  User,
  Phone,
  Shield,
  Car,
  Camera,
  Globe,
  AtSign,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Search,
  ArrowRight,
  Database,
  Building,
  Fingerprint,
  Sparkles,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import type { SearchQuery, Dossier } from '../../types/dossier';
import type { InvestigationReport } from '../../osint/types/report';
import { BiometricFaceScanner } from './BiometricFaceScanner';
import { sound } from '../../utils/sound';
import {
  validateINN,
  validateSNILS,
  validateOGRN,
  validatePassportRF,
  parseRussianPlate,
  decodeVIN,
  validateBIK,
  type ValidationResult,
} from '../../utils/osint/russianValidators';
import { analyzePhoneNumber, type PhoneIntelligence } from '../../utils/osint/telecomIntelligence';
import {
  lookupIpIntelligence,
  queryDnsRecords,
  analyzeEmail,
  calculateCryptoHashes,
  type IpIntelligence,
  type DnsRecord,
  type EmailIntelligence,
} from '../../utils/osint/networkIntelligence';
import { detectCryptoAddress, fetchLiveCryptoBalance, type CryptoValidationResult } from '../../utils/osint/cryptoIntelligence';
import { huntUsernameFootprint, type SocialPlatformResult } from '../../utils/osint/socialHunter';
import { OFFICIAL_REGISTRIES_DATABASE } from '../../utils/osint/registryLinks';
import { loadAllCases, setActiveCaseId } from '../../utils/caseStorage';

interface SearchHubProps {
  onSearch: (query: SearchQuery) => void | Promise<void>;
  onSelectPreset: (dossier: Dossier) => void;
  onFreeTextSearch?: (input: string, profile?: string) => void | Promise<void>;
  liveProgress?: string;
  investigationError?: string | null;
  liveReport?: InvestigationReport | null;
}

type VectorTab = 'fio' | 'phone' | 'docs' | 'auto' | 'net' | 'user' | 'face';

export const SearchHub: React.FC<SearchHubProps> = ({ onSearch, onSelectPreset, onFreeTextSearch, liveProgress, investigationError, liveReport }) => {
  const [activeVector, setActiveVector] = useState<VectorTab>('fio');

  // Unified free-text search (engine)
  const [unifiedInput, setUnifiedInput] = useState('Соколов Михаил Андреевич, +7 916 402-91-88, 7707083893, sberbank.ru');
  const [unifiedProfile, setUnifiedProfile] = useState<string>('full-spectrum');

  // Vector 1: FIO State
  const [fio, setFio] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [regionFilter, setRegionFilter] = useState('');

  // Vector 2: Phone State
  const [phoneInput, setPhoneInput] = useState('+7 (916) 402-91-88');
  const [phoneAnalysis, setPhoneAnalysis] = useState<PhoneIntelligence | null>(null);

  // Vector 3: Docs State
  const [docType, setDocType] = useState<'inn' | 'snils' | 'passport' | 'ogrn' | 'bik'>('inn');
  const [docInput, setDocInput] = useState('7707083893');
  const [docValidation, setDocValidation] = useState<ValidationResult | null>(null);

  // Vector 4: Auto State
  const [autoType, setAutoType] = useState<'plate' | 'vin'>('plate');
  const [autoInput, setAutoInput] = useState('А 777 ОС 777');
  const [autoValidation, setAutoValidation] = useState<ValidationResult | null>(null);

  // Vector 5: Network / IP / DNS / Crypto State
  const [netTab, setNetTab] = useState<'ip' | 'dns' | 'email' | 'crypto' | 'hash'>('ip');
  const [ipInput, setIpInput] = useState('8.8.8.8');
  const [ipResult, setIpResult] = useState<IpIntelligence | null>(null);
  const [isIpLoading, setIsIpLoading] = useState(false);

  const [dnsDomain, setDnsDomain] = useState('sberbank.ru');
  const [dnsType, setDnsType] = useState<'A' | 'MX' | 'TXT' | 'NS'>('MX');
  const [dnsResults, setDnsResults] = useState<DnsRecord[]>([]);
  const [isDnsLoading, setIsDnsLoading] = useState(false);

  const [emailInput, setEmailInput] = useState('m.sokolov.sec@proton.me');
  const [emailResult, setEmailResult] = useState<EmailIntelligence | null>(null);
  const [isEmailLoading, setIsEmailLoading] = useState(false);

  const [cryptoInput, setCryptoInput] = useState('bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh');
  const [cryptoResult, setCryptoResult] = useState<CryptoValidationResult | null>(null);

  const [hashInput, setHashInput] = useState('Investigator_Secret_2026');
  const [hashResults, setHashResults] = useState<{ md5: string; sha1: string; sha256: string; sha512: string } | null>(null);

  // Vector 6: Username State
  const [usernameInput, setUsernameInput] = useState('m_sokolov');
  const [socialResults, setSocialResults] = useState<SocialPlatformResult[]>([]);

  // Stored Cases list for quick switching
  const [savedCases, setSavedCases] = useState<Dossier[]>([]);

  useEffect(() => {
    setSavedCases(loadAllCases());
  }, []);

  // Update phone analysis on input change
  useEffect(() => {
    if (phoneInput.trim()) {
      setPhoneAnalysis(analyzePhoneNumber(phoneInput));
    } else {
      setPhoneAnalysis(null);
    }
  }, [phoneInput]);

  // Update doc validation
  useEffect(() => {
    if (!docInput.trim()) {
      setDocValidation(null);
      return;
    }
    if (docType === 'inn') setDocValidation(validateINN(docInput));
    else if (docType === 'snils') setDocValidation(validateSNILS(docInput));
    else if (docType === 'passport') setDocValidation(validatePassportRF(docInput));
    else if (docType === 'ogrn') setDocValidation(validateOGRN(docInput));
    else if (docType === 'bik') setDocValidation(validateBIK(docInput));
  }, [docInput, docType]);

  // Update auto validation
  useEffect(() => {
    if (!autoInput.trim()) {
      setAutoValidation(null);
      return;
    }
    if (autoType === 'plate') setAutoValidation(parseRussianPlate(autoInput));
    else if (autoType === 'vin') setAutoValidation(decodeVIN(autoInput));
  }, [autoInput, autoType]);

  // Update crypto detection
  useEffect(() => {
    if (cryptoInput.trim()) {
      const detected = detectCryptoAddress(cryptoInput);
      setCryptoResult(detected);
    } else {
      setCryptoResult(null);
    }
  }, [cryptoInput]);

  // Update username hunt
  useEffect(() => {
    if (usernameInput.trim()) {
      setSocialResults(huntUsernameFootprint(usernameInput));
    } else {
      setSocialResults([]);
    }
  }, [usernameInput]);

  // IP Geolocation Handler
  const handleLookupIp = async () => {
    if (!ipInput.trim()) return;
    sound.playRadarPing();
    setIsIpLoading(true);
    try {
      const res = await lookupIpIntelligence(ipInput);
      setIpResult(res);
      sound.playSuccessChime();
    } catch (err) {
      console.error(err);
    } finally {
      setIsIpLoading(false);
    }
  };

  // DNS Query Handler
  const handleQueryDns = async () => {
    if (!dnsDomain.trim()) return;
    sound.playRadarPing();
    setIsDnsLoading(true);
    try {
      const records = await queryDnsRecords(dnsDomain, dnsType);
      setDnsResults(records);
      sound.playSuccessChime();
    } catch (err) {
      console.error(err);
    } finally {
      setIsDnsLoading(false);
    }
  };

  // Email Analyze Handler
  const handleAnalyzeEmail = async () => {
    if (!emailInput.trim()) return;
    sound.playRadarPing();
    setIsEmailLoading(true);
    try {
      const res = await analyzeEmail(emailInput);
      setEmailResult(res);
      sound.playSuccessChime();
    } catch (err) {
      console.error(err);
    } finally {
      setIsEmailLoading(false);
    }
  };

  // Crypto Live Balance Handler
  const handleCheckCryptoBalance = async () => {
    if (!cryptoResult || !cryptoResult.isValid) return;
    sound.playRadarPing();
    const live = await fetchLiveCryptoBalance(cryptoResult.address, cryptoResult.network);
    setCryptoResult((prev) => (prev ? { ...prev, balance: live.balance, txCount: live.txCount } : null));
    sound.playSuccessChime();
  };

  // Calculate Hashes Handler
  const handleCalculateHashes = async () => {
    if (!hashInput.trim()) return;
    sound.playHapticTap();
    const hashes = await calculateCryptoHashes(hashInput);
    setHashResults(hashes);
    sound.playSuccessChime();
  };

  // Unified engine search — главный путь для реальных данных
  const handleUnifiedSearch = () => {
    sound.playSuccessChime();
    if (onFreeTextSearch) {
      void onFreeTextSearch(unifiedInput, unifiedProfile);
    } else {
      void onSearch({ fio: unifiedInput, depth: unifiedProfile === 'person-fast' ? 'FAST' : unifiedProfile === 'person-deep' ? 'DARKNET_FULL' : 'DEEP_TOTEM' });
    }
  };

  // Legacy quick dossier creation — теперь тоже через движок
  const handleCreateDossier = () => {
    sound.playSuccessChime();
    const aggregated = [
      fio.trim(),
      birthDate.trim(),
      phoneInput.trim(),
      docType === 'inn' ? docInput : '',
      docType === 'snils' ? docInput : '',
      docType === 'passport' ? docInput : '',
      autoInput.trim(),
      emailInput.trim(),
      usernameInput.trim(),
    ]
      .filter(Boolean)
      .join(', ');
    if (onFreeTextSearch && aggregated) {
      void onFreeTextSearch(aggregated, 'full-spectrum');
      return;
    }
    void onSearch({
      fio: fio.trim() || undefined,
      birthDate: birthDate.trim() || undefined,
      phone: phoneInput.trim() || undefined,
      inn: docType === 'inn' ? docInput : undefined,
      snils: docType === 'snils' ? docInput : undefined,
      passport: docType === 'passport' ? docInput : undefined,
      carPlate: autoType === 'plate' ? autoInput : undefined,
      email: emailInput.trim() || undefined,
      telegram: usernameInput.trim() || undefined,
      depth: 'DEEP_TOTEM',
    });
  };

  return (
    <div className="w-full space-y-4 pb-20 select-none">
      {/* Real OSINT Top Banner */}
      <div className="relative overflow-hidden rounded-[20px] ios-glass-card p-4 border border-hair">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-clay animate-pulse-totem" />
            <span className="text-[10px] font-mono tracking-widest text-gold font-bold uppercase">
              TOMAHAWK OSINT // CYBER-INTELLIGENCE SUITE
            </span>
          </div>
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-sage-soft text-sage font-mono border border-hair">
            LIVE ENGINE
          </span>
        </div>

        <h1 className="text-xl font-semibold text-white tracking-tight ">
          РАЗВЕДКА & ПРОВЕРКА ДАННЫХ
        </h1>
        <p className="text-xs text-ink mt-1 leading-relaxed">
          Живой движок работает с реальными источниками: чек-суммы ФНС/ПФР/ГИБДД, DoH, RDAP, CT-логи, ASN, блокчейн-RPC и кросс-проверка 24 площадок. Без фейковых генераторов.
        </p>
      </div>

      {/* UNIFIED LIVE SEARCH — главный вход для реальных людей */}
      <div className="ios-glass p-4 rounded-[20px] border border-emerald-500/20 space-y-3 shadow-[0_10px_30px_rgba(16,185,129,.08)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-bold text-white uppercase tracking-tight">
            <Zap className="w-4 h-4 text-emerald-400" />
            <span>Единый живой поиск</span>
          </div>
          <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
            РЕАЛЬНЫЕ ДАННЫЕ
          </span>
        </div>

        <div>
          <label className="text-[10px] font-mono text-muted uppercase">Вставьте всё, что есть — телефон, ИНН, ФИО, домен, e-mail, ГРЗ, VIN, криптокошелёк (через запятую)</label>
          <textarea
            value={unifiedInput}
            onChange={(e) => setUnifiedInput(e.target.value)}
            rows={3}
            placeholder="Например: +7 916 402-91-88, Соколов Михаил Андреевич 14.08.1988, 7707083893, sberbank.ru, bc1qxy2k..."
            className="w-full mt-1 px-3.5 py-2.5 bg-panel border border-hair rounded-xl text-xs text-white placeholder-muted focus:outline-none focus:border-emerald-500/40 resize-none"
          />
          <div className="text-[10px] text-muted/70 mt-1">
            Подсказки: <span className="text-ink">+7 9XX XXX-XX-XX</span> • <span className="text-ink">ИНН 10/12 цифр</span> • <span className="text-ink">СНИЛС 148-291-049 88</span> • <span className="text-ink">ОГРН 13 цифр</span> • <span className="text-ink">А 777 ОС 777</span> • <span className="text-ink">WP0AA2Y… (17 VIN)</span> • <span className="text-ink">0x… / bc1… / T…</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <select
            value={unifiedProfile}
            onChange={(e) => setUnifiedProfile(e.target.value)}
            className="px-3 py-2.5 bg-panel border border-hair rounded-xl text-xs font-mono text-white"
          >
            <option value="full-spectrum">Полный спектр (рекомендуется)</option>
            <option value="person-fast">Персона — быстро (25с)</option>
            <option value="person-deep">Персона — глубоко (2 мин)</option>
            <option value="infrastructure-recon">Инфраструктура</option>
            <option value="crypto-investigation">Крипто-расследование</option>
          </select>
          <button
            onClick={handleUnifiedSearch}
            className="py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white text-xs font-bold rounded-xl shadow-[0_10px_30px_rgba(0,0,0,.28)] flex items-center justify-center space-x-1.5 transition-all"
          >
            <Search className="w-4 h-4 text-white" />
            <span>Запустить живую разведку</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Нажми: телефон', val: '+7 916 402-91-88, Соколов Михаил Андреевич' },
            { label: 'Нажми: домен', val: 'sberbank.ru' },
            { label: 'Нажми: ИНН', val: '7707083893' },
          ].map((ex) => (
            <button
              key={ex.val}
              onClick={() => setUnifiedInput(ex.val)}
              className="py-1.5 px-2 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-mono text-ink border border-hair"
            >
              {ex.label}
            </button>
          ))}
        </div>

        {liveProgress && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2 flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-[11px] font-mono text-emerald-200 truncate">{liveProgress}</span>
          </div>
        )}
        {investigationError && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span className="text-[11px] text-amber-100 leading-snug">{investigationError}</span>
          </div>
        )}
        {liveReport && (
          <div className="bg-panel border border-hair rounded-xl p-2.5 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-white">{liveReport.narrative.headline}</div>
              <div className="text-[10px] font-mono text-muted">
                {liveReport.entities.length} сущностей • {liveReport.evidence.length} наблюдений • риск {liveReport.risk.score}/100
              </div>
            </div>
            <span className="text-[9px] font-mono px-2 py-1 rounded-full bg-sage-soft text-sage border border-hair">LIVE</span>
          </div>
        )}
        <div className="text-[10px] text-muted leading-relaxed bg-panel/50 p-2 rounded-lg border border-hair">
          <span className="text-gold font-bold">Как это работает с реальными людьми:</span> вставьте номер телефона, ИНН или домен и нажмите «Запустить». Движок проверит чек-суммы по формулам ФНС/ПФР/ГИБДД, опросит живые API (DoH Cloudflare, RDAP, crt.sh, Blockscout/mempool, соцсети) и покажет только подтверждённые наблюдения с указанием источника и `via`. Если источник недоступен — это честно фиксируется в оговорках, а не выдумывается.
        </div>
      </div>

      {/* Vector Navigation Segmented Bar */}
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-1 p-1 bg-panel rounded-[16px] border border-hair backdrop-blur-md text-[11px] font-semibold">
        {[
          { id: 'fio', label: 'Личность', icon: User },
          { id: 'phone', label: 'Телеком', icon: Phone },
          { id: 'docs', label: 'Документы', icon: Shield },
          { id: 'auto', label: 'Авто / ТС', icon: Car },
          { id: 'net', label: 'Сеть & IP', icon: Globe },
          { id: 'user', label: 'Никнейм', icon: AtSign },
          { id: 'face', label: 'Фото / EXIF', icon: Camera },
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
                  ? 'bg-gradient-to-r from-[#c2664f] to-[#a8834c] text-white shadow-[0_10px_30px_rgba(0,0,0,.28)] border border-hair font-bold'
                  : 'text-muted hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4 mb-1" />
              <span className="text-[10px] tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* VECTOR 1: FIO & BIRTHDATE */}
      {activeVector === 'fio' && (
        <div className="space-y-3.5">
          <div className="ios-glass p-4 rounded-[20px] border border-hair space-y-3">
            <div className="text-xs font-bold text-white uppercase tracking-tight flex items-center space-x-2">
              <User className="w-4 h-4 text-clay" />
              <span>Поиск по ФИО и официальным реестрам РФ</span>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-[10px] font-mono text-muted uppercase">Фамилия Имя Отчество</label>
                <input
                  type="text"
                  value={fio}
                  onChange={(e) => setFio(e.target.value)}
                  placeholder="Например: Соколов Михаил Андреевич"
                  className="w-full mt-1 px-3.5 py-2.5 bg-panel border border-hair rounded-xl text-xs text-white placeholder-muted focus:outline-none focus:border-clay"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-mono text-muted uppercase">Дата рождения</label>
                  <input
                    type="text"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    placeholder="ДД.ММ.ГГГГ (14.08.1988)"
                    className="w-full mt-1 px-3.5 py-2.5 bg-panel border border-hair rounded-xl text-xs text-white placeholder-muted focus:outline-none focus:border-clay"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-muted uppercase">Регион поиска</label>
                  <input
                    type="text"
                    value={regionFilter}
                    onChange={(e) => setRegionFilter(e.target.value)}
                    placeholder="77 (Москва) или РФ"
                    className="w-full mt-1 px-3.5 py-2.5 bg-panel border border-hair rounded-xl text-xs text-white placeholder-muted focus:outline-none focus:border-clay"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                onClick={handleCreateDossier}
                className="py-2.5 px-3 bg-gradient-to-r from-[#c2664f] to-[#a8834c] hover:brightness-110 text-white text-xs font-bold rounded-xl shadow-[0_10px_30px_rgba(0,0,0,.28)] flex items-center justify-center space-x-1.5 transition-all"
              >
                <Fingerprint className="w-4 h-4 text-gold" />
                <span>Сформировать досье объекта</span>
              </button>

              <button
                onClick={() => {
                  sound.playHapticTap();
                  void onSearch({ fio: fio.trim() || undefined, birthDate: birthDate.trim() || undefined, depth: 'DEEP_TOTEM' });
                }}
                className="py-2.5 px-3 ios-glass hover:bg-white/10 text-white text-xs font-semibold rounded-xl border border-hair flex items-center justify-center space-x-1.5 transition-all"
              >
                <Sparkles className="w-4 h-4 text-gold" />
                <span>Живая разведка</span>
              </button>
            </div>
          </div>

          <div className="ios-glass p-3.5 rounded-[16px] border border-hair space-y-2">
            <div className="text-[11px] font-bold text-white uppercase tracking-tight flex items-center space-x-2">
              <Building className="w-3.5 h-3.5 text-gold" />
              <span>Прямой поиск в государственных базах данных РФ</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {OFFICIAL_REGISTRIES_DATABASE.slice(0, 6).map((reg) => (
                <a
                  key={reg.id}
                  href={reg.buildQueryUrl ? reg.buildQueryUrl({ fio, birthDate }) : reg.officialUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2.5 bg-panel hover:bg-white/10 rounded-xl border border-hair flex items-center justify-between group transition-all"
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-bold text-white group-hover:text-gold transition-colors truncate">
                      {reg.name}
                    </div>
                    <div className="text-[10px] text-muted truncate">{reg.authority}</div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-muted group-hover:text-gold shrink-0" />
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VECTOR 2: TELECOM & PHONE INTELLIGENCE */}
      {activeVector === 'phone' && (
        <div className="space-y-3.5">
          <div className="ios-glass p-4 rounded-[20px] border border-hair space-y-3">
            <div className="text-xs font-bold text-white uppercase tracking-tight flex items-center space-x-2">
              <Phone className="w-4 h-4 text-clay" />
              <span>Телеком-маршрутизация DEF кодов & Мессенджеры</span>
            </div>

            <div>
              <label className="text-[10px] font-mono text-muted uppercase">Номер телефона (РФ / СНГ / Мир)</label>
              <input
                type="text"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="+7 (9XX) XXX-XX-XX или 89..."
                className="w-full mt-1 px-3.5 py-2.5 bg-panel border border-hair rounded-xl text-xs font-mono text-white placeholder-muted focus:outline-none focus:border-clay"
              />
            </div>

            {phoneAnalysis && (
              <div className="bg-panel p-3 rounded-xl border border-hair space-y-2">
                <div className="flex items-center justify-between border-b border-hair pb-2">
                  <span className="text-xs font-mono font-bold text-white">
                    {phoneAnalysis.nationalFormatted}
                  </span>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-clay/20 text-clay border border-hair font-bold">
                    {phoneAnalysis.operatorCategory}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <div className="text-[9px] text-muted">Оператор связи</div>
                    <div className="font-semibold text-white truncate">{phoneAnalysis.operator}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-muted">Регион привязки</div>
                    <div className="font-semibold text-white truncate">{phoneAnalysis.region}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-muted">Формат E.164</div>
                    <div className="font-mono text-gold">{phoneAnalysis.e164 || 'Н/Д'}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-muted">Часовой пояс</div>
                    <div className="font-mono text-white">{phoneAnalysis.timeZone}</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-hair">
                  <a
                    href={phoneAnalysis.links.telegramUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="py-1.5 px-2 bg-[#229ED9]/20 hover:bg-[#229ED9]/30 border border-[#229ED9]/40 rounded-lg text-[10px] font-semibold text-white flex items-center justify-center space-x-1 transition-all"
                  >
                    <ExternalLink className="w-3 h-3 text-[#229ED9]" />
                    <span>Telegram</span>
                  </a>
                  <a
                    href={phoneAnalysis.links.whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="py-1.5 px-2 bg-[#25D366]/20 hover:bg-[#25D366]/30 border border-[#25D366]/40 rounded-lg text-[10px] font-semibold text-white flex items-center justify-center space-x-1 transition-all"
                  >
                    <ExternalLink className="w-3 h-3 text-[#25D366]" />
                    <span>WhatsApp</span>
                  </a>
                  <a
                    href={phoneAnalysis.links.numbusterUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="py-1.5 px-2 bg-white/5 hover:bg-white/10 border border-hair rounded-lg text-[10px] font-semibold text-ink flex items-center justify-center space-x-1 transition-all"
                  >
                    <ExternalLink className="w-3 h-3 text-gold" />
                    <span>NumBuster</span>
                  </a>
                </div>
              </div>
            )}

            <button
              onClick={() => {
                sound.playHapticTap();
                if (onFreeTextSearch) void onFreeTextSearch(phoneInput, 'full-spectrum');
                else void onSearch({ phone: phoneInput, depth: 'DEEP_TOTEM' });
              }}
              className="w-full py-2.5 px-3 bg-gradient-to-r from-[#c2664f] to-[#a8834c] hover:brightness-110 text-white text-xs font-bold rounded-xl shadow-[0_10px_30px_rgba(0,0,0,.28)] flex items-center justify-center space-x-1.5 transition-all"
            >
              <Zap className="w-4 h-4 text-gold" />
              <span>Живая разведка по номеру (реальные проверки)</span>
            </button>
          </div>
        </div>
      )}

      {/* VECTOR 3: DOCUMENTS & POLYNOMIAL CHECKSUMS */}
      {activeVector === 'docs' && (
        <div className="space-y-3.5">
          <div className="ios-glass p-4 rounded-[20px] border border-hair space-y-3">
            <div className="text-xs font-bold text-white uppercase tracking-tight flex items-center space-x-2">
              <Shield className="w-4 h-4 text-clay" />
              <span>Алгоритмическая валидация контрольных сумм РФ</span>
            </div>

            <div className="grid grid-cols-5 gap-1 p-1 bg-panel rounded-xl border border-hair text-[10px] font-semibold">
              {[
                { id: 'inn', label: 'ИНН' },
                { id: 'snils', label: 'СНИЛС' },
                { id: 'passport', label: 'Паспорт' },
                { id: 'ogrn', label: 'ОГРН' },
                { id: 'bik', label: 'БИК Банка' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    sound.playHapticTap();
                    setDocType(item.id as never);
                    if (item.id === 'inn') setDocInput('7707083893');
                    else if (item.id === 'snils') setDocInput('148-291-049 88');
                    else if (item.id === 'passport') setDocInput('45 12 783921');
                    else if (item.id === 'ogrn') setDocInput('1187746892014');
                    else if (item.id === 'bik') setDocInput('044525974');
                  }}
                  className={`py-1.5 rounded-lg text-center transition-all ${
                    docType === item.id
                      ? 'bg-clay text-white shadow font-bold'
                      : 'text-muted hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div>
              <label className="text-[10px] font-mono text-muted uppercase">Значение документа</label>
              <input
                type="text"
                value={docInput}
                onChange={(e) => setDocInput(e.target.value)}
                placeholder="Введите номер для проверки..."
                className="w-full mt-1 px-3.5 py-2.5 bg-panel border border-hair rounded-xl text-xs font-mono text-white placeholder-muted focus:outline-none focus:border-clay"
              />
            </div>

            {docValidation && (
              <div
                className={`p-3 rounded-xl border space-y-2 ${
                  docValidation.isValid
                    ? 'bg-sage-soft/30 border-sage/40'
                    : 'bg-clay-soft/30 border-clay/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-xs font-bold">
                    {docValidation.isValid ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-sage" />
                        <span className="text-sage">КОНТРОЛЬНАЯ СУММА ВЕРНА</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-clay" />
                        <span className="text-clay">ОШИБКА ВАЛИДАЦИИ</span>
                      </>
                    )}
                  </div>
                  <span className="text-[9px] font-mono text-white/80">{docValidation.type}</span>
                </div>

                {docValidation.error && (
                  <div className="text-[11px] text-clay font-medium">{docValidation.error}</div>
                )}

                {docValidation.details && (
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    {Object.entries(docValidation.details).map(([key, val]) => {
                      if (typeof val === 'string' && val.startsWith('http')) return null;
                      return (
                        <div key={key} className="bg-panel/70 p-2 rounded-lg border border-hair">
                          <div className="text-[9px] text-muted capitalize">{key}</div>
                          <div className="font-semibold text-white truncate">{String(val)}</div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {docValidation.details?.egrulSearchUrl && (
                  <a
                    href={docValidation.details.egrulSearchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-[11px] font-semibold text-white flex items-center justify-center space-x-1 border border-hair transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-gold" />
                    <span>Проверить в реестре ФНС ЕГРЮЛ</span>
                  </a>
                )}
              </div>
            )}

            <button
              onClick={() => {
                if (onFreeTextSearch) void onFreeTextSearch(docInput, 'full-spectrum');
                else void onSearch({ inn: docType === 'inn' ? docInput : undefined, snils: docType === 'snils' ? docInput : undefined, passport: docType === 'passport' ? docInput : undefined, depth: 'DEEP_TOTEM' });
              }}
              className="w-full py-2.5 px-3 bg-gradient-to-r from-[#c2664f] to-[#a8834c] hover:brightness-110 text-white text-xs font-bold rounded-xl shadow-[0_10px_30px_rgba(0,0,0,.28)] flex items-center justify-center space-x-1.5 transition-all"
            >
              <Zap className="w-4 h-4 text-gold" />
              <span>Живая проверка документа + разведка</span>
            </button>
          </div>
        </div>
      )}

      {/* VECTOR 4: AUTO / VEHICLES (PLATES & VIN) */}
      {activeVector === 'auto' && (
        <div className="space-y-3.5">
          <div className="ios-glass p-4 rounded-[20px] border border-hair space-y-3">
            <div className="text-xs font-bold text-white uppercase tracking-tight flex items-center space-x-2">
              <Car className="w-4 h-4 text-clay" />
              <span>Идентификация ТС: Госномер ГРЗ & Декодер VIN</span>
            </div>

            <div className="grid grid-cols-2 gap-1 p-1 bg-panel rounded-xl border border-hair text-[10px] font-semibold">
              <button
                onClick={() => {
                  sound.playHapticTap();
                  setAutoType('plate');
                  setAutoInput('А 777 ОС 777');
                }}
                className={`py-1.5 rounded-lg text-center transition-all ${
                  autoType === 'plate' ? 'bg-clay text-white shadow font-bold' : 'text-muted hover:text-white'
                }`}
              >
                Госномер РФ (ГРЗ)
              </button>
              <button
                onClick={() => {
                  sound.playHapticTap();
                  setAutoType('vin');
                  setAutoInput('WP0AA2Y13MSA49201');
                }}
                className={`py-1.5 rounded-lg text-center transition-all ${
                  autoType === 'vin' ? 'bg-clay text-white shadow font-bold' : 'text-muted hover:text-white'
                }`}
              >
                VIN Номер Кузова (17 знаков)
              </button>
            </div>

            <div>
              <label className="text-[10px] font-mono text-muted uppercase">
                {autoType === 'plate' ? 'Госномер (например: А 777 ОС 777)' : 'VIN (например: WP0AA2Y13MSA49201)'}
              </label>
              <input
                type="text"
                value={autoInput}
                onChange={(e) => setAutoInput(e.target.value)}
                placeholder={autoType === 'plate' ? 'А777ОС777' : '17-значный VIN'}
                className="w-full mt-1 px-3.5 py-2.5 bg-panel border border-hair rounded-xl text-xs font-mono text-white placeholder-muted focus:outline-none focus:border-clay uppercase"
              />
            </div>

            {autoValidation && (
              <div
                className={`p-3 rounded-xl border space-y-2 ${
                  autoValidation.isValid ? 'bg-sage-soft/30 border-sage/40' : 'bg-clay-soft/30 border-clay/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-white">
                    {autoValidation.isValid ? <CheckCircle2 className="w-4 h-4 text-sage" /> : <AlertCircle className="w-4 h-4 text-clay" />}
                    <span>{autoValidation.type}</span>
                  </div>
                  <span className="text-[10px] font-mono text-gold font-bold">{autoValidation.formatted}</span>
                </div>

                {autoValidation.error && (
                  <div className="text-[11px] text-clay font-medium">{autoValidation.error}</div>
                )}

                {autoValidation.details && (
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    {Object.entries(autoValidation.details).map(([key, val]) => {
                      if (typeof val === 'string' && val.startsWith('http')) return null;
                      return (
                        <div key={key} className="bg-panel/70 p-2 rounded-lg border border-hair">
                          <div className="text-[9px] text-muted capitalize">{key}</div>
                          <div className="font-semibold text-white truncate">{String(val)}</div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {autoValidation.details?.gibddCheckUrl && (
                  <a
                    href={autoValidation.details.gibddCheckUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-[11px] font-semibold text-white flex items-center justify-center space-x-1 border border-hair transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-gold" />
                    <span>Проверить в базе ГИБДД РФ (ДТП / Ограничения)</span>
                  </a>
                )}
              </div>
            )}

            <button
              onClick={() => {
                if (onFreeTextSearch) void onFreeTextSearch(autoInput, 'full-spectrum');
                else void onSearch({ carPlate: autoType === 'plate' ? autoInput : undefined, depth: 'DEEP_TOTEM' });
              }}
              className="w-full py-2.5 px-3 bg-gradient-to-r from-[#c2664f] to-[#a8834c] hover:brightness-110 text-white text-xs font-bold rounded-xl shadow-[0_10px_30px_rgba(0,0,0,.28)] flex items-center justify-center space-x-1.5 transition-all"
            >
              <Zap className="w-4 h-4 text-gold" />
              <span>Живая разведка по ТС</span>
            </button>
          </div>
        </div>
      )}

      {/* VECTOR 5: NETWORK, IP, DNS, CRYPTO & HASHES */}
      {activeVector === 'net' && (
        <div className="space-y-3.5">
          <div className="ios-glass p-4 rounded-[20px] border border-hair space-y-3">
            <div className="text-xs font-bold text-white uppercase tracking-tight flex items-center space-x-2">
              <Globe className="w-4 h-4 text-clay" />
              <span>Сетевая разведка: IP Geolocation, DNS over HTTPS, Email & Crypto</span>
            </div>

            <div className="grid grid-cols-5 gap-1 p-1 bg-panel rounded-xl border border-hair text-[10px] font-semibold">
              {[
                { id: 'ip', label: 'IP Geo' },
                { id: 'dns', label: 'DNS DoH' },
                { id: 'email', label: 'Email MX' },
                { id: 'crypto', label: 'Крипто' },
                { id: 'hash', label: 'Хэши' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    sound.playHapticTap();
                    setNetTab(item.id as never);
                  }}
                  className={`py-1.5 rounded-lg text-center transition-all ${
                    netTab === item.id ? 'bg-clay text-white shadow font-bold' : 'text-muted hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {netTab === 'ip' && (
              <div className="space-y-2.5">
                <div>
                  <label className="text-[10px] font-mono text-muted uppercase">IP-Адрес (IPv4 / IPv6)</label>
                  <div className="flex space-x-2 mt-1">
                    <input
                      type="text"
                      value={ipInput}
                      onChange={(e) => setIpInput(e.target.value)}
                      placeholder="8.8.8.8 или 185.220.101.5"
                      className="flex-1 px-3.5 py-2.5 bg-panel border border-hair rounded-xl text-xs font-mono text-white placeholder-muted focus:outline-none focus:border-clay"
                    />
                    <button
                      onClick={handleLookupIp}
                      disabled={isIpLoading}
                      className="px-4 py-2.5 bg-clay hover:bg-clay/80 text-white rounded-xl text-xs font-bold transition-all"
                    >
                      {isIpLoading ? 'Поиск...' : 'Геолокация'}
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      if (onFreeTextSearch) void onFreeTextSearch(ipInput, 'infrastructure-recon');
                      else void onSearch({ fio: ipInput, depth: 'DEEP_TOTEM' });
                    }}
                    className="w-full mt-2 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[11px] font-semibold text-white border border-hair flex items-center justify-center space-x-1"
                  >
                    <Zap className="w-3.5 h-3.5 text-gold" />
                    <span>Полная разведка по IP (ASN, PTR, RDAP)</span>
                  </button>
                </div>

                {ipResult && (
                  <div className="bg-panel p-3 rounded-xl border border-hair space-y-2 text-[11px]">
                    <div className="flex items-center justify-between border-b border-hair pb-1.5">
                      <span className="font-mono font-bold text-white">{ipResult.ip}</span>
                      <span className="text-[9px] font-mono text-gold">{ipResult.country} • {ipResult.city}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-[9px] text-muted">Провайдер / ISP</div>
                        <div className="font-semibold text-white truncate">{ipResult.isp}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-muted">ASN Организация</div>
                        <div className="font-semibold text-white truncate">{ipResult.asn} {ipResult.org}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-muted">Координаты</div>
                        <div className="font-mono text-gold">{ipResult.latitude}, {ipResult.longitude}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-muted">Часовой пояс</div>
                        <div className="font-mono text-white">{ipResult.timezone}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {netTab === 'dns' && (
              <div className="space-y-2.5">
                <div>
                  <label className="text-[10px] font-mono text-muted uppercase">Доменное имя</label>
                  <div className="flex space-x-2 mt-1">
                    <input
                      type="text"
                      value={dnsDomain}
                      onChange={(e) => setDnsDomain(e.target.value)}
                      placeholder="sberbank.ru"
                      className="flex-1 px-3.5 py-2.5 bg-panel border border-hair rounded-xl text-xs font-mono text-white placeholder-muted focus:outline-none focus:border-clay"
                    />
                    <select
                      value={dnsType}
                      onChange={(e) => setDnsType(e.target.value as never)}
                      className="px-3 bg-panel border border-hair rounded-xl text-xs font-mono text-white"
                    >
                      <option value="A">A (IPv4)</option>
                      <option value="MX">MX (Почта)</option>
                      <option value="TXT">TXT / SPF</option>
                      <option value="NS">NS Серверы</option>
                    </select>
                    <button
                      onClick={handleQueryDns}
                      disabled={isDnsLoading}
                      className="px-4 py-2.5 bg-clay hover:bg-clay/80 text-white rounded-xl text-xs font-bold transition-all"
                    >
                      {isDnsLoading ? 'Запрос...' : 'DNS DoH'}
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      if (onFreeTextSearch) void onFreeTextSearch(dnsDomain, 'infrastructure-recon');
                      else void onSearch({ fio: dnsDomain, depth: 'DEEP_TOTEM' });
                    }}
                    className="w-full mt-2 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[11px] font-semibold text-white border border-hair flex items-center justify-center space-x-1"
                  >
                    <Zap className="w-3.5 h-3.5 text-gold" />
                    <span>Полная разведка домена (DoH, CT, RDAP, веб)</span>
                  </button>
                </div>

                {dnsResults.length > 0 && (
                  <div className="bg-panel p-3 rounded-xl border border-hair space-y-1.5 font-mono text-[11px]">
                    <div className="text-[10px] text-muted uppercase font-bold">Ответ Cloudflare DNS over HTTPS:</div>
                    {dnsResults.map((rec, idx) => (
                      <div key={idx} className="p-1.5 bg-white/5 rounded border border-hair flex justify-between">
                        <span className="text-gold font-bold">{rec.type}</span>
                        <span className="text-white truncate ml-2">{rec.data}</span>
                        <span className="text-muted ml-2 text-[9px]">TTL: {rec.TTL}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {netTab === 'email' && (
              <div className="space-y-2.5">
                <div>
                  <label className="text-[10px] font-mono text-muted uppercase">Email адрес</label>
                  <div className="flex space-x-2 mt-1">
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="user@example.com"
                      className="flex-1 px-3.5 py-2.5 bg-panel border border-hair rounded-xl text-xs font-mono text-white placeholder-muted focus:outline-none focus:border-clay"
                    />
                    <button
                      onClick={handleAnalyzeEmail}
                      disabled={isEmailLoading}
                      className="px-4 py-2.5 bg-clay hover:bg-clay/80 text-white rounded-xl text-xs font-bold transition-all"
                    >
                      {isEmailLoading ? 'Проверка...' : 'Анализ MX'}
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      if (onFreeTextSearch) void onFreeTextSearch(emailInput, 'full-spectrum');
                      else void onSearch({ email: emailInput, depth: 'DEEP_TOTEM' });
                    }}
                    className="w-full mt-2 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[11px] font-semibold text-white border border-hair flex items-center justify-center space-x-1"
                  >
                    <Zap className="w-3.5 h-3.5 text-gold" />
                    <span>Разведка e-mail (MX, утечки, Gravatar)</span>
                  </button>
                </div>

                {emailResult && (
                  <div className="bg-panel p-3 rounded-xl border border-hair space-y-2 text-[11px]">
                    <div className="flex items-center justify-between border-b border-hair pb-1.5">
                      <span className="font-mono font-bold text-white">{emailResult.email}</span>
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-clay/20 text-clay border border-hair">
                        {emailResult.providerType}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-[9px] text-muted">Домен почты</div>
                        <div className="font-semibold text-white">{emailResult.domain}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-muted">MX Почтовый сервер</div>
                        <div className="font-semibold text-sage">
                          {emailResult.hasMxRecords ? 'Активен (Принимает почту)' : 'MX не найден'}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-hair">
                      <a
                        href={emailResult.searchLinks.hibp}
                        target="_blank"
                        rel="noreferrer"
                        className="py-1.5 px-2 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-semibold text-ink flex items-center justify-center space-x-1 border border-hair transition-all"
                      >
                        <ExternalLink className="w-3 h-3 text-gold" />
                        <span>HaveIBeenPwned</span>
                      </a>
                      <a
                        href={emailResult.searchLinks.intelx}
                        target="_blank"
                        rel="noreferrer"
                        className="py-1.5 px-2 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-semibold text-ink flex items-center justify-center space-x-1 border border-hair transition-all"
                      >
                        <ExternalLink className="w-3 h-3 text-gold" />
                        <span>Intelligence X</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}

            {netTab === 'crypto' && (
              <div className="space-y-2.5">
                <div>
                  <label className="text-[10px] font-mono text-muted uppercase">Криптовалютный адрес (BTC / ETH / TRON / SOL)</label>
                  <div className="flex space-x-2 mt-1">
                    <input
                      type="text"
                      value={cryptoInput}
                      onChange={(e) => setCryptoInput(e.target.value)}
                      placeholder="bc1q... или 0x... или T..."
                      className="flex-1 px-3.5 py-2.5 bg-panel border border-hair rounded-xl text-xs font-mono text-white placeholder-muted focus:outline-none focus:border-clay"
                    />
                    <button
                      onClick={handleCheckCryptoBalance}
                      className="px-4 py-2.5 bg-clay hover:bg-clay/80 text-white rounded-xl text-xs font-bold transition-all"
                    >
                      Баланс RPC
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      if (onFreeTextSearch) void onFreeTextSearch(cryptoInput, 'crypto-investigation');
                      else void onSearch({ fio: cryptoInput, depth: 'DEEP_TOTEM' });
                    }}
                    className="w-full mt-2 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[11px] font-semibold text-white border border-hair flex items-center justify-center space-x-1"
                  >
                    <Zap className="w-3.5 h-3.5 text-gold" />
                    <span>Крипто-расследование (кластеры, миксер, контрагенты)</span>
                  </button>
                </div>

                {cryptoResult && (
                  <div className="bg-panel p-3 rounded-xl border border-hair space-y-2 text-[11px]">
                    <div className="flex items-center justify-between border-b border-hair pb-1.5">
                      <span className="font-mono font-bold text-white">{cryptoResult.networkName}</span>
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-sage-soft text-sage border border-hair">
                        {cryptoResult.addressType}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-[9px] text-muted">Адрес</div>
                        <div className="font-mono text-gold truncate">{cryptoResult.address}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-muted">Баланс в блокчейне</div>
                        <div className="font-semibold text-white">{cryptoResult.balance || 'Нажмите Баланс RPC'}</div>
                      </div>
                    </div>

                    <a
                      href={cryptoResult.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-[11px] font-semibold text-white flex items-center justify-center space-x-1 border border-hair transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-gold" />
                      <span>Открыть в публичном обозревателе блокчейна</span>
                    </a>
                  </div>
                )}
              </div>
            )}

            {netTab === 'hash' && (
              <div className="space-y-2.5">
                <div>
                  <label className="text-[10px] font-mono text-muted uppercase">Строка или пароль для хэширования</label>
                  <div className="flex space-x-2 mt-1">
                    <input
                      type="text"
                      value={hashInput}
                      onChange={(e) => setHashInput(e.target.value)}
                      placeholder="Строка текста..."
                      className="flex-1 px-3.5 py-2.5 bg-panel border border-hair rounded-xl text-xs font-mono text-white placeholder-muted focus:outline-none focus:border-clay"
                    />
                    <button
                      onClick={handleCalculateHashes}
                      className="px-4 py-2.5 bg-clay hover:bg-clay/80 text-white rounded-xl text-xs font-bold transition-all"
                    >
                      Рассчитать
                    </button>
                  </div>
                </div>

                {hashResults && (
                  <div className="bg-panel p-3 rounded-xl border border-hair space-y-2 font-mono text-[10px]">
                    <div>
                      <div className="text-[9px] text-muted uppercase">MD5</div>
                      <div className="text-gold break-all">{hashResults.md5}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-muted uppercase">SHA-1</div>
                      <div className="text-white break-all">{hashResults.sha1}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-muted uppercase">SHA-256 (Криптостойкий)</div>
                      <div className="text-sage break-all">{hashResults.sha256}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VECTOR 6: USERNAME & SOCIAL FOOTPRINT */}
      {activeVector === 'user' && (
        <div className="space-y-3.5">
          <div className="ios-glass p-4 rounded-[20px] border border-hair space-y-3">
            <div className="text-xs font-bold text-white uppercase tracking-tight flex items-center space-x-2">
              <AtSign className="w-4 h-4 text-clay" />
              <span>Кросс-платформенный поиск цифрового следа юзернейма</span>
            </div>

            <div>
              <label className="text-[10px] font-mono text-muted uppercase">Никнейм / Username</label>
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="m_sokolov"
                className="w-full mt-1 px-3.5 py-2.5 bg-panel border border-hair rounded-xl text-xs font-mono text-white placeholder-muted focus:outline-none focus:border-clay"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[340px] overflow-y-auto no-scrollbar pt-1">
              {socialResults.map((res, idx) => (
                <a
                  key={idx}
                  href={res.profileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2.5 bg-panel hover:bg-white/10 rounded-xl border border-hair flex items-center justify-between group transition-all"
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-bold text-white group-hover:text-gold transition-colors flex items-center space-x-1">
                      <span>{res.name}</span>
                      <ExternalLink className="w-3 h-3 text-muted group-hover:text-gold" />
                    </div>
                    <div className="text-[10px] text-muted truncate">{res.profileUrl}</div>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 bg-white/5 rounded text-ink font-mono border border-hair shrink-0">
                    {res.badge}
                  </span>
                </a>
              ))}
            </div>

            <button
              onClick={() => {
                if (onFreeTextSearch) void onFreeTextSearch(usernameInput.startsWith('@') ? usernameInput : `@${usernameInput}`, 'full-spectrum');
                else void onSearch({ telegram: usernameInput, depth: 'DEEP_TOTEM' });
              }}
              className="w-full py-2.5 px-3 bg-gradient-to-r from-[#c2664f] to-[#a8834c] hover:brightness-110 text-white text-xs font-bold rounded-xl shadow-[0_10px_30px_rgba(0,0,0,.28)] flex items-center justify-center space-x-1.5 transition-all"
            >
              <Zap className="w-4 h-4 text-gold" />
              <span>Живой поиск никнейма (24 площадки)</span>
            </button>
          </div>
        </div>
      )}

      {/* VECTOR 7: PHOTO, EXIF & FORENSICS */}
      {activeVector === 'face' && (
        <BiometricFaceScanner onScanMatch={(name) => setFio(name)} />
      )}

      {/* Quick Switch Saved Cases */}
      {savedCases.length > 0 && (
        <div className="ios-glass p-3.5 rounded-[16px] border border-hair space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-white uppercase tracking-tight flex items-center space-x-1.5">
              <Database className="w-3.5 h-3.5 text-gold" />
              <span>Сохраненные дела в рабочей базе ({savedCases.length})</span>
            </span>
          </div>

          <div className="space-y-1.5">
            {savedCases.slice(0, 3).map((cs) => (
              <button
                key={cs.id}
                onClick={() => {
                  sound.playHapticTap();
                  setActiveCaseId(cs.id);
                  onSelectPreset(cs);
                }}
                className="w-full p-2.5 bg-panel hover:bg-white/10 rounded-xl border border-hair flex items-center justify-between text-left transition-all"
              >
                <div>
                  <div className="text-xs font-bold text-white">{cs.fio.full}</div>
                  <div className="text-[10px] text-muted">ID: {cs.id} • {cs.totemTitle}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
