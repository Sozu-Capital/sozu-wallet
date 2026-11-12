/**
 * Sellable merch items. One record per hang-tag slug.
 * Price, contract, and distributor stay null until they are recorded (szw #57).
 * The page reads this record; it does not invent a price or a contract.
 */

export const LIQUID_SOCIETY_SLUG = "liquid-society"

/** Placeholder shown until the real USDC price is recorded. */
export const UNRECORDED_PRICE_USDC = "0"

export type MerchNetwork = "testnet"

export type MerchItemRecord = {
  slug: string
  name: string
  imagePath: string
  /** Fixed USDC price as a decimal string. Null until recorded. */
  priceUsdc: string | null
  drop: string
  network: MerchNetwork
  /** SEP-41 contract id (C…). Null until the token is recorded. */
  contractId: string | null
  /** Account that holds unsold units. Its balance is remaining supply. */
  distributorAddress: string | null
}

const LIQUID_SOCIETY: MerchItemRecord = {
  slug: LIQUID_SOCIETY_SLUG,
  name: "Liquid Society",
  imagePath: "/merch/liquid-society.svg",
  priceUsdc: UNRECORDED_PRICE_USDC,
  drop: "Liquid Society · 18 Nov 2026",
  network: "testnet",
  contractId: null,
  distributorAddress: null,
}

const ITEMS: readonly MerchItemRecord[] = [LIQUID_SOCIETY]

export function listMerchItems(): readonly MerchItemRecord[] {
  return ITEMS
}

export function getMerchItem(slug: string): MerchItemRecord | null {
  const key = slug.trim().toLowerCase()
  return ITEMS.find((item) => item.slug === key) ?? null
}

/** One path for the hang tag. NFC and QR both use it. */
export function merchItemPath(slug: string): string {
  return `/item/${encodeURIComponent(slug.trim().toLowerCase())}`
}
