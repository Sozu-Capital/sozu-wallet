/**
 * One Sozu account's payment history.
 * Chain scans only see a recent ledger window, so a transfer has to be kept
 * with the account that sent or received it. Faucet claims are part of that
 * history even after the chain window has moved on.
 */

export const FAUCET_COUNTERPARTY = "SOZU_FAUCET"
export const FAUCET_HISTORY_MEMO = "Sozu Faucet"
export const ACCOUNT_HISTORY_STORE_LIMIT = 500

export type AccountHistoryOperation = {
  type: string
  from: string
  to: string
  amount: number
  asset: string
  memo?: string | null
}

export type AccountHistoryTx = {
  id: string
  hash: string
  createdAt: string
  successful: boolean
  memo: string | null
  operations: AccountHistoryOperation[]
}

export function normalizeWalletAddress(value: string): string {
  return value.trim().toUpperCase()
}

export function isSmartOrClassicAddress(value: string): boolean {
  return /^[GC][A-Z0-9]{55}$/.test(normalizeWalletAddress(value))
}

export function isOnChainTxHash(hash: string | null | undefined): boolean {
  return /^[a-f0-9]{64}$/.test(hash?.trim().toLowerCase() ?? "")
}

export function clampHistoryLimit(value: number): number {
  if (!Number.isFinite(value)) return 100
  return Math.min(200, Math.max(1, Math.floor(value)))
}

/** Named counterparty for history rows. Null means the UI should shorten the address. */
export function historyCounterpartyLabel(
  address: string,
  tag: string | null | undefined,
): string | null {
  if (normalizeWalletAddress(address) === FAUCET_COUNTERPARTY) return FAUCET_HISTORY_MEMO
  const cleaned = tag?.trim()
  if (!cleaned) return null
  return `$${cleaned.replace(/^\$+/, "")}`
}

export function faucetClaimToHistory(claim: {
  id: string
  walletAddress: string
  amount: number | string
  txHash: string | null
  claimedAt: string
}): AccountHistoryTx | null {
  const to = normalizeWalletAddress(claim.walletAddress)
  if (!isSmartOrClassicAddress(to)) return null
  const amount = typeof claim.amount === "number" ? claim.amount : Number(claim.amount)
  if (!Number.isFinite(amount) || amount <= 0) return null
  const claimedAt = claim.claimedAt?.trim()
  if (!claimedAt || Number.isNaN(Date.parse(claimedAt))) return null
  const chainHash = claim.txHash?.trim().toLowerCase() ?? ""
  const hash = isOnChainTxHash(chainHash) ? chainHash : `faucet:${claim.id.trim()}`
  if (!hash || hash === "faucet:") return null
  return {
    id: hash,
    hash,
    createdAt: claimedAt,
    successful: true,
    memo: FAUCET_HISTORY_MEMO,
    operations: [
      {
        type: "payment",
        from: FAUCET_COUNTERPARTY,
        to,
        amount,
        asset: "USDC",
      },
    ],
  }
}

function historyKey(tx: { hash: string }): string {
  return tx.hash.trim().toLowerCase()
}

function normalizeOperation(op: AccountHistoryOperation, wallet: string): AccountHistoryOperation | null {
  const amount = typeof op.amount === "number" ? op.amount : Number(op.amount)
  if (!Number.isFinite(amount)) return null
  const fromRaw = op.from?.trim() ?? ""
  const toRaw = op.to?.trim() ?? ""
  const from =
    normalizeWalletAddress(fromRaw) === FAUCET_COUNTERPARTY
      ? FAUCET_COUNTERPARTY
      : normalizeWalletAddress(fromRaw)
  const to =
    normalizeWalletAddress(toRaw) === FAUCET_COUNTERPARTY
      ? FAUCET_COUNTERPARTY
      : normalizeWalletAddress(toRaw)
  if (!from || !to) return null
  if (from !== wallet && to !== wallet) return null
  return {
    type: op.type || "payment",
    from,
    to,
    amount,
    asset: op.asset?.trim() || "USDC",
    memo: op.memo ?? null,
  }
}

function normalizeTx(tx: AccountHistoryTx, wallet: string): AccountHistoryTx | null {
  const hash = historyKey(tx)
  if (!hash) return null
  const operations = tx.operations
    .map((op) => normalizeOperation(op, wallet))
    .filter((op): op is AccountHistoryOperation => op !== null)
  if (operations.length === 0) return null
  const createdAt = tx.createdAt?.trim() ?? ""
  if (!createdAt || Number.isNaN(Date.parse(createdAt))) return null
  return {
    id: tx.id?.trim() || hash,
    hash,
    createdAt,
    successful: tx.successful !== false,
    memo: tx.memo ?? null,
    operations,
  }
}

function hasChainCounterparty(tx: AccountHistoryTx, wallet: string): boolean {
  return tx.operations.some((op) => {
    const other = op.from === wallet ? op.to : op.from
    return isSmartOrClassicAddress(other)
  })
}

function preferHistoryTx(current: AccountHistoryTx, incoming: AccountHistoryTx, wallet: string): AccountHistoryTx {
  const incomingRicher = hasChainCounterparty(incoming, wallet) && !hasChainCounterparty(current, wallet)
  const base = incomingRicher ? incoming : current
  const other = incomingRicher ? current : incoming
  const memo =
    base.memo === FAUCET_HISTORY_MEMO || other.memo === FAUCET_HISTORY_MEMO
      ? FAUCET_HISTORY_MEMO
      : base.memo ?? other.memo
  return { ...base, memo }
}

/**
 * Union of what this account already remembers, what the chain still returns,
 * and faucet claims paid to this account. A row for another address is dropped.
 * Remembered rows stay even when the chain scan is empty.
 */
export function mergeAccountHistory(input: {
  walletAddress: string
  remembered: readonly AccountHistoryTx[]
  chain: readonly AccountHistoryTx[]
  faucet: readonly AccountHistoryTx[]
  limit?: number
}): AccountHistoryTx[] {
  const wallet = normalizeWalletAddress(input.walletAddress)
  if (!isSmartOrClassicAddress(wallet)) return []
  const byHash = new Map<string, AccountHistoryTx>()

  const consider = (tx: AccountHistoryTx) => {
    const normalized = normalizeTx(tx, wallet)
    if (!normalized) return
    const prev = byHash.get(normalized.hash)
    byHash.set(normalized.hash, prev ? preferHistoryTx(prev, normalized, wallet) : normalized)
  }

  for (const tx of input.remembered) consider(tx)
  for (const tx of input.chain) consider(tx)
  for (const tx of input.faucet) consider(tx)

  const limit = input.limit ?? ACCOUNT_HISTORY_STORE_LIMIT
  return [...byHash.values()]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, limit)
}
