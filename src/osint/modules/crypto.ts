/**
 * MODULE: crypto — multi-chain blockchain intelligence
 * ---------------------------------------------------------------------------
 * Real chain data, real cryptography:
 *   • address validation with the *actual* checksum algorithms (Base58Check via
 *     double-SHA-256, Bech32/Bech32m polymorphism, EIP-55 via Keccak-256)
 *   • live balances, transaction counts and funding/spending totals
 *   • **common-input-ownership clustering** (BTC): inputs spent together in one
 *     transaction are controlled by the same wallet — the industry-standard
 *     heuristic that turns one address into a wallet cluster
 *   • counterparty extraction → graph edges to exchanges/labels/entities
 *   • risk signals: privacy mixers, high-value flows, exchange deposits
 */

import type { ModuleInput, ModuleContext, ModuleResult, OsintModule } from '../types/module';
import { validateBitcoinBase58, validateTronAddress, validateSolanaAddress, validateMoneroAddressFormat } from '../algo/base58';
import { validateBech32Address } from '../algo/bech32';
import { verifyEip55, toEip55Address } from '../algo/keccak';
import { evidence, entity, edge, pivot, risk, truncate } from './common';

const MODULE_ID = 'finance.crypto';

interface MempoolAddressStats {
  address: string;
  chain_stats: { funded_txo_sum: number; spent_txo_sum: number; tx_count: number };
  mempool_stats?: { funded_txo_sum: number; spent_txo_sum: number; tx_count: number };
}

interface MempoolTx {
  txid: string;
  fee?: number;
  status?: { confirmed?: boolean; block_time?: number };
  vin: Array<{ prevout?: { scriptpubkey_address?: string; value?: number } }>;
  vout: Array<{ scriptpubkey_address?: string; value?: number }>;
}

interface BlockscoutAddress {
  hash: string;
  coin_balance?: string;
  is_contract?: boolean;
  name?: string | null;
  public_tags?: Array<{ display_name?: string; label?: string }>;
  transaction_count?: number;
  creation_tx_hash?: string | null;
  has_tokens?: boolean;
}

interface TronscanAccount {
  data?: Array<{
    address?: string;
    balance?: number;
    totalTransactionCount?: number;
    date_created?: number;
    public_tag?: string;
    addressTag?: string;
    name?: string;
  }>;
}

const BTC_API = { name: 'mempool.space (Bitcoin Core RPC-совместимый API)', kind: 'api' as const, url: 'https://mempool.space/api' };
const EVM_API = { name: 'Blockscout API v2 (EVM-обозреватель)', kind: 'api' as const, url: 'https://eth.blockscout.com/api/v2' };
const TRON_API = { name: 'Tronscan API', kind: 'api' as const, url: 'https://apilist.tronscanapi.com' };

/** Recognised privacy mixers and high-risk sinks (label seeds, not accusations). */
const PRIVACY_SERVICE_PATTERNS = /(mixer|tumbler|tornado|sinbad|blender|wasabi|samourai|coinjoin|privacy)/i;

