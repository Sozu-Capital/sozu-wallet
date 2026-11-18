/**
 * Sellable merch items. One record per hang-tag slug.
 * Prices recorded by Joaquín on 13 Nov 2026 (szw #57):
 * the Liquid Society shirt is 15 USDC, pre-mint 10;
 * the 5-panel is 8 USDC, pre-mint supply not stated.
 * Contract, distributor, and the merch address stay empty until he records them.
 * The page reads this record. It does not invent a contract or a supply.
 */

export const LIQUID_SOCIETY_SLUG = "liquid-society"
export const FIVE_PANEL_SLUG = "five-panel"
/** Final checkout for the Liquid Society shirt. */
export const LIQUID_SOCIETY_TEE_URL = "https://pay.sozu.capital/pay/qr/unblck/defi-your-mind-tee"
export const LIQUID_SOCIETY_DROP = "Liquid Society · 18 Nov 2026"
export const LIQUID_SOCIETY_ACTIVATION_SLUG = "liquid-society-event"

/** Placeholder shown until a USDC price is recorded. */
export const UNRECORDED_PRICE_USDC = "0"

export type MerchNetwork = "testnet"

export type MerchItemRecord = {
  slug: string
  name: string
  imagePath: string
  /** Fixed USDC price as a decimal string. Null until recorded. */
  priceUsdc: string | null
  /**
   * Units to pre-mint. Null until Joaquín records a number.
   * This is not the live balance. Remaining stock is the distributor balance.
   */
  preMintSupply: number | null
  drop: string
  network: MerchNetwork
  /** SEP-41 contract id (C…). Null until the token is recorded. */
  contractId: string | null
  /** Account that holds unsold units. Its balance is remaining supply. */
  distributorAddress: string | null
  /** Public product page. Absent items stay on the in-app hang-tag path. */
  productUrl?: string | null
}

const SHIRT: MerchItemRecord = {
  slug: LIQUID_SOCIETY_SLUG,
  name: "T-shirt",
  imagePath: "/merch/liquid-society.svg",
  priceUsdc: "15",
  preMintSupply: 10,
  drop: LIQUID_SOCIETY_DROP,
  network: "testnet",
  contractId: null,
  distributorAddress: null,
  productUrl: LIQUID_SOCIETY_TEE_URL,
}

const FIVE_PANEL: MerchItemRecord = {
  slug: FIVE_PANEL_SLUG,
  name: "5-panel",
  imagePath: "/merch/five-panel.svg",
  priceUsdc: "8",
  preMintSupply: null,
  drop: LIQUID_SOCIETY_DROP,
  network: "testnet",
  contractId: null,
  distributorAddress: null,
}

const ITEMS: readonly MerchItemRecord[] = [SHIRT, FIVE_PANEL]

/** One event. The collectibles page shows this card, then the items it offers. */
export type CollectibleSouvenir = {
  slug: string
  name: string
  drop: string
  imagePath: string
  /** Inclusive start of the one-time claim window. */
  claimStartsAt: string
  /** Exclusive end of the claim window. After this, unclaimed copies disappear. */
  claimEndsAt: string
}

export type MerchActivation = {
  slug: string
  name: string
  drop: string
  imagePath: string
  /** Physical items offered at the activation, in display order. */
  itemSlugs: readonly string[]
}

const LIQUID_SOCIETY_ACTIVATION: MerchActivation = {
  slug: LIQUID_SOCIETY_ACTIVATION_SLUG,
  name: "Liquid Society",
  drop: LIQUID_SOCIETY_DROP,
  imagePath: "/merch/liquid-society-event.svg",
  itemSlugs: [LIQUID_SOCIETY_SLUG, FIVE_PANEL_SLUG],
}

const ACTIVATIONS: readonly MerchActivation[] = [LIQUID_SOCIETY_ACTIVATION]

export function listMerchItems(): readonly MerchItemRecord[] {
  return ITEMS
}

export function listActivations(): readonly MerchActivation[] {
  return ACTIVATIONS
}

/** Event badges come from SozuPay launches, not this hang-tag catalog. */
export function listCollectibleSouvenirs(): readonly CollectibleSouvenir[] {
  return []
}

export function getMerchItem(slug: string): MerchItemRecord | null {
  const key = slug.trim().toLowerCase()
  return ITEMS.find((item) => item.slug === key) ?? null
}

/** One path for the hang tag. NFC and QR both use it. */
export function merchItemPath(slug: string): string {
  return `/item/${encodeURIComponent(slug.trim().toLowerCase())}`
}

/** Where the collectibles page opens an offered item. */
export function merchOfferHref(item: Pick<MerchItemRecord, "slug" | "productUrl">): string {
  const url = item.productUrl?.trim()
  return url ? url : merchItemPath(item.slug)
}
