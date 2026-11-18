import { merchCopy, type MerchLanguage } from "@/lib/merch/copy"
import { editionMark } from "@/lib/merch/edition-label"
import type { MerchOrderStatus } from "@/lib/merch/order"

export type CollectibleReceiptModel = {
  line: string
  itemName: string
  /** Shirt number in the shared run, for example "6/10". Absent for an open collectible. */
  editionLabel?: string | null
  price: string
  currency: "USDC"
  statusLabel: string
  receiptPending: boolean
  drop: string
  timeLabel: string
  networkLabel: string
  disclaimer: string
  shareLabel: string
  /** Merchant photo for this payment link. Absent when the link has no image. */
  imageUrl: string | null
  paymentUrl: string | null
  transferUrl: string | null
  paymentLink: string
  transferLink: string
}

const HASH = /^[a-fA-F0-9]{64}$/
const PRODUCT_IMAGE_DATA_URL =
  /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/

export function collectibleImageUrl(raw: string | null | undefined): string | null {
  const value = raw?.trim() ?? ""
  if (!value) return null
  if (PRODUCT_IMAGE_DATA_URL.test(value)) return value
  try {
    const url = new URL(value)
    if (url.protocol === "https:" || url.protocol === "http:") return url.toString()
  } catch {
    return null
  }
  return null
}

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
  item: { name: string; drop: string; network: "testnet" | "mainnet" }
  language: MerchLanguage
  status: MerchOrderStatus
  priceUsdc: string
  paymentHash: string | null
  transferHash: string | null
  createdAt?: string | null
  edition?: { number: number; size: number } | null
  imageUrl?: string | null
}): CollectibleReceiptModel {
  const copy = merchCopy(input.language)
  const editionLabel = editionMark(input.edition?.number, input.edition?.size)
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
    line: editionLabel ? `${copy.purchase(input.item.name)} · ${editionLabel}` : copy.purchase(input.item.name),
    itemName: input.item.name,
    editionLabel,
    price: input.priceUsdc,
    currency: "USDC",
    statusLabel,
    receiptPending: paidWithoutTransfer,
    drop: input.item.drop,
    timeLabel: formatReceiptTime(input.createdAt),
    networkLabel: input.item.network === "testnet" ? copy.testnet : input.item.network,
    disclaimer: copy.disclaimer,
    shareLabel: copy.share,
    imageUrl: collectibleImageUrl(input.imageUrl),
    paymentUrl: stellarExpertTxUrl(input.item.network, input.paymentHash),
    transferUrl: stellarExpertTxUrl(input.item.network, input.transferHash),
    paymentLink: copy.paymentLink,
    transferLink: copy.transferLink,
  }
}
