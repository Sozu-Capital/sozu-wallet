import type { SavedPurchase } from "@/lib/checkout/saved-purchases"
import type { Transaction } from "@/hooks/use-wallet-data"
import type { MerchLanguage } from "@/lib/merch/copy"
import { buildCollectibleReceipt, type CollectibleReceiptModel } from "@/lib/merch/receipt"
import type { PaymentReceipt } from "@/lib/payment/payment-receipt"
import { getSenderDisplayLabel } from "@/lib/payment/payment-receipt"
import { transactionToPaymentReceipt } from "@/lib/payment/transaction-to-receipt"

export type HistoryReceiptView =
  | { kind: "simple"; receipt: PaymentReceipt }
  | { kind: "collectible"; receipt: CollectibleReceiptModel }

export function savedPurchaseForHash(
  saved: readonly SavedPurchase[],
  hash: string | null | undefined,
): SavedPurchase | null {
  const key = hash?.trim().toLowerCase() ?? ""
  if (!/^[a-f0-9]{64}$/.test(key)) return null
  return saved.find((row) => row.hash.toLowerCase() === key) ?? null
}

function collectibleFromPurchase(
  purchase: SavedPurchase,
  network: "testnet" | "mainnet",
  language: MerchLanguage,
): HistoryReceiptView {
  return {
    kind: "collectible",
    receipt: buildCollectibleReceipt({
      item: {
        name: purchase.itemName.trim() || purchase.merchantName,
        drop: purchase.merchantName.trim() || "Sozu",
        network,
      },
      language,
      status: "paid",
      priceUsdc: purchase.amount,
      paymentHash: purchase.hash,
      transferHash: null,
      createdAt: purchase.createdAt,
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
}): HistoryReceiptView | null {
  const purchase = savedPurchaseForHash(input.saved, input.tx.hash)
  if (purchase?.collectible) {
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
  if (input.purchase.collectible) {
    return collectibleFromPurchase(input.purchase, input.walletNetwork, input.language)
  }
  return simpleFromPurchase(input.purchase, input.walletNetwork)
}
