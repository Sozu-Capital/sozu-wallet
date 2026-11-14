import type { MerchLanguage } from "@/lib/merch/copy"
import type { SavedPurchase } from "@/lib/checkout/saved-purchases"
import { buildCollectibleReceipt, type CollectibleReceiptModel } from "@/lib/merch/receipt"

export type PurchaseTransfer = {
  hash: string
  createdAt: string
  from: string
  to: string
  amount: number
  asset: string
}

export type PurchaseReceiptCard = {
  slug: string
  receipt: CollectibleReceiptModel
}

function shortAddress(address: string): string {
  const value = address.trim()
  if (value.length < 12) return value
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

function placeholderName(language: MerchLanguage): string {
  return language === "en" ? "Proof of purchase" : "Comprobante de compra"
}

/**
 * One pending collectible receipt per outgoing USDC payment.
 * The NFT has not been minted yet, so the card stays on "receipt pending".
 */
export function purchasePlaceholderReceipts(input: {
  wallet: string
  transfers: readonly PurchaseTransfer[]
  saved: readonly SavedPurchase[]
  language: MerchLanguage
  network: "testnet" | "mainnet"
  skipHashes?: readonly string[]
}): PurchaseReceiptCard[] {
  const wallet = input.wallet.trim().toUpperCase()
  const savedByHash = new Map(input.saved.map((row) => [row.hash.toLowerCase(), row]))
  const skip = new Set((input.skipHashes ?? []).map((hash) => hash.toLowerCase()))
  const cards: PurchaseReceiptCard[] = []
  const seen = new Set<string>()

  const ordered = [...input.transfers].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  )

  for (const transfer of ordered) {
    const hash = transfer.hash.trim().toLowerCase()
    if (!/^[a-f0-9]{64}$/.test(hash) || seen.has(hash) || skip.has(hash)) continue
    if (transfer.asset.toUpperCase() !== "USDC") continue
    if (transfer.from.trim().toUpperCase() !== wallet) continue
    if (!(transfer.amount > 0)) continue
    seen.add(hash)

    const saved = savedByHash.get(hash)
    const itemName = saved?.itemName.trim() || placeholderName(input.language)
    const merchant = saved?.merchantName.trim() || shortAddress(transfer.to)
    const price = saved?.amount.trim() || transfer.amount.toFixed(2)
    cards.push({
      slug: `purchase-${hash.slice(0, 12)}`,
      receipt: buildCollectibleReceipt({
        item: { name: itemName, drop: merchant, network: input.network },
        language: input.language,
        status: "paid",
        priceUsdc: price,
        paymentHash: hash,
        transferHash: null,
        createdAt: saved?.createdAt ?? transfer.createdAt,
      }),
    })
  }

  return cards
}
