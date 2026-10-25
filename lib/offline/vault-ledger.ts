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

export function isVaultId(value: string | null | undefined): value is string {
  if (!value) return false
  const id = value.trim()
  return CLASSIC_ACCOUNT.test(id) || CONTRACT_ID.test(id)
}

export function resolveVaultId(
  queryVault?: string | null,
  envVault: string | null | undefined = process.env.NEXT_PUBLIC_OFFLINE_VAULT_ID,
): string | null {
  if (isVaultId(queryVault)) return queryVault.trim()
  if (isVaultId(envVault)) return envVault.trim()
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
    const label =
      reason === "note-used"
        ? "note already used"
        : reason === "settled"
          ? "settled"
          : asString(raw.title) ?? asString(raw.function) ?? asString(raw.type) ?? "vault tx"
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

function historyUrl(vault: string): string {
  const kind = vault.startsWith("C") ? "contract" : "account"
  return `https://api.stellar.expert/explorer/${OFFLINE_LEDGER_NETWORK}/${kind}/${vault}/history?limit=20&order=desc`
}

export async function loadOfflineLedger(
  vault: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<OfflineLedger> {
  const ledger = emptyOfflineLedger(vault)
  if (!vault) return ledger
  const response = await fetchImpl(historyUrl(vault), { cache: "no-store" })
  if (!response.ok) return ledger
  const body = (await response.json()) as { _embedded?: { records?: unknown }; records?: unknown }
  const rows = body._embedded?.records ?? body.records ?? body
  ledger.txs = mapHistoryRows(rows, vault)
  return ledger
}
