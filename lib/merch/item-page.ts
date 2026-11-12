import type { MerchItemRecord } from "@/lib/merch/catalog"
import { merchCopy, type MerchLanguage } from "@/lib/merch/copy"

export type ItemPageModel = {
  name: string
  imageUrl: string
  priceLabel: string
  buyLabel: string
  receiptLine: string
  networkLabel: string
  soldOut: boolean
  soldOutLabel: string
  buyDisabled: boolean
  /** A sold-out item never carries a payment. This slice does not build one. */
  payment: null
}

export function priceToken(priceUsdc: string | null): string {
  const trimmed = priceUsdc?.trim() ?? ""
  return trimmed.length > 0 ? trimmed : "—"
}

export function buildItemPageModel(input: {
  item: Pick<MerchItemRecord, "name" | "imagePath" | "priceUsdc" | "network">
  language: MerchLanguage
  remaining: number | null
}): ItemPageModel {
  const copy = merchCopy(input.language)
  const price = priceToken(input.item.priceUsdc)
  const soldOut = input.remaining === 0

  return {
    name: input.item.name,
    imageUrl: input.item.imagePath,
    priceLabel: `${price} USDC`,
    buyLabel: copy.buy(price),
    receiptLine: copy.receiptLine,
    networkLabel: input.item.network === "testnet" ? copy.testnet : input.item.network,
    soldOut,
    soldOutLabel: copy.soldOut,
    buyDisabled: soldOut,
    payment: null,
  }
}
