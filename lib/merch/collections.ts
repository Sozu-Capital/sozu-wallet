import type { MerchItemRecord } from "@/lib/merch/catalog"

const CONTRACT = /^C[A-Z2-7]{55}$/

/**
 * Slugs the wallet holds. Only registered item contracts count.
 * A balance for any other token is ignored. A failed read (null) is not a holding.
 */
export function heldCollectibleSlugs(
  items: readonly Pick<MerchItemRecord, "slug" | "contractId">[],
  balances: Readonly<Record<string, number | null>>,
): string[] {
  const held: string[] = []
  for (const item of items) {
    const contractId = item.contractId?.trim().toUpperCase() ?? ""
    if (!CONTRACT.test(contractId)) continue
    const balance = balances[contractId]
    if (typeof balance === "number" && Number.isFinite(balance) && balance > 0) held.push(item.slug)
  }
  return held
}
