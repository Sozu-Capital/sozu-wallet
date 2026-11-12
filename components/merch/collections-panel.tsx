"use client"

import { useEffect, useState } from "react"
import { CollectionsPanelView, type CollectionCard } from "@/components/merch/collections-panel-view"
import { getMerchItem, listMerchItems, merchItemPath } from "@/lib/merch/catalog"
import { merchCopy, type MerchLanguage } from "@/lib/merch/copy"
import { buildCollectibleReceipt } from "@/lib/merch/receipt"
import { useWalletLanguage } from "@/lib/wallet-language"

export function CollectionsPanel() {
  const { language } = useWalletLanguage()
  const copy = merchCopy(language === "en" ? "en" : "es")
  const drop = listMerchItems()[0]
  const [slugs, setSlugs] = useState<string[]>([])
  const [openSlug, setOpenSlug] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetch("/api/merch/holdings", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { slugs?: string[] } | null) => {
        if (!cancelled) setSlugs(Array.isArray(payload?.slugs) ? payload.slugs : [])
      })
      .catch(() => {
        if (!cancelled) setSlugs([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const cards: CollectionCard[] = []
  for (const slug of slugs) {
    const item = getMerchItem(slug)
    if (!item) continue
    const lang: MerchLanguage = language === "en" ? "en" : "es"
    cards.push({
      slug: item.slug,
      name: item.name,
      networkLabel: lang === "en" ? "Testnet" : "Red de pruebas",
      receipt: buildCollectibleReceipt({
        item,
        language: lang,
        status: "completed",
        priceUsdc: item.priceUsdc ?? "0",
        paymentHash: null,
        transferHash: null,
      }),
    })
  }

  return (
    <CollectionsPanelView
      title={copy.collections}
      emptyLabel={copy.emptyCollections}
      dropHref={drop ? merchItemPath(drop.slug) : "/item/liquid-society"}
      dropLabel={drop?.name ?? "Liquid Society"}
      cards={cards}
      openSlug={openSlug}
      onOpen={(slug) => setOpenSlug((current) => (current === slug ? null : slug))}
    />
  )
}
