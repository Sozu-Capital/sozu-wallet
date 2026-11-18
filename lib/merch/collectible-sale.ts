import type { SavedPurchase } from "@/lib/checkout/saved-purchases"
import { coerceEdition, editionFromName, editionMark, itemNameWithoutEdition } from "@/lib/merch/edition-label"

export type ResolvedCollectibleSale = {
  collectible: boolean
  itemName: string
  editionNumber?: number
  editionSize?: number
}

/** A numbered run is a collectible even when the payment link omitted the toggle. */
export function resolveCollectibleSale(input: {
  collectibleReceipt?: boolean
  itemName?: string | null
  editionNumber?: unknown
  editionSize?: unknown
}): ResolvedCollectibleSale {
  const rawName = input.itemName?.trim() ?? ""
  const fromName = editionFromName(rawName)
  const fromFields = coerceEdition(input.editionNumber, input.editionSize)
  const edition = fromFields ?? (fromName ? { number: fromName.number, size: fromName.size } : null)
  const mark = edition ? editionMark(edition.number, edition.size) : null
  const itemName = fromName?.name || itemNameWithoutEdition(rawName, mark)
  return {
    collectible: input.collectibleReceipt === true || edition != null,
    itemName,
    ...(edition ? { editionNumber: edition.number, editionSize: edition.size } : {}),
  }
}

export function isCollectiblePurchase(
  purchase: Pick<SavedPurchase, "collectible" | "itemName" | "editionNumber" | "editionSize">,
): boolean {
  return resolveCollectibleSale({
    collectibleReceipt: purchase.collectible,
    itemName: purchase.itemName,
    editionNumber: purchase.editionNumber,
    editionSize: purchase.editionSize,
  }).collectible
}
