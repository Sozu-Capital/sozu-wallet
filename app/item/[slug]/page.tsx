import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ItemPage } from "@/components/merch/item-page"
import { getMerchItem } from "@/lib/merch/catalog"
import { remainingSupply } from "@/lib/merch/supply"

export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const item = getMerchItem(slug)
  return { title: item ? `${item.name} — Sozu` : "Sozu" }
}

export default async function MerchItemPage({ params }: PageProps) {
  const { slug } = await params
  const item = getMerchItem(slug)
  if (!item) notFound()

  const remaining = await remainingSupply(item)

  return (
    <ItemPage
      slug={item.slug}
      name={item.name}
      imagePath={item.imagePath}
      priceUsdc={item.priceUsdc}
      network={item.network}
      remaining={remaining}
    />
  )
}
