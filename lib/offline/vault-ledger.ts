import { getStellarExpertTxUrl, getStellarExpertUrl } from "@/lib/wallet-utils"

export const OFFLINE_LEDGER_NETWORK = "testnet" as const

export type OfflineLedgerTx = {
  hash: string
  createdAt: string | null
  label: string
  reason: "settled" | "note-used" | "other"
  explorerUrl: string
}

export type OfflineLedger = {
  vault: string | null
  network: typeof OFFLINE_LEDGER_NETWORK
  waiting: boolean
  contractExplorerUrl: string | null
  txs: OfflineLedgerTx[]
}

const CLASSIC_ACCOUNT = /^G[A-Z2-7]{55}$/
const CONTRACT_ID = /^C[A-Z2-7]{55}$/
const SOROBAN_RPC = "https://soroban-testnet.stellar.org"
// Wider windows come back empty from this RPC. 5_000 ledgers is about seven hours.
const LEDGER_WINDOW = 5_000

/** Testnet vault from the Contract cut. Query and env still override it. */
export const DEMO_OFFLINE_VAULT_ID =
  "CDSCQSVWKTYR7EUJK5EQXIFI4L2C4LCPQOIUYP6PMG6KW4O2BZGCRLLV"

export function isVaultId(value: string | null | undefined): value is string {
  if (!value) return false
  const id = value.trim()
  return CLASSIC_ACCOUNT.test(id) || CONTRACT_ID.test(id)
}

export function resolveVaultId(
  queryVault?: string | null,
  envVault: string | null | undefined = process.env.NEXT_PUBLIC_OFFLINE_VAULT_ID,
  fallback: string | null = DEMO_OFFLINE_VAULT_ID,
): string | null {
  if (isVaultId(queryVault)) return queryVault.trim()
  if (isVaultId(envVault)) return envVault.trim()
  if (isVaultId(fallback)) return fallback.trim()
  return null
}

export function vaultContractExplorerUrl(vault: string): string {
  if (vault.startsWith("C")) {
    return `https://stellar.expert/explorer/${OFFLINE_LEDGER_NETWORK}/contract/${vault}`
  }
  return getStellarExpertUrl(vault, OFFLINE_LEDGER_NETWORK)
}

export function emptyOfflineLedger(vault: string | null): OfflineLedger {
  return {
    vault,
    network: OFFLINE_LEDGER_NETWORK,
    waiting: vault === null,
    contractExplorerUrl: vault ? vaultContractExplorerUrl(vault) : null,
    txs: [],
  }
}

export type ChequeSubmitReason = "note-used" | "collateral" | "rejected"

/** Why a vault upload failed. The phone uses this to stop a second spend of the same note. */
export function chequeSubmitReason(text: string): ChequeSubmitReason {
  const lower = text.toLowerCase()
  if (lower.includes("note-used") || lower.includes("note_used") || lower.includes("note already used")) {
    return "note-used"
  }
  if (lower.includes("collateral")) return "collateral"
  return "rejected"
}

export function classifyVaultEvent(text: string): OfflineLedgerTx["reason"] {
  const lower = text.toLowerCase()
  if (lower.includes("note-used") || lower.includes("note_used") || lower.includes("note already used")) {
    return "note-used"
  }
  if (lower.includes("settle") || lower.includes("settled")) {
    return "settled"
  }
  return "other"
}

