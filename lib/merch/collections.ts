import type { MerchItemRecord } from "@/lib/merch/catalog"
import type { MerchLanguage } from "@/lib/merch/copy"
import type { MerchOrderStatus } from "@/lib/merch/order"
import { buildCollectibleReceipt, type CollectibleReceiptModel } from "@/lib/merch/receipt"

const CONTRACT = /^C[A-Z2-7]{55}$/

export type HeldOrder = {
  slug: string
  status: MerchOrderStatus
  priceUsdc: string
  paymentHash: string | null
  transferHash: string | null
  createdAt: string | null
}

export type CollectionReceipt = {
  slug: string
  receipt: CollectibleReceiptModel
}

/** Newest settled order for this item. A failed order is used only when nothing else exists. */
export function orderForHeldItem(orders: readonly HeldOrder[], slug: string): HeldOrder | null {
  const matches = orders.filter((order) => order.slug === slug)
  const settled = matches.filter((order) => order.status !== "failed")
  const pool = settled.length > 0 ? settled : matches
  let best: HeldOrder | null = null
  let bestAt = Number.NEGATIVE_INFINITY
  for (const order of pool) {
    const parsed = order.createdAt ? Date.parse(order.createdAt) : 0
    const at = Number.isFinite(parsed) ? parsed : 0
    if (!best || at >= bestAt) {
      best = order
      bestAt = at
    }
  }
  return best
}

/**
 * One receipt per held item, in holding order.
 * Streetwear and any other registered physical item use this same list.
 * Price, status, and proof hashes come from the order when the guest has one.
 */
export function receiptsForHoldings(
  items: readonly MerchItemRecord[],
  heldSlugs: readonly string[],
  orders: readonly HeldOrder[],
  language: MerchLanguage,
): CollectionReceipt[] {
  const bySlug = new Map(items.map((item) => [item.slug, item]))
  const receipts: CollectionReceipt[] = []
  for (const slug of heldSlugs) {
    const item = bySlug.get(slug)
    if (!item) continue
    const order = orderForHeldItem(orders, slug)
    receipts.push({
      slug: item.slug,
      receipt: buildCollectibleReceipt({
        item,
        language,
        status: order?.status ?? "completed",
        priceUsdc: order?.priceUsdc ?? item.priceUsdc ?? "0",
        paymentHash: order?.paymentHash ?? null,
        transferHash: order?.transferHash ?? null,
        createdAt: order?.createdAt ?? null,
      }),
    })
  }
  return receipts
}

/** Move within the receipt sequence. Previous on the first receipt leaves the panel. */
export function stepReceipt(
  index: number,
  count: number,
  direction: "next" | "previous",
): { index: number; leave: boolean } {
  if (count <= 1) return { index: 0, leave: direction === "previous" }
  if (direction === "next") {
    return index < count - 1 ? { index: index + 1, leave: false } : { index, leave: false }
  }
  return index > 0 ? { index: index - 1, leave: false } : { index: 0, leave: true }
}

/**
 * Slugs the wallet holds. Only registered item contracts count.
 * A balance for any other token is ignored. A failed read (null) is not a holding.
 */
export function heldCollectibleSlugs(
  items: readonly Pick<MerchItemRecord, "slug" | "contractId">[],
  balances: Readonly<Record<string, number | null>>,
): string[] {
  const held: string[] = []
  for (const item of items) {
    const contractId = item.contractId?.trim().toUpperCase() ?? ""
    if (!CONTRACT.test(contractId)) continue
    const balance = balances[contractId]
    if (typeof balance === "number" && Number.isFinite(balance) && balance > 0) held.push(item.slug)
  }
  return held
}
