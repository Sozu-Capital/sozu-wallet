const USDC = /^\d+(\.\d{1,7})?$/

/** A positive USDC amount the phone can lock, without trailing zeros. */
export function normalizeOfflineUsdc(raw: string): string | null {
  const text = raw.trim()
  if (!USDC.test(text)) return null
  const value = Number(text)
  if (!Number.isFinite(value) || value <= 0) return null
  const [whole, frac = ""] = text.split(".")
  const trimmedFrac = frac.replace(/0+$/, "")
  const normalizedWhole = String(Number(whole))
  return trimmedFrac ? `${normalizedWhole}.${trimmedFrac}` : normalizedWhole
}

export function offlineAmountFits(usdc: string, balance: number | null): boolean {
  if (balance == null) return true
  const amount = Number(usdc)
  return Number.isFinite(amount) && amount <= balance + 1e-7
}

/** Opens the Sozu offline app on this same passkey account, with the chosen limit. */
export function offlinePhoneLink(address: string, usdc: string): string | null {
  const amount = normalizeOfflineUsdc(usdc)
  const account = address.trim().toUpperCase()
  if (!amount || !/^[CG][A-Z2-7]{55}$/.test(account)) return null
  if (!offlineAmountFits(amount, null)) return null
  return `sozu://link?addr=${encodeURIComponent(account)}&usdc=${encodeURIComponent(amount)}`
}

/** Chrome on Android opens the installed app from this intent URL. */
export function offlineAndroidIntent(address: string, usdc: string): string | null {
  const link = offlinePhoneLink(address, usdc)
  if (!link) return null
  const body = link.slice("sozu://".length)
  return `intent://${body}#Intent;scheme=sozu;package=capital.sozu.mesh;end`
}
