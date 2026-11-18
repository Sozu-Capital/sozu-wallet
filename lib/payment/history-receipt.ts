import type { SavedPurchase } from "@/lib/checkout/saved-purchases"
import type { Transaction } from "@/hooks/use-wallet-data"
import { isCollectiblePurchase, resolveCollectibleSale } from "@/lib/merch/collectible-sale"
import type { MerchLanguage } from "@/lib/merch/copy"
import { buildCollectibleReceipt, type CollectibleReceiptModel } from "@/lib/merch/receipt"
import type { PaymentReceipt } from "@/lib/payment/payment-receipt"
import { getSenderDisplayLabel } from "@/lib/payment/payment-receipt"
import { transactionToPaymentReceipt } from "@/lib/payment/transaction-to-receipt"

export type HistoryReceiptView =
  | { kind: "simple"; receipt: PaymentReceipt }
  | { kind: "collectible"; receipt: CollectibleReceiptModel }

function txKey(hash: string | null | undefined): string {
  return hash?.trim().toLowerCase().replace(/^0x/, "") ?? ""
}

export function savedPurchaseForHash(
  saved: readonly SavedPurchase[],
  hash: string | null | undefined,
): SavedPurchase | null {
  const key = txKey(hash)
  if (!/^[a-f0-9]{64}$/.test(key)) return null
  return saved.find((row) => txKey(row.hash) === key) ?? null
}

const COLLECTIBLE_MATCH_WINDOW_MS = 30 * 60 * 1000

/** The chain sometimes indexes a different hash than the one stored at checkout. */
function collectiblePurchaseForTransfer(
  tx: Transaction,
  saved: readonly SavedPurchase[],
): SavedPurchase | null {
  const payment = tx.operations.find((op) => op.type === "payment")
  if (!payment) return null
  const txAt = Date.parse(tx.createdAt)
  const to = payment.to.trim().toUpperCase()
  let best: { row: SavedPurchase; rank: number; delta: number } | null = null
  for (const row of saved) {
    if (!isCollectiblePurchase(row)) continue
    const amount = Number(row.amount)
    if (!Number.isFinite(amount) || Math.abs(amount - payment.amount) > 0.001) continue
    const destination = row.toAddress?.trim().toUpperCase() ?? ""
    if (destination && destination !== to) continue
    const created = Date.parse(row.createdAt)
    const delta =
      Number.isFinite(txAt) && Number.isFinite(created) ? Math.abs(created - txAt) : Number.POSITIVE_INFINITY
    if (delta > COLLECTIBLE_MATCH_WINDOW_MS) continue
    const rank = destination ? 0 : 1
    if (!best || rank < best.rank || (rank === best.rank && delta < best.delta)) {
      best = { row, rank, delta }
    }
  }
  return best?.row ?? null
}

function purchaseForTransaction(
  tx: Transaction,
  saved: readonly SavedPurchase[],
  attached?: SavedPurchase | null,
): SavedPurchase | null {
  const keyed = savedPurchaseForHash(saved, tx.hash) ?? savedPurchaseForHash(saved, tx.id)
  if (keyed) return keyed
  if (attached && (txKey(attached.hash) === txKey(tx.hash) || txKey(attached.hash) === txKey(tx.id))) {
    return attached
  }
  return collectiblePurchaseForTransfer(tx, saved)
}

function collectibleFromPurchase(
  purchase: SavedPurchase,
  network: "testnet" | "mainnet",
  language: MerchLanguage,
): HistoryReceiptView {
  const sale = resolveCollectibleSale({
    collectibleReceipt: purchase.collectible,
    itemName: purchase.itemName,
    editionNumber: purchase.editionNumber,
    editionSize: purchase.editionSize,
  })
  const drop = purchase.merchantName.trim() || "Sozu"
  return {
    kind: "collectible",
    receipt: buildCollectibleReceipt({
      item: {
        name: sale.itemName || drop,
        drop,
        network,
      },
      language,
      status: "paid",
      priceUsdc: purchase.amount,
      paymentHash: purchase.hash,
      transferHash: null,
      createdAt: purchase.createdAt,
      edition:
        sale.editionNumber && sale.editionSize
          ? { number: sale.editionNumber, size: sale.editionSize }
          : null,
      imageUrl: purchase.imageUrl,
    }),
  }
}

function simpleFromPurchase(
  purchase: SavedPurchase,
  network: "testnet" | "mainnet",
): HistoryReceiptView {
  const amount = Number(purchase.amount)
  return {
    kind: "simple",
    receipt: {
      amount: Number.isFinite(amount) ? amount : 0,
      currency: "USDC",
      fromLabel: getSenderDisplayLabel(),
      toLabel: purchase.merchantName.trim() || purchase.itemName,
      transactionHash: purchase.hash,
      network,
      memo: null,
      completedAt: purchase.createdAt,
    },
  }
}

/** Product links with the collectible toggle open the collectible. Everything else is the send confirmation. */
export function historyReceiptForTransaction(input: {
  tx: Transaction
  walletAddress: string
  walletNetwork: "testnet" | "mainnet"
  addressToTagMap: Record<string, string>
  saved: readonly SavedPurchase[]
  language: MerchLanguage
  purchase?: SavedPurchase | null
}): HistoryReceiptView | null {
  const purchase = purchaseForTransaction(input.tx, input.saved, input.purchase)
  if (purchase && isCollectiblePurchase(purchase)) {
    return collectibleFromPurchase(purchase, input.walletNetwork, input.language)
  }
  const receipt = transactionToPaymentReceipt(
    input.tx,
    input.walletAddress,
    input.walletNetwork,
    input.addressToTagMap,
  )
  if (!receipt) return null
  return { kind: "simple", receipt }
}

export function historyReceiptForPurchase(input: {
  purchase: SavedPurchase
  walletNetwork: "testnet" | "mainnet"
  language: MerchLanguage
}): HistoryReceiptView {
  if (isCollectiblePurchase(input.purchase)) {
    return collectibleFromPurchase(input.purchase, input.walletNetwork, input.language)
  }
  return simpleFromPurchase(input.purchase, input.walletNetwork)
}
