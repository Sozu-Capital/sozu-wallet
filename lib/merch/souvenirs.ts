import type { SavedPurchase } from "@/lib/checkout/saved-purchases"
import type { CollectibleSouvenir } from "@/lib/merch/catalog"
import { isCollectiblePurchase, resolveCollectibleSale } from "@/lib/merch/collectible-sale"
import type { MerchLanguage } from "@/lib/merch/copy"
import { buildCollectibleReceipt, type CollectibleReceiptModel } from "@/lib/merch/receipt"

export type ClaimedSouvenir = {
  slug: string
  walletAddress: string
  claimedAt: string
}

export type HeldSouvenir =
  | {
      kind: "receipt"
      id: string
      name: string
      drop: string
      receipt: CollectibleReceiptModel
    }
  | {
      kind: "badge"
      id: string
      name: string
      drop: string
      imagePath: string
    }

const KEY = "sozu.claimed-souvenirs.v1"

function storage(): Storage | null {
  if (typeof window === "undefined") return null
  return window.localStorage
}

function walletKey(address: string | null | undefined): string {
  return address?.trim().toUpperCase() ?? ""
}

export function readClaimedSouvenirs(walletAddress: string | null | undefined): ClaimedSouvenir[] {
  const wallet = walletKey(walletAddress)
  if (!wallet) return []
  const raw = storage()?.getItem(KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((row): row is ClaimedSouvenir => {
      if (!row || typeof row !== "object") return false
      const claim = row as Partial<ClaimedSouvenir>
      return (
        typeof claim.slug === "string" &&
        claim.slug.trim().length > 0 &&
        typeof claim.walletAddress === "string" &&
        walletKey(claim.walletAddress) === wallet &&
        typeof claim.claimedAt === "string" &&
        !Number.isNaN(Date.parse(claim.claimedAt))
      )
    })
  } catch {
    return []
  }
}

export function rememberClaimedSouvenir(claim: ClaimedSouvenir): void {
  const store = storage()
  const wallet = walletKey(claim.walletAddress)
  const slug = claim.slug.trim().toLowerCase()
  if (!store || !wallet || !slug || Number.isNaN(Date.parse(claim.claimedAt))) return
  const raw = store.getItem(KEY)
  let existing: ClaimedSouvenir[] = []
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    existing = Array.isArray(parsed) ? (parsed as ClaimedSouvenir[]) : []
  } catch {
    existing = []
  }
  const next = {
    slug,
    walletAddress: wallet,
    claimedAt: claim.claimedAt,
  }
  const kept = existing.filter((row) => {
    if (!row || typeof row !== "object") return false
    return !(walletKey(row.walletAddress) === wallet && row.slug?.trim().toLowerCase() === slug)
  })
  store.setItem(KEY, JSON.stringify([next, ...kept]))
}

/**
 * Bought collectibles become 3D receipts. Event badges appear only after this wallet claims them.
 * The catalog entry that has not been signed for stays claimable.
 */
export function profileSouvenirs(input: {
  purchases: readonly SavedPurchase[]
  claims: readonly ClaimedSouvenir[]
  catalog: readonly CollectibleSouvenir[]
  language: MerchLanguage
  network: "testnet" | "mainnet"
}): { held: HeldSouvenir[]; claimable: CollectibleSouvenir[] } {
  const claimed = new Set(input.claims.map((claim) => claim.slug.trim().toLowerCase()))
  const receipts: HeldSouvenir[] = input.purchases.filter(isCollectiblePurchase).map((purchase) => {
    const sale = resolveCollectibleSale({
      collectibleReceipt: purchase.collectible,
      itemName: purchase.itemName,
      editionNumber: purchase.editionNumber,
      editionSize: purchase.editionSize,
    })
    const drop = purchase.merchantName.trim() || "Sozu"
    return {
      kind: "receipt" as const,
      id: `receipt:${purchase.hash.toLowerCase()}`,
      name: sale.itemName || drop,
      drop,
      receipt: buildCollectibleReceipt({
        item: { name: sale.itemName || drop, drop, network: input.network },
        language: input.language,
        status: "paid",
        priceUsdc: purchase.amount,
        paymentHash: purchase.hash,
        transferHash: null,
        createdAt: purchase.createdAt,
        edition:
          sale.editionNumber && sale.editionSize
            ? { number: sale.editionNumber, size: sale.editionSize }
            : null,
      }),
    }
  })
  const badges: HeldSouvenir[] = []
  for (const souvenir of input.catalog) {
    if (!claimed.has(souvenir.slug.trim().toLowerCase())) continue
    badges.push({
      kind: "badge",
      id: `badge:${souvenir.slug}`,
      name: souvenir.name,
      drop: souvenir.drop,
      imagePath: souvenir.imagePath,
    })
  }
  const claimable = input.catalog.filter((souvenir) => !claimed.has(souvenir.slug.trim().toLowerCase()))
  return { held: [...receipts, ...badges], claimable }
}
