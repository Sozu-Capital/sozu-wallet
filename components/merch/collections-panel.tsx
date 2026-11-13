"use client"

import { useEffect, useState } from "react"
import { CollectionsPanelView, type CollectionCard } from "@/components/merch/collections-panel-view"
import { listMerchItems, merchItemPath } from "@/lib/merch/catalog"
import { receiptsForHoldings, type HeldOrder } from "@/lib/merch/collections"
import { merchCopy } from "@/lib/merch/copy"
import type { MerchOrderStatus } from "@/lib/merch/order"
import { useWalletLanguage } from "@/lib/wallet-language"

const STATUSES = new Set<MerchOrderStatus>([
  "awaiting_payment",
  "charging",
  "paid",
  "transferring",
  "failed",
  "completed",
])

function readOrders(payload: { orders?: unknown } | null): HeldOrder[] {
  if (!payload || !Array.isArray(payload.orders)) return []
  const orders: HeldOrder[] = []
  for (const row of payload.orders) {
    if (!row || typeof row !== "object") continue
    const order = row as Record<string, unknown>
    const slug = typeof order.slug === "string" ? order.slug : ""
    const status = typeof order.status === "string" ? order.status : ""
    const priceUsdc = typeof order.priceUsdc === "string" ? order.priceUsdc : ""
    if (!slug || !STATUSES.has(status as MerchOrderStatus) || !priceUsdc) continue
    orders.push({
      slug,
      status: status as MerchOrderStatus,
      priceUsdc,
      paymentHash: typeof order.paymentHash === "string" ? order.paymentHash : null,
      transferHash: typeof order.transferHash === "string" ? order.transferHash : null,
      createdAt: typeof order.createdAt === "string" ? order.createdAt : null,
    })
  }
  return orders
}

export function CollectionsPanel({ onLeavePrevious }: { onLeavePrevious?: () => void }) {
  const { language } = useWalletLanguage()
  const lang = language === "en" ? "en" : "es"
  const copy = merchCopy(lang)
  const drop = listMerchItems()[0]
  const [slugs, setSlugs] = useState<string[]>([])
  const [orders, setOrders] = useState<HeldOrder[]>([])

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      fetch("/api/merch/holdings", { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null),
      fetch("/api/merch/orders", { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null),
    ]).then(([holdings, orderPayload]) => {
      if (cancelled) return
      const nextSlugs = (holdings as { slugs?: unknown } | null)?.slugs
      setSlugs(Array.isArray(nextSlugs) ? nextSlugs.filter((slug) => typeof slug === "string") : [])
      setOrders(readOrders(orderPayload))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const cards: CollectionCard[] = receiptsForHoldings(listMerchItems(), slugs, orders, lang)

  return (
    <CollectionsPanelView
      title={copy.collections}
      emptyLabel={copy.emptyCollections}
      dropHref={drop ? merchItemPath(drop.slug) : "/item/liquid-society"}
      dropLabel={drop?.name ?? "Liquid Society"}
      previousLabel={copy.previousReceipt}
      nextLabel={copy.nextReceipt}
      cards={cards}
      onLeavePrevious={onLeavePrevious}
    />
  )
}
