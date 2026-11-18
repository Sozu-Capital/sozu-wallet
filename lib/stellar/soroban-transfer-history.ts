import "server-only"

import { Address, xdr } from "@stellar/stellar-sdk"
import * as rpc from "@stellar/stellar-sdk/rpc"
import { getAssetRegistry } from "@/lib/stellar/asset-registry"
import { transferEventFilters } from "@/lib/stellar/soroban-event-filter"
import { resolveSorobanRpcUrlForNetwork } from "@/lib/stellar/network-env"
import { getStellarConfig } from "@/lib/turnkey/config"
import type { StellarNetwork } from "@/lib/stellar/asset-types"
import { xdrBigInt, xdrField, xdrType } from "@/lib/stellar/xdr-access"

const STROOPS_PER_UNIT = 10_000_000
const EVENTS_PAGE_SIZE = 100
const MAX_EVENT_PAGES = 5
const LEDGER_LOOKBACK = 12_000
const LEDGER_WINDOW = 2_000
/** First load for an account with nothing stored yet. RPC retention is the real cap. */
export const SOROBAN_HISTORY_BACKFILL_LEDGERS = 200_000
const DEEP_SCAN_TIMEOUT_MS = 8_000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error instanceof Error ? error : new Error(String(error)))
      },
    )
  })
}

export type SorobanWalletTransaction = {
  id: string
  hash: string
  createdAt: string
  successful: boolean
  memo: string | null
  operations: Array<{
    type: string
    from: string
    to: string
    amount: number
    asset: string
    assetIssuer?: string | null
  }>
}

function coerceScVal(raw: unknown): xdr.ScVal | null {
  if (raw == null) return null
  if (typeof raw === "object" && raw !== null && typeof (raw as { switch?: unknown }).switch === "function") {
    return raw as xdr.ScVal
  }
  if (typeof raw === "string") {
    try {
      return xdr.ScVal.fromXDR(raw, "base64")
    } catch {
      return null
    }
  }
  return null
}

function scValSymbolText(val: xdr.ScVal): string {
  if (xdrType(val) !== "scvSymbol") return ""
  return xdrField<{ toString(): string }>(val, "sym").toString()
}

function scValI128ToBigInt(val: xdr.ScVal): bigint {
  if (xdrType(val) !== "scvI128") return BigInt(0)
  const parts = xdrField<{ hi: unknown; lo: unknown }>(val, "i128")
  const hi = BigInt.asIntN(64, xdrBigInt(xdrField(parts, "hi")))
  const lo = BigInt.asUintN(64, xdrBigInt(xdrField(parts, "lo")))
  return (hi << BigInt(64)) + lo
}

function stroopsToAmount(stroops: bigint): number {
  return Number(stroops) / STROOPS_PER_UNIT
}

function resolveSorobanRpcUrl(network: StellarNetwork): string {
  return resolveSorobanRpcUrlForNetwork(network)
}

/**
 * USDC transfer events involving the user's smart account (C…) from registered Soroban tokens.
 */
