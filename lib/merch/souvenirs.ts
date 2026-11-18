import type { SavedPurchase } from "@/lib/checkout/saved-purchases"
import type { CollectibleSouvenir } from "@/lib/merch/catalog"
import { isCollectiblePurchase, resolveCollectibleSale } from "@/lib/merch/collectible-sale"
import type { MerchLanguage } from "@/lib/merch/copy"
import { buildCollectibleReceipt, type CollectibleReceiptModel } from "@/lib/merch/receipt"
import { isSouvenirClaimOpen, souvenirSlugKey } from "@/lib/merch/souvenir-window"

export type ClaimedSouvenir = {
  slug: string
  walletAddress: string
  claimedAt: string
  name?: string
  drop?: string
  imagePath?: string
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
  const next: ClaimedSouvenir = {
    slug,
    walletAddress: wallet,
    claimedAt: claim.claimedAt,
    ...(claim.name ? { name: claim.name } : {}),
    ...(claim.drop ? { drop: claim.drop } : {}),
    ...(claim.imagePath ? { imagePath: claim.imagePath } : {}),
  }
  const kept = existing.filter((row) => {
    if (!row || typeof row !== "object") return false
    return !(walletKey(row.walletAddress) === wallet && row.slug?.trim().toLowerCase() === slug)
  })
  store.setItem(KEY, JSON.stringify([next, ...kept]))
}

/**
 * Bought collectibles become 3D receipts. Event badges appear only after this account claims them.
 * A claim is once per account. After that the badge stays collected even when the window closes.
 * Unclaimed catalog entries are offered only while their timeframe is open.
 */
export function profileSouvenirs(input: {
  purchases: readonly SavedPurchase[]
  claims: readonly ClaimedSouvenir[]
  catalog: readonly CollectibleSouvenir[]
  language: MerchLanguage
  network: "testnet" | "mainnet"
  nowMs?: number
}): { held: HeldSouvenir[]; claimable: CollectibleSouvenir[] } {
  const nowMs = input.nowMs ?? Date.now()
  const catalogBySlug = new Map(input.catalog.map((souvenir) => [souvenirSlugKey(souvenir.slug), souvenir]))
  const claimed = new Map<string, ClaimedSouvenir>()
  for (const claim of input.claims) {
    const slug = souvenirSlugKey(claim.slug)
    if (slug) claimed.set(slug, claim)
  }
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
        imageUrl: purchase.imageUrl,
      }),
    }
  })
  const badges: HeldSouvenir[] = []
  for (const [slug, claim] of claimed) {
    const souvenir = catalogBySlug.get(slug)
    badges.push({
      kind: "badge",
      id: `badge:${souvenir?.slug ?? slug}`,
      name: souvenir?.name || claim.name || slug,
      drop: souvenir?.drop || claim.drop || "",
      imagePath: souvenir?.imagePath || claim.imagePath || "",
    })
  }
  const claimable = input.catalog.filter((souvenir) => {
    const slug = souvenirSlugKey(souvenir.slug)
    if (claimed.has(slug)) return false
    return isSouvenirClaimOpen(souvenir, nowMs)
  })
  return { held: [...receipts, ...badges], claimable }
}
