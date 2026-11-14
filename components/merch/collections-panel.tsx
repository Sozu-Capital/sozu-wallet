"use client"

import { useEffect, useState } from "react"
import { CollectionsPanelView, type CollectionCard } from "@/components/merch/collections-panel-view"
import { useWalletDataContext } from "@/components/wallet/wallet-data-provider"
import { readSavedPurchases } from "@/lib/checkout/saved-purchases"
import { CITY_SPOTS, projectCityDots } from "@/lib/city/spots"
import { listMerchItems, merchItemPath, UNRECORDED_PRICE_USDC } from "@/lib/merch/catalog"
import { receiptsForHoldings, type HeldOrder } from "@/lib/merch/collections"
import { merchCopy } from "@/lib/merch/copy"
import { purchasePlaceholderReceipts, type PurchaseTransfer } from "@/lib/merch/purchase-receipts"
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

function transfersFromHistory(history: unknown): PurchaseTransfer[] {
  if (!Array.isArray(history)) return []
  const transfers: PurchaseTransfer[] = []
  for (const row of history) {
    if (!row || typeof row !== "object") continue
    const tx = row as { hash?: unknown; createdAt?: unknown; operations?: unknown }
    if (typeof tx.hash !== "string" || !Array.isArray(tx.operations)) continue
    for (const op of tx.operations) {
      if (!op || typeof op !== "object") continue
      const payment = op as { type?: unknown; from?: unknown; to?: unknown; amount?: unknown; asset?: unknown }
      if (payment.type !== "payment") continue
      if (typeof payment.from !== "string" || typeof payment.to !== "string") continue
      if (typeof payment.amount !== "number" || typeof payment.asset !== "string") continue
      transfers.push({
        hash: tx.hash,
        createdAt: typeof tx.createdAt === "string" ? tx.createdAt : new Date().toISOString(),
        from: payment.from,
        to: payment.to,
        amount: payment.amount,
        asset: payment.asset,
      })
    }
  }
  return transfers
}

export function CollectionsPanel({ onLeavePrevious }: { onLeavePrevious?: () => void }) {
  const { language } = useWalletLanguage()
  const lang = language === "en" ? "en" : "es"
  const copy = merchCopy(lang)
  const { walletAddress, walletNetwork, transactionHistory, fetchTransactionHistory } = useWalletDataContext()
  const [slugs, setSlugs] = useState<string[]>([])
  const [orders, setOrders] = useState<HeldOrder[]>([])

  useEffect(() => {
    if (walletAddress) void fetchTransactionHistory(walletAddress)
  }, [walletAddress, fetchTransactionHistory])

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

  const catalog = listMerchItems()
  const held: CollectionCard[] = receiptsForHoldings(catalog, slugs, orders, lang)
  const placeholders = walletAddress
    ? purchasePlaceholderReceipts({
        wallet: walletAddress,
        transfers: transfersFromHistory(transactionHistory),
        saved: readSavedPurchases(),
        language: lang,
        network: walletNetwork === "mainnet" ? "mainnet" : "testnet",
        skipHashes: orders.map((order) => order.paymentHash).filter((hash): hash is string => Boolean(hash)),
      })
    : []
  const cards: CollectionCard[] = [...placeholders, ...held]
  const findItems = catalog.map((item) => ({
    href: merchItemPath(item.slug),
    name: item.name,
    drop: item.drop,
    imageUrl: item.imagePath,
    priceLabel: item.priceUsdc && item.priceUsdc !== UNRECORDED_PRICE_USDC ? `${item.priceUsdc} USDC` : null,
    excerpt: copy.receiptLine,
    tags: [copy.testnet],
    actionLabel: copy.findOpen,
  }))

  return (
    <CollectionsPanelView
      title={copy.collections}
      nearLabel={copy.findNear}
      cityLabel={copy.findCity}
      findItems={findItems}
      cityDots={projectCityDots(CITY_SPOTS)}
      previousLabel={copy.previousReceipt}
      nextLabel={copy.nextReceipt}
      cards={cards}
      onLeavePrevious={onLeavePrevious}
    />
  )
}
