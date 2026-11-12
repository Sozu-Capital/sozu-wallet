import type { MerchItemRecord } from "@/lib/merch/catalog"
import { merchCopy, type MerchLanguage } from "@/lib/merch/copy"
import type { MerchOrderStatus } from "@/lib/merch/order"

export type CollectibleReceiptModel = {
  line: string
  itemName: string
  price: string
  currency: "USDC"
  statusLabel: string
  receiptPending: boolean
  drop: string
  timeLabel: string
  networkLabel: string
  disclaimer: string
  paymentUrl: string | null
  transferUrl: string | null
  paymentLink: string
  transferLink: string
}

const HASH = /^[a-fA-F0-9]{64}$/

export function stellarExpertTxUrl(network: "testnet" | "mainnet", hash: string | null | undefined): string | null {
  const value = hash?.trim() ?? ""
  if (!HASH.test(value)) return null
  return `https://stellar.expert/explorer/${network}/tx/${value}`
}

export function formatReceiptTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return `${date.toISOString().replace("T", " ").slice(0, 16)} UTC`
}

export function buildCollectibleReceipt(input: {
  item: Pick<MerchItemRecord, "name" | "drop" | "network">
  language: MerchLanguage
  status: MerchOrderStatus
  priceUsdc: string
  paymentHash: string | null
  transferHash: string | null
  createdAt?: string | null
}): CollectibleReceiptModel {
  const copy = merchCopy(input.language)
  const paidWithoutTransfer = input.status === "paid" && !input.transferHash
  const statusLabel =
    input.status === "completed"
      ? copy.completed
      : input.status === "failed"
        ? copy.statusFailed
        : paidWithoutTransfer
          ? copy.receiptPending
          : copy.statusPending

  return {
    line: copy.purchase(input.item.name),
    itemName: input.item.name,
    price: input.priceUsdc,
    currency: "USDC",
    statusLabel,
    receiptPending: paidWithoutTransfer,
    drop: input.item.drop,
    timeLabel: formatReceiptTime(input.createdAt),
    networkLabel: input.item.network === "testnet" ? copy.testnet : input.item.network,
    disclaimer: copy.disclaimer,
    paymentUrl: stellarExpertTxUrl(input.item.network, input.paymentHash),
    transferUrl: stellarExpertTxUrl(input.item.network, input.transferHash),
    paymentLink: copy.paymentLink,
    transferLink: copy.transferLink,
  }
}
