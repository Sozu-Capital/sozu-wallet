export type SavedPurchase = {
  hash: string
  merchantName: string
  itemName: string
  amount: string
  createdAt: string
  /** True only for a product whose payment link opted into a collectible receipt. */
  collectible?: boolean
  /** Numbered run. Both are set, or neither is. */
  editionNumber?: number
  editionSize?: number
  /** Account that received the USDC. Used to reopen the receipt from history. */
  toAddress?: string
  /** Merchant photo shown on the collectible receipt. */
  imageUrl?: string
}

function isEditionNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
}

const KEY = "sozu.checkout-purchases.v1"
const MAX_SAVED = 20

function storage(): Storage | null {
  if (typeof window === "undefined") return null
  return window.localStorage
}

export function readSavedPurchases(): SavedPurchase[] {
  const raw = storage()?.getItem(KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((row): row is SavedPurchase => {
      if (!row || typeof row !== "object") return false
      const purchase = row as Partial<SavedPurchase>
      return (
        typeof purchase.hash === "string" &&
        /^[a-fA-F0-9]{64}$/.test(purchase.hash) &&
        typeof purchase.merchantName === "string" &&
        typeof purchase.itemName === "string" &&
        typeof purchase.amount === "string" &&
        typeof purchase.createdAt === "string" &&
        (purchase.collectible === undefined || typeof purchase.collectible === "boolean") &&
        (purchase.toAddress === undefined || typeof purchase.toAddress === "string") &&
        ((purchase.editionNumber === undefined && purchase.editionSize === undefined) ||
          (isEditionNumber(purchase.editionNumber) &&
            isEditionNumber(purchase.editionSize) &&
            purchase.editionNumber <= purchase.editionSize))
      )
    })
  } catch {
    return []
  }
}

export function rememberCheckoutPurchase(purchase: SavedPurchase): void {
  const store = storage()
  if (!store) return
  const hash = purchase.hash.trim().toLowerCase()
  if (!/^[a-f0-9]{64}$/.test(hash)) return
  const edition =
    isEditionNumber(purchase.editionNumber) &&
    isEditionNumber(purchase.editionSize) &&
    purchase.editionNumber <= purchase.editionSize
      ? { editionNumber: purchase.editionNumber, editionSize: purchase.editionSize }
      : {}
  const next = [
    { ...purchase, ...edition, hash, collectible: purchase.collectible === true },
    ...readSavedPurchases().filter((row) => row.hash.toLowerCase() !== hash),
  ].slice(0, MAX_SAVED)
  store.setItem(KEY, JSON.stringify(next))
}