type RawHistoryRow = {
  hash?: unknown
  txHash?: unknown
  id?: unknown
  ts?: unknown
  created_at?: unknown
  createdAt?: unknown
  type?: unknown
  function?: unknown
  title?: unknown
  error?: unknown
  result?: unknown
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

export function mapHistoryRows(rows: unknown, vault: string): OfflineLedgerTx[] {
  if (!Array.isArray(rows)) return []
  const txs: OfflineLedgerTx[] = []
  for (const row of rows) {
    if (!row || typeof row !== "object") continue
    const raw = row as RawHistoryRow
    const hash = asString(raw.hash) ?? asString(raw.txHash)
    if (!hash || hash.startsWith("C") || hash.startsWith("G")) continue
    if (!/^[0-9a-fA-F]{8,}$/.test(hash)) continue
    const blob = [raw.type, raw.function, raw.title, raw.error, raw.result]
      .map(asString)
      .filter(Boolean)
      .join(" ")
    const reason = classifyVaultEvent(blob)
    const label = labelForReason(
      reason,
      asString(raw.title) ?? asString(raw.function) ?? asString(raw.type) ?? "vault tx",
    )
    const createdAt = asString(raw.createdAt) ?? asString(raw.created_at) ?? (typeof raw.ts === "number" ? new Date(raw.ts * 1000).toISOString() : null)
    txs.push({
      hash,
      createdAt,
      label,
      reason,
      explorerUrl: getStellarExpertTxUrl(hash, OFFLINE_LEDGER_NETWORK),
    })
  }
  return txs
}

function labelForReason(reason: OfflineLedgerTx["reason"], fallback: string): string {
  if (reason === "note-used") return "note already used"
  if (reason === "settled") return "settled · settler kept 0.01 USDC"
  return fallback
}

function historyUrl(vault: string): string {
  const kind = vault.startsWith("C") ? "contract" : "account"
  return `https://api.stellar.expert/explorer/${OFFLINE_LEDGER_NETWORK}/${kind}/${vault}/history?limit=20&order=desc`
}

type RpcEvent = {
  txHash?: unknown
  ledgerClosedAt?: unknown
  topic?: unknown
  value?: unknown
}

function xdrAscii(value: unknown): string {
  if (typeof value !== "string" || !value) return ""
  return Buffer.from(value, "base64").toString("latin1")
}

export function mapRpcEvents(events: unknown): OfflineLedgerTx[] {
  if (!Array.isArray(events)) return []
  const byHash = new Map<string, OfflineLedgerTx>()
  for (const event of events) {
    if (!event || typeof event !== "object") continue
    const raw = event as RpcEvent
    const hash = asString(raw.txHash)
    if (!hash || !/^[0-9a-fA-F]{64}$/.test(hash)) continue
    const topics = Array.isArray(raw.topic) ? raw.topic.map(xdrAscii).join(" ") : ""
    const reason = classifyVaultEvent(`${topics} ${xdrAscii(raw.value)}`)
    const next: OfflineLedgerTx = {
      hash,
      createdAt: asString(raw.ledgerClosedAt),
      label: labelForReason(reason, "vault tx"),
      reason,
      explorerUrl: getStellarExpertTxUrl(hash, OFFLINE_LEDGER_NETWORK),
    }
    const prev = byHash.get(hash)
    if (!prev || (prev.reason !== "note-used" && reason === "note-used")) {
      byHash.set(hash, next)
    }
  }
  return [...byHash.values()]
}

async function rpcCall(
  fetchImpl: typeof fetch,
  method: string,
  params?: unknown,
): Promise<unknown> {
  const response = await fetchImpl(SOROBAN_RPC, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "sozu-wallet",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  })
  if (!response.ok) throw new Error(`soroban rpc ${response.status}`)
  const body = (await response.json()) as { result?: unknown; error?: { message?: string } }
  if (body.error) throw new Error(body.error.message || "soroban rpc error")
  return body.result
}

async function loadContractEvents(vault: string, fetchImpl: typeof fetch): Promise<OfflineLedgerTx[]> {
  const latest = (await rpcCall(fetchImpl, "getLatestLedger")) as { sequence?: unknown }
  const sequence = typeof latest?.sequence === "number" ? latest.sequence : 0
  const startLedger = Math.max(1, sequence - LEDGER_WINDOW)
  const result = (await rpcCall(fetchImpl, "getEvents", {
    startLedger,
    filters: [{ type: "contract", contractIds: [vault] }],
    pagination: { limit: 50 },
  })) as { events?: unknown }
  return mapRpcEvents(result?.events)
}

export async function loadOfflineLedger(
  vault: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<OfflineLedger> {
  const ledger = emptyOfflineLedger(vault)
  if (!vault) return ledger
  if (vault.startsWith("C")) {
    ledger.txs = await loadContractEvents(vault, fetchImpl)
    return ledger
  }
  const response = await fetchImpl(historyUrl(vault), { cache: "no-store" })
  if (!response.ok) return ledger
  const body = (await response.json()) as { _embedded?: { records?: unknown }; records?: unknown }
  const rows = body._embedded?.records ?? body.records ?? body
  ledger.txs = mapHistoryRows(rows, vault)
  return ledger
}
