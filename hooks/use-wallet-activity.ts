"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { formatFiatAmount } from "@/lib/ledger/format-fiat"
import { getMerchItem } from "@/lib/merch/catalog"
import { buildCollectibleReceipt, type CollectibleReceiptModel } from "@/lib/merch/receipt"
import type { MerchLanguage } from "@/lib/merch/copy"
import type { MerchOrderStatus } from "@/lib/merch/order"
import type { Transaction } from "@/hooks/use-wallet-data"
import { useWalletLanguage } from "@/lib/wallet-language"

export type WalletActivityKind = "chain" | "gmail" | "manual" | "merch"

export type WalletActivityItem = {
  id: string
  sortAt: number
  kind: WalletActivityKind
  direction: "in" | "out"
  amountLabel: string
  subtitle: string
  chainTx?: Transaction
  merchReceipt?: CollectibleReceiptModel
}

type LedgerRow = {
  id: string
  date: string
  merchant: string | null
  amount: string | number
  currency: string
  type: string
  source: string
}

function ledgerKind(source: string): WalletActivityKind {
  if (source === "gmail") return "gmail"
  return "manual"
}

function chainItemsFromTransactions(
  transactions: Transaction[],
  walletAddress: string,
  currencyDisplay: string,
  addressToTagMap: Record<string, string>,
): WalletActivityItem[] {
  const wallet = walletAddress.trim().toUpperCase()
  const out: WalletActivityItem[] = []

  for (const tx of transactions) {
    const paymentOp = tx.operations.find((op) => op.type === "payment")
    if (!paymentOp) continue

    const from = paymentOp.from.trim().toUpperCase()
    const to = paymentOp.to.trim().toUpperCase()
    const isReceived = to === wallet
    const isSent = from === wallet
    if (!isReceived && !isSent) continue

    const other = isSent ? to : from
    const tag = addressToTagMap[other] ?? addressToTagMap[paymentOp.from] ?? addressToTagMap[paymentOp.to]
    const counterparty = tag ? `$${tag.replace(/^\$+/, "")}` : `${other.slice(0, 6)}…${other.slice(-4)}`

    const sortAt = Date.parse(tx.createdAt)
    out.push({
      id: `chain:${tx.id}`,
      sortAt: Number.isFinite(sortAt) ? sortAt : 0,
      kind: "chain",
      direction: isReceived ? "in" : "out",
      amountLabel: `${isReceived ? "+" : "−"}${paymentOp.amount.toFixed(2)} ${currencyDisplay}`,
      subtitle: isSent ? `To ${counterparty}` : `From ${counterparty}`,
      chainTx: tx,
    })
  }

  return out
}

function merchItemsFromOrders(
  orders: Array<{
    id: string
    slug: string
    status: MerchOrderStatus
    priceUsdc: string
    paymentHash: string | null
    transferHash: string | null
    createdAt: string | null
  }>,
  language: MerchLanguage,
): WalletActivityItem[] {
  const items: WalletActivityItem[] = []
  for (const order of orders) {
    const item = getMerchItem(order.slug)
    if (!item) continue
    const merchReceipt = buildCollectibleReceipt({
      item,
      language,
      status: order.status,
      priceUsdc: order.priceUsdc,
      paymentHash: order.paymentHash,
      transferHash: order.transferHash,
      createdAt: order.createdAt,
    })
    const sortAt = order.createdAt ? Date.parse(order.createdAt) : 0
    items.push({
      id: `merch:${order.id}`,
      sortAt: Number.isFinite(sortAt) ? sortAt : 0,
      kind: "merch",
      direction: "out",
      amountLabel: `${order.priceUsdc} USDC`,
      subtitle: merchReceipt.line,
      merchReceipt,
    })
  }
  return items
}

function ledgerItemsFromRows(rows: LedgerRow[]): WalletActivityItem[] {
  return rows.map((row) => {
    const amountNum = Number(row.amount)
    const isIncome = row.type === "income"
    const sortAt = Date.parse(row.date)
    const merchant = row.merchant?.trim() || "Sin comercio"
    return {
      id: `ledger:${row.id}`,
      sortAt: Number.isFinite(sortAt) ? sortAt : 0,
      kind: ledgerKind(row.source),
      direction: isIncome ? "in" : "out",
      amountLabel: `${isIncome ? "+" : "−"}${formatFiatAmount(Math.abs(amountNum), row.currency)}`,
      subtitle: merchant,
    }
  })
}

export function useWalletActivity(params: {
  enabled: boolean
  walletAddress: string
  currencyDisplay: string
  chainTransactions: Transaction[]
  addressToTagMap: Record<string, string>
  onRefreshChain?: () => void
}) {
  const {
    enabled,
    walletAddress,
    currencyDisplay,
    chainTransactions,
    addressToTagMap,
    onRefreshChain,
  } = params
  const { language } = useWalletLanguage()
  const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([])
  const [merchOrders, setMerchOrders] = useState<Parameters<typeof merchItemsFromOrders>[0]>([])
  const [ledgerLoading, setLedgerLoading] = useState(false)

  const refreshLedger = useCallback(async () => {
    if (!enabled) return
    setLedgerLoading(true)
    try {
      const qs = new URLSearchParams({ limit: "40", window: "month" })
      const res = await fetch(`/api/ledger/transactions?${qs}`, { cache: "no-store",
      })
      if (!res.ok) {
        setLedgerRows([])
        return
      }
      const json = await res.json()
      setLedgerRows(Array.isArray(json.transactions) ? json.transactions : [])
    } catch {
      setLedgerRows([])
    } finally {
      setLedgerLoading(false)
    }
  }, [enabled])

  const refreshMerch = useCallback(async () => {
    if (!enabled) return
    try {
      const res = await fetch("/api/merch/orders", { cache: "no-store" })
      if (!res.ok) {
        setMerchOrders([])
        return
      }
      const json = (await res.json()) as { orders?: Parameters<typeof merchItemsFromOrders>[0] }
      setMerchOrders(Array.isArray(json.orders) ? json.orders : [])
    } catch {
      setMerchOrders([])
    }
  }, [enabled])

  const refresh = useCallback(() => {
    onRefreshChain?.()
    void refreshLedger()
    void refreshMerch()
  }, [onRefreshChain, refreshLedger, refreshMerch])

  useEffect(() => {
    if (!enabled) return
    refresh()
  }, [enabled, refresh])

  const items = useMemo(() => {
    const chain = chainItemsFromTransactions(
      chainTransactions,
      walletAddress,
      currencyDisplay,
      addressToTagMap,
    )
    const ledger = ledgerItemsFromRows(ledgerRows)
    const merch = merchItemsFromOrders(merchOrders, language === "en" ? "en" : "es")
    return [...chain, ...ledger, ...merch].sort((a, b) => b.sortAt - a.sortAt)
  }, [chainTransactions, walletAddress, currencyDisplay, ledgerRows, addressToTagMap, merchOrders, language])

  return {
    items,
    loading: ledgerLoading,
    refresh,
  }
}
