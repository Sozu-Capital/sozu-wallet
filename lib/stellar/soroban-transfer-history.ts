import "server-only"

import { Address, xdr } from "@stellar/stellar-sdk"
import * as rpc from "@stellar/stellar-sdk/rpc"
import { getAssetRegistry } from "@/lib/stellar/asset-registry"
import { transferEventFilters } from "@/lib/stellar/soroban-event-filter"
import { getStellarConfig } from "@/lib/turnkey/config"
import type { StellarNetwork } from "@/lib/stellar/asset-types"

const STROOPS_PER_UNIT = 10_000_000
const EVENTS_PAGE_SIZE = 100
const MAX_EVENT_PAGES = 5
const LEDGER_LOOKBACK = 12_000
const LEDGER_WINDOW = 2_000

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
  if (xdr.ScVal.is(raw)) return raw
  if (typeof raw === "string") {
    try {
      return xdr.ScVal.fromXdr(raw, "base64")
    } catch {
      return null
    }
  }
  if (typeof raw === "object" && raw !== null && "type" in raw) {
    return raw as xdr.ScVal
  }
  return null
}

function scValSymbolText(val: xdr.ScVal): string {
  if (val.type !== "scvSymbol") return ""
  return val.sym.toString()
}

function scValI128ToBigInt(val: xdr.ScVal): bigint {
  if (val.type !== "scvI128") return BigInt(0)
  return (val.i128.hi << BigInt(64)) + val.i128.lo
}

function stroopsToAmount(stroops: bigint): number {
  return Number(stroops) / STROOPS_PER_UNIT
}

function resolveSorobanRpcUrl(network: StellarNetwork): string {
  return (
    process.env.SOROBAN_RPC_URL?.trim() ||
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL?.trim() ||
    (network === "mainnet"
      ? "https://soroban.stellar.org"
      : "https://soroban-testnet.stellar.org")
  )
}

/**
 * USDC transfer events involving the user's smart account (C…) from registered Soroban tokens.
 */
export async function getSorobanWalletTransactions(
  holderAddress: string,
  limit: number,
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
  const startLedger = Math.max(1, endLedger - LEDGER_LOOKBACK)

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
        if (t1?.type === "scvAddress") {
          from = Address.fromScVal(t1).toString().toUpperCase()
        }
        if (t2?.type === "scvAddress") {
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

  // Newest windows first. An unfiltered scan starts at the oldest ledger and never reaches a payment from the last few minutes.
  for (let windowEnd = endLedger; windowEnd >= startLedger && byHash.size < limit; windowEnd -= LEDGER_WINDOW) {
    const windowStart = Math.max(startLedger, windowEnd - LEDGER_WINDOW + 1)
    for (const contractId of contractIds) {
      if (byHash.size >= limit) break
      let cursor: string | undefined
      try {
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
      } catch (error) {
        console.warn("[soroban-transfer-history] event window skipped:", contractId.slice(0, 8), error)
      }
    }
  }

  return Array.from(byHash.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
}
