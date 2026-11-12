"use client"

import { useEffect, useState } from "react"
import { ItemPageView } from "@/components/merch/item-page-view"
import type { MerchNetwork } from "@/lib/merch/catalog"
import { buildItemPageModel } from "@/lib/merch/item-page"
import type { MerchLanguage } from "@/lib/merch/copy"

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
  name,
  imagePath,
  priceUsdc,
  network,
  remaining,
}: {
  name: string
  imagePath: string
  priceUsdc: string | null
  network: MerchNetwork
  remaining: number | null
}) {
  const [language, setLanguage] = useState<MerchLanguage>("es")

  useEffect(() => {
    setLanguage(readLanguage())
  }, [])

  const model = buildItemPageModel({
    item: { name, imagePath, priceUsdc, network },
    language,
    remaining,
  })

  return <ItemPageView model={model} />
}
