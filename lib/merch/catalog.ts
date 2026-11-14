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
export const LIQUID_SOCIETY_DROP = "Liquid Society · 18 Nov 2026"

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
}

const SHIRT: MerchItemRecord = {
  slug: LIQUID_SOCIETY_SLUG,
  name: "Shirt",
  imagePath: "/merch/liquid-society.svg",
  priceUsdc: "15",
  preMintSupply: 10,
  drop: LIQUID_SOCIETY_DROP,
  network: "testnet",
  contractId: null,
  distributorAddress: null,
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
