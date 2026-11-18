const TX_HASH = /^[a-f0-9]{64}$/

/** Wallet home with the profile souvenirs open on the collectible that was just paid. */
export function collectibleHomePath(transactionHash: string | null | undefined): string {
  const hash = transactionHash?.trim().toLowerCase() ?? ""
  if (!TX_HASH.test(hash)) return "/home"
  return `/home?profile=souvenirs&collectible=${hash}`
}

export function readCollectibleReturn(search: { get(name: string): string | null }): string | null {
  if (search.get("profile") !== "souvenirs") return null
  const hash = search.get("collectible")?.trim().toLowerCase() ?? ""
  return TX_HASH.test(hash) ? hash : null
}

/** Outside tap on the collectible opened from checkout closes through to wallet home. */
export function souvenirDismissesToHome(
  openSouvenirId: string | null | undefined,
  returnHash: string | null | undefined,
): boolean {
  const hash = returnHash?.trim().toLowerCase() ?? ""
  if (!openSouvenirId || !TX_HASH.test(hash)) return false
  return openSouvenirId === `receipt:${hash}`
}