export async function getSorobanWalletTransactions(
  holderAddress: string,
  limit: number,
  options?: { lookbackLedgers?: number },
): Promise<SorobanWalletTransaction[]> {
  const holder = holderAddress.trim().toUpperCase()
  if (!holder.startsWith("C") || holder.length !== 56) return []

  const { network } = getStellarConfig()
  const contractIds = [
    ...new Set(
      getAssetRegistry(network)
        .map((a) => a.contractId.trim().toUpperCase())
        .filter((id) => id.startsWith("C") && id.length === 56),
    ),
  ]
  if (contractIds.length === 0) return []

  const rpcUrl = resolveSorobanRpcUrl(network)
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") })
  const latest = await server.getLatestLedger()
  const endLedger = latest.sequence ?? 1
  const lookback = Math.max(LEDGER_LOOKBACK, options?.lookbackLedgers ?? LEDGER_LOOKBACK)
  const startLedger = Math.max(1, endLedger - lookback)

  const assetByContract = new Map(
    getAssetRegistry(network).map((a) => [a.contractId.trim().toUpperCase(), a.symbol]),
  )

  const byHash = new Map<string, SorobanWalletTransaction>()
  const seen = new Set<string>()

  const absorb = (contractId: string, events: rpc.Api.EventResponse[]) => {
    for (const ev of events) {
      if (!ev?.txHash || typeof ev.txHash !== "string") continue
      const topic = ev.topic
      if (!topic || !Array.isArray(topic) || topic.length < 3) continue

      let t0: xdr.ScVal | null = null
      let from: string | null = null
      let to: string | null = null
      try {
        t0 = coerceScVal(topic[0])
        const t1 = coerceScVal(topic[1])
        const t2 = coerceScVal(topic[2])
        if (t1 && xdrType(t1) === "scvAddress") {
          from = Address.fromScVal(t1).toString().toUpperCase()
        }
        if (t2 && xdrType(t2) === "scvAddress") {
          to = Address.fromScVal(t2).toString().toUpperCase()
        }
      } catch {
        continue
      }

      if (!t0 || scValSymbolText(t0) !== "transfer") continue
      if (!from || !to) continue
      if (from !== holder && to !== holder) continue

      const dedupeKey = `${ev.txHash}:${from}:${to}:${contractId}`
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)

      const val = coerceScVal(ev.value)
      const amount = val ? stroopsToAmount(scValI128ToBigInt(val)) : 0
      const asset = assetByContract.get(contractId) ?? "USDC"
      const createdAt =
        typeof ev.ledgerClosedAt === "string" && ev.ledgerClosedAt
          ? ev.ledgerClosedAt
          : new Date().toISOString()

      const existing = byHash.get(ev.txHash)
      if (existing) {
        existing.operations.push({ type: "payment", from, to, amount, asset })
        continue
      }

      byHash.set(ev.txHash, {
        id: ev.txHash,
        hash: ev.txHash,
        createdAt,
        successful: true,
        memo: null,
        operations: [{ type: "payment", from, to, amount, asset }],
      })
    }
  }

  const pages = async (contractId: string, windowStart: number, windowEnd: number) => {
    let cursor: string | undefined
    for (let page = 0; page < MAX_EVENT_PAGES && byHash.size < limit; page++) {
      const res = cursor
        ? await server.getEvents({
            filters: transferEventFilters(contractId, holder),
            cursor,
            limit: EVENTS_PAGE_SIZE,
          })
        : await server.getEvents({
            startLedger: windowStart,
            endLedger: windowEnd,
            filters: transferEventFilters(contractId, holder),
            limit: EVENTS_PAGE_SIZE,
          })
      const events = res?.events ?? []
      absorb(contractId, events)
      if (events.length < EVENTS_PAGE_SIZE) break
      cursor = typeof res.cursor === "string" && res.cursor.length > 0 ? res.cursor : undefined
      if (!cursor) break
    }
  }

  // Newest windows first. An unfiltered scan starts at the oldest ledger and never reaches a payment from the last few minutes.
  const recentStart = Math.max(1, endLedger - LEDGER_LOOKBACK)
  for (let windowEnd = endLedger; windowEnd >= recentStart && byHash.size < limit; windowEnd -= LEDGER_WINDOW) {
    const windowStart = Math.max(recentStart, windowEnd - LEDGER_WINDOW + 1)
    for (const contractId of contractIds) {
      if (byHash.size >= limit) break
      try {
        await pages(contractId, windowStart, windowEnd)
      } catch (error) {
        console.warn("[soroban-transfer-history] event window skipped:", contractId.slice(0, 8), error)
      }
    }
  }

  // Holder-filtered scan across the backfill range. Recent payments are already
  // collected, so this only fills older transfers the short window forgot.
  if (lookback > LEDGER_LOOKBACK && byHash.size < limit) {
    for (const contractId of contractIds) {
      if (byHash.size >= limit) break
      try {
        await withTimeout(pages(contractId, startLedger, endLedger), DEEP_SCAN_TIMEOUT_MS)
      } catch (error) {
        console.warn("[soroban-transfer-history] deep scan skipped:", contractId.slice(0, 8), error)
      }
    }
  }

  return Array.from(byHash.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
}
