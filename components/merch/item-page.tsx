"use client"

import { useEffect, useState } from "react"
import { ItemPageView } from "@/components/merch/item-page-view"
import { isClientAuthed } from "@/lib/client-auth-gate"
import type { MerchNetwork } from "@/lib/merch/catalog"
import { decideBuy, ordinaryUsdcFromBalance, parsePriceUsdc } from "@/lib/merch/buy-gate"
import { buildItemPageModel } from "@/lib/merch/item-page"
import type { MerchLanguage } from "@/lib/merch/copy"
import { isPilotMainnet } from "@/lib/pilot/pilot-mainnet"

const LANGUAGE_KEY = "sozu_app_language:v2"

function readLanguage(): MerchLanguage {
  try {
    const stored = localStorage.getItem(LANGUAGE_KEY)
    return stored === "en" ? "en" : "es"
  } catch {
    return "es"
  }
}

export function ItemPage({
  slug,
  name,
  imagePath,
  priceUsdc,
  network,
  remaining,
}: {
  slug: string
  name: string
  imagePath: string
  priceUsdc: string | null
  network: MerchNetwork
  remaining: number | null
}) {
  const [language, setLanguage] = useState<MerchLanguage>("es")
  const [hasSession, setHasSession] = useState(false)
  const [ordinaryUsdc, setOrdinaryUsdc] = useState<number | null>(null)
  const [balanceKnown, setBalanceKnown] = useState(false)

  useEffect(() => {
    setLanguage(readLanguage())
  }, [])

  useEffect(() => {
    const authed = isClientAuthed()
    setHasSession(authed)
    if (!authed) {
      setBalanceKnown(false)
      setOrdinaryUsdc(null)
      return
    }

    let cancelled = false
    void fetch("/api/wallet/stellar/balance", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { displayWalletUsdc?: unknown } | null) => {
        if (cancelled) return
        const ordinary = payload ? ordinaryUsdcFromBalance(payload) : null
        setOrdinaryUsdc(ordinary)
        setBalanceKnown(ordinary != null)
      })
      .catch(() => {
        if (!cancelled) setBalanceKnown(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const model = buildItemPageModel({
    item: { name, imagePath, priceUsdc, network },
    language,
    remaining,
  })

  const gate = decideBuy({
    hasSession,
    balanceKnown,
    slug,
    language,
    itemNetwork: network,
    walletNetwork: isPilotMainnet() ? "mainnet" : "testnet",
    priceUsdc: parsePriceUsdc(priceUsdc),
    ordinaryUsdc,
  })

  return <ItemPageView model={model} gate={gate} />
}