export const cryptoModule: OsintModule = {
  id: MODULE_ID,
  name: 'Блокчейн-разведка (BTC / EVM / TRON / SOL / XMR)',
  category: 'crypto',
  description:
    'Валидирует адреса реальными алгоритмами контрольных сумм, получает баланс и активность из публичных обозревателей, извлекает контрагентов и строит связи, кластеризует адреса по правилу общего владельца входов (common-input ownership), выявляет контакты с миксерами и крупные потоки.',
  accepts: ['crypto_address', 'bank_account'],
  produces: ['crypto_address', 'crypto_tx', 'service', 'organization', 'location'],
  requiresNetwork: true,
  cost: 3,
  priority: 88,
  cacheTtlMs: 10 * 60_000,
  tags: ['blockchain', 'clustering', 'financial'],
  dataSources: ['mempool.space', 'Blockscout (EVM)', 'Tronscan', 'Solana RPC (ссылки)', 'аналитические обозреватели'],
  async run(input: ModuleInput, ctx: ModuleContext): Promise<ModuleResult> {
    const address = input.entity.value.trim();
    const out: ModuleResult = { evidence: [], entities: [], edges: [], riskFactors: [], pivots: [], notes: [] };

    // ── Chain identification & checksum validation ──────────────────────────
    let chain: 'bitcoin' | 'evm' | 'tron' | 'solana' | 'monero' | 'unknown' = 'unknown';
    if (/^bc1/i.test(address)) {
      const result = validateBech32Address(address.toLowerCase());
      chain = 'bitcoin';
      out.evidence?.push(
        evidence('crypto.segwit', `Bech32-адрес: ${result.isValid ? 'контрольная сумма верна' : 'КОНТРОЛЬНАЯ СУММА НЕВЕРНА'} (${result.addressType ?? '—'}, ${result.encoding ?? '—'})`, { valid: result.isValid, type: result.addressType, encoding: result.encoding, witnessVersion: result.witnessVersion, programHex: result.programHex }, { name: 'BIP-173 / BIP-350 (локально)', kind: 'algorithm' }, { reliability: 0.98, tags: ['checksum'] }),
      );
      if (!result.isValid) return { ...out, riskFactors: [risk('reputation.scam-reports', 0.4, `Адрес ${truncate(address, 20)} не проходит проверку Bech32 — опечатка, подделка или poisoning-атака`, [])] };
    } else if (/^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(address)) {
      const result = validateBitcoinBase58(address);
      chain = 'bitcoin';
      out.evidence?.push(
        evidence('crypto.base58check', `Base58Check: ${result.checksumValid ? 'контрольная сумма (двойной SHA-256) верна' : 'контрольная сумма НЕВЕРНА'}; тип ${result.type}`, result, { name: 'Base58Check double-SHA-256 (локально)', kind: 'algorithm' }, { reliability: 0.98, tags: ['checksum'] }),
      );
      if (!result.checksumValid) return { ...out, riskFactors: [risk('reputation.scam-reports', 0.4, `Адрес ${truncate(address, 20)} не проходит Base58Check — вероятна подмена символа`, [])] };
    } else if (/^0x[0-9a-fA-F]{40}$/.test(address)) {
      chain = 'evm';
      const eip55 = verifyEip55(address);
      out.evidence?.push(
        evidence('crypto.eip55', `EIP-55: ${eip55 === 'checksum-valid' ? 'контрольный регистр совпал' : eip55 === 'unchecksummed' ? 'адрес без контрольного регистра (менее надёжен)' : 'КОНТРОЛЬНЫЙ РЕГИСТР НЕ СОВПАЛ — вероятна опечатка'}`, { status: eip55, canonical: toEip55Address(address) }, { name: 'EIP-55 / Keccak-256 (локально)', kind: 'algorithm' }, { reliability: 0.99, tags: ['checksum', 'keccak'] }),
      );
      if (eip55 === 'checksum-invalid') {
        out.riskFactors?.push(risk('reputation.scam-reports', 0.45, 'Адрес не проходит проверку EIP-55: возможна адресная подмена (address poisoning) или опечатка в источнике данных', []));
      }
    } else if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) {
      chain = 'tron';
      const result = validateTronAddress(address);
      out.evidence?.push(evidence('crypto.tron', `TRON Base58Check: ${result.checksumValid ? 'верна' : 'НЕВЕРНА'}`, result, { name: 'Base58Check (TRON)', kind: 'algorithm' }, { reliability: 0.97, tags: ['checksum'] }));
    } else if (/^[48][1-9A-HJ-NP-Za-km-z]{94,105}$/.test(address)) {
      chain = 'monero';
      const result = validateMoneroAddressFormat(address);
      out.evidence?.push(evidence('crypto.xmr', `${result.kind}: ${result.isValid ? 'структура корректна' : 'некорректна'} (полная проверка требует просмотра ключей сети)`, result, { name: 'Формат Monero (локально)', kind: 'algorithm' }, { reliability: 0.8, tags: ['xmr'] }));
    } else if (validateSolanaAddress(address)) {
      chain = 'solana';
      out.evidence?.push(evidence('crypto.sol', 'Корректный 32-байтовый публичный ключ Solana (Base58, без контрольной суммы)', true, { name: 'Base58 decode (локально)', kind: 'algorithm' }, { reliability: 0.9, tags: ['solana'] }));
    }

    const explorerLinks = {
      bitcoin: `https://mempool.space/address/${address}`,
      evm: `https://eth.blockscout.com/address/${address}`,
      tron: `https://tronscan.org/#/address/${address}`,
      solana: `https://solscan.io/account/${address}`,
      monero: `https://xmrchain.net/search?value=${address}`,
      unknown: '',
    } as const;

    out.evidence?.push(
      evidence('crypto.chain', `Сеть: ${chain}`, chain, { name: 'Классификация адресов (локально)', kind: 'algorithm' }, { reliability: 0.95, tags: ['chain'] }),
      evidence('crypto.explorer', `Публичный обозреватель: ${explorerLinks[chain]}`, explorerLinks[chain], { name: 'Публичные обозреватели блокчейнов', kind: 'api' }, { reliability: 0.9, tags: ['pivot-links'] }),
      evidence('crypto.analytics-links', 'Профессиональные аналитические платформы для проверки риска адреса', {
        chainalysis: 'https://www.chainalysis.com/',
        trm: 'https://www.trmlabs.com/',
        elliptic: 'https://www.elliptic.co/',
        breadcrumbs: `https://www.breadcrumbs.app/address/${address}`,
        metasmask: 'https://metamask.io/',
      }, { name: 'Аналитические платформы (ссылки)', kind: 'algorithm' }, { reliability: 0.8, tags: ['plan'] }),
    );

    // ── BTC live intel + clustering ─────────────────────────────────────────
    if (chain === 'bitcoin') {
      try {
        const stats = await ctx.http.json<MempoolAddressStats>(`https://mempool.space/api/address/${address}`, { cacheTtlMs: 10 * 60_000, timeoutMs: 12_000, signal: ctx.signal });
        const confirmed = stats.chain_stats;
        const balanceSats = confirmed.funded_txo_sum - confirmed.spent_txo_sum;
        out.evidence?.push(
          evidence('crypto.balance', `Баланс: ${(balanceSats / 1e8).toFixed(8)} BTC`, balanceSats / 1e8, BTC_API, { reliability: 0.95, tags: ['balance'] }),
          evidence('crypto.throughput', `Всего получено ${(confirmed.funded_txo_sum / 1e8).toFixed(8)} BTC, отправлено ${(confirmed.spent_txo_sum / 1e8).toFixed(8)} BTC, транзакций: ${confirmed.tx_count}`, { funded: confirmed.funded_txo_sum / 1e8, spent: confirmed.spent_txo_sum / 1e8, txCount: confirmed.tx_count }, BTC_API, { reliability: 0.95, tags: ['volume'] }),
        );

        if (confirmed.funded_txo_sum / 1e8 > 10) {
          out.riskFactors?.push(risk('fin.high-value-flows', Math.min(0.85, 0.35 + Math.log10(confirmed.funded_txo_sum / 1e8) * 0.15), `Через адрес прошло ${(confirmed.funded_txo_sum / 1e8).toFixed(2)} BTC — значительный объём, требующий проверки источника средств`, []));
        }

        const txs = await ctx.http.json<MempoolTx[]>(`https://mempool.space/api/address/${address}/txs`, { cacheTtlMs: 10 * 60_000, timeoutMs: 15_000, signal: ctx.signal });
        const counterparties = new Map<string, { value: number; txCount: number; lastSeen?: number }>();
        const coInputs = new Map<string, number>();

        for (const tx of (txs ?? []).slice(0, 25)) {
          const isSpending = tx.vin.some((entry) => entry.prevout?.scriptpubkey_address === address);
          // Common-input-ownership: all inputs of a tx belong to one wallet.
          if (isSpending && tx.vin.length > 1) {
            for (const entry of tx.vin) {
              const coAddress = entry.prevout?.scriptpubkey_address;
              if (!coAddress || coAddress === address) continue;
              coInputs.set(coAddress, (coInputs.get(coAddress) ?? 0) + 1);
            }
          }
          for (const output of tx.vout) {
            const target = output.scriptpubkey_address;
            if (!target || target === address) continue;
            const current = counterparties.get(target) ?? { value: 0, txCount: 0 };
            current.value += (output.value ?? 0) / 1e8;
            current.txCount += 1;
            current.lastSeen = tx.status?.block_time ?? current.lastSeen;
            counterparties.set(target, current);
          }
        }

        if (coInputs.size) {
          const cluster = [...coInputs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
          out.evidence?.push(
            evidence('crypto.cluster', `Кластер общего владельца (common-input ownership): ${cluster.map(([addr, count]) => `${truncate(addr, 14)}×${count}`).join(', ')}`, Object.fromEntries(cluster), { name: 'Эвристика общего владельца входов (CIOH)', kind: 'heuristic' }, { reliability: 0.8, tags: ['clustering', 'heuristic'] }),
          );
          for (const [coAddress, count] of cluster.slice(0, 6)) {
            out.entities?.push(entity('crypto_address', coAddress, { label: truncate(coAddress, 20), tags: ['wallet-cluster', 'bitcoin'], confidence: 0.75 }));
            out.edges?.push(edge(input.entity.id, { type: 'crypto_address', value: coAddress }, 'transacted_with', 0.85, 0.8));
            out.pivots?.push(pivot('crypto_address', coAddress, { relation: 'transacted_with', confidence: 0.75, reason: 'Адрес из того же кошелька (общие входы транзакции)', from: input.entity.id }));
            if (count >= 2) out.notes?.push(`Адрес ${coAddress} появляется в общих входах ${count} транзакций — сильный признак единого кошелька`);
          }
        } else if (txs?.length) {
          out.notes?.push('Общие входы не обнаружены: адрес расходует средства единолично (кластеризация невозможна)');
        }

        const topCounterparties = [...counterparties.entries()].sort((a, b) => b[1].value - a[1].value).slice(0, 10);
        for (const [counterparty, stats_] of topCounterparties) {
          out.entities?.push(entity('crypto_address', counterparty, { label: truncate(counterparty, 20), tags: ['counterparty', 'bitcoin'], confidence: 0.7, properties: { receivedBtc: Number(stats_.value.toFixed(8)), txCount: stats_.txCount } }));
          out.edges?.push(edge(input.entity.id, { type: 'crypto_address', value: counterparty }, 'transacted_with', Math.min(1, stats_.txCount / 5), 0.75));
        }
        if (topCounterparties.length) {
          out.evidence?.push(
            evidence('crypto.counterparties', `Основные контрагенты (${topCounterparties.length}): ${topCounterparties.slice(0, 5).map(([addr, stats_]) => `${truncate(addr, 12)} (${stats_.value.toFixed(4)} BTC)`).join(', ')}`, Object.fromEntries(topCounterparties), BTC_API, { reliability: 0.9, tags: ['graph-pivot'] }),
          );
          out.notes?.push('Контрагенты добавлены в граф как отдельные адреса: переход по ним выявляет биржевые депозиты и веер получателей');
        }
      } catch (error) {
        out.notes?.push(`mempool.space недоступен: ${(error as Error).message.slice(0, 140)}`);
      }
    }

    // ── EVM live intel ──────────────────────────────────────────────────────
    if (chain === 'evm') {
      try {
        const info = await ctx.http.json<BlockscoutAddress>(`https://eth.blockscout.com/api/v2/addresses/${address}`, { cacheTtlMs: 10 * 60_000, timeoutMs: 12_000, signal: ctx.signal });
        const balanceEth = Number(info.coin_balance ?? 0) / 1e18;
        const tags = (info.public_tags ?? []).map((entry) => entry.display_name ?? entry.label).filter(Boolean) as string[];
        out.evidence?.push(
          evidence('crypto.balance', `Баланс: ${balanceEth.toFixed(6)} ETH`, balanceEth, EVM_API, { reliability: 0.93, tags: ['balance'] }),
          evidence('crypto.contract', `Адрес является ${info.is_contract ? 'смарт-контрактом' : 'обычным аккаунтом (EOA)'}; транзакций: ${info.transaction_count ?? 'н/д'}`, { isContract: Boolean(info.is_contract), txCount: info.transaction_count }, EVM_API, { reliability: 0.9, tags: ['classification'] }),
        );
        if (info.name || tags.length) {
          const label = info.name ?? tags.join(', ');
          out.evidence?.push(evidence('crypto.attribution', `Публичная метка обозревателя: ${label}`, { name: info.name, tags }, EVM_API, { reliability: 0.85, tags: ['attribution'] }));
          out.entities?.push(entity('service', label, { label, tags: ['crypto-label'], confidence: 0.85 }));
          out.edges?.push(edge(input.entity.id, { type: 'service', value: label }, 'owned_by', 0.6, 0.85));
          if (PRIVACY_SERVICE_PATTERNS.test(label)) {
            out.riskFactors?.push(risk('fin.crypto-mixer-exposure', 0.85, `Адрес атрибутирован как сервис приватности/миксер («${label}»)`, []));
          }
        }
        if (info.creation_tx_hash) {
          out.evidence?.push(evidence('crypto.creation-tx', `Транзакция создания: ${info.creation_tx_hash}`, info.creation_tx_hash, EVM_API, { reliability: 0.9, tags: ['timeline'] }));
          out.entities?.push(entity('crypto_tx', info.creation_tx_hash, { label: truncate(info.creation_tx_hash, 20), tags: ['creation-tx'], confidence: 0.9 }));
          out.edges?.push(edge(input.entity.id, { type: 'crypto_tx', value: info.creation_tx_hash }, 'derived_from', 0.8, 0.9));
        }
        if (balanceEth > 50) {
          out.riskFactors?.push(risk('fin.high-value-flows', Math.min(0.9, 0.4 + Math.log10(balanceEth) * 0.12), `На адресе ${balanceEth.toFixed(2)} ETH — значительный баланс требует проверки происхождения средств`, []));
        }
      } catch (error) {
        out.notes?.push(`Blockscout недоступен: ${(error as Error).message.slice(0, 140)}`);
      }
    }

    // ── TRON live intel ─────────────────────────────────────────────────────
    if (chain === 'tron') {
      try {
        const payload = await ctx.http.json<TronscanAccount>(`https://apilist.tronscanapi.com/api/account?address=${encodeURIComponent(address)}`, { cacheTtlMs: 10 * 60_000, timeoutMs: 12_000, signal: ctx.signal });
        const account = payload.data?.[0];
        if (account) {
          const balanceTrx = (account.balance ?? 0) / 1e6;
          out.evidence?.push(
            evidence('crypto.balance', `Баланс: ${balanceTrx.toFixed(6)} TRX, транзакций: ${account.totalTransactionCount ?? 0}`, { trx: balanceTrx, txCount: account.totalTransactionCount }, TRON_API, { reliability: 0.9, tags: ['balance'] }),
          );
          if (account.date_created) {
            out.evidence?.push(evidence('crypto.account-created', `Аккаунт создан: ${new Date(account.date_created).toISOString().slice(0, 10)}`, new Date(account.date_created).toISOString(), TRON_API, { reliability: 0.88, tags: ['timeline'] }));
          }
          const label = account.public_tag ?? account.addressTag ?? account.name;
          if (label) {
            out.evidence?.push(evidence('crypto.attribution', `Метка TRONScan: ${label}`, label, TRON_API, { reliability: 0.85, tags: ['attribution'] }));
            if (PRIVACY_SERVICE_PATTERNS.test(label)) out.riskFactors?.push(risk('fin.crypto-mixer-exposure', 0.85, `Адрес атрибутирован как сервис приватности/миксер («${label}»)`, []));
          }
        } else {
          out.notes?.push('Аккаунт TRON не активирован в сети (нет исходящих данных)');
        }
      } catch (error) {
        out.notes?.push(`Tronscan недоступен: ${(error as Error).message.slice(0, 140)}`);
      }
    }

    if (chain === 'solana' || chain === 'monero') {
      out.notes?.push(`${chain === 'solana' ? 'Solana' : 'Monero'}: автоматический сбор ограничен (публичные RPC требуют POST-запросов); используйте прямые ссылки на обозреватели`);
      out.evidence?.push(evidence('crypto.manual-step', 'Для этой сети требуется ручная проверка в обозревателе — автоматический сбор не выполнялся', chain, { name: 'Ограничение модуля (честная пометка)', kind: 'heuristic' }, { reliability: 0.9, tags: ['caveat'] }));
    }

    out.metrics = { chain, addressLength: address.length };
    return out;
  },
};

export const cryptoModules = [cryptoModule];
