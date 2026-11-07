/**
 * PILOT_MAINNET: the Mujeres 2000 mainnet build. Everything outside the pilot flow
 * (receive, pay, cash out) is unreachable. Edge-safe: no Node-only imports.
 *
 * `next.config.mjs` mirrors PILOT_MAINNET into NEXT_PUBLIC_PILOT_MAINNET so client UI can hide entry points.
 */

export function isPilotMainnet(): boolean {
  return process.env.PILOT_MAINNET === "1" || process.env.NEXT_PUBLIC_PILOT_MAINNET === "1"
}

/**
 * Path prefixes that answer 404 under PILOT_MAINNET. A prefix blocks itself and everything below it,
 * so new routes added inside a disabled module are blocked by default.
 */
export const PILOT_BLOCKED_PREFIXES: readonly string[] = [
  // Backup PIN: can't sign with a passkey-native signer and is a takeover vector.
  "/api/auth/pin",
  // Smart-account address is written only server-side at provisioning.
  "/api/wallet/update-address",
  // Classic G-signer factory. New accounts are passkey signers; this route stays for old testnet rows only.
  "/api/wallet/smart-account/provision",
  "/api/wallet/stellar/sync-signer",
  // Test and debug surfaces.
  "/api/test",
  "/api/debug",
  "/api/wallet/debug-profile",
  "/api/wallet/stellar/test",
  "/test-keys",
  "/dev",
  "/public-memory-analysis",
  // Credit.
  "/api/wallet/credits",
  "/api/wallet/credit-eligibility",
  "/credit",
  "/dashboard",
  // Vouching and trust points.
  "/api/wallet/vouch",
  "/api/wallet/vouches",
  "/api/wallet/trust-points",
  "/api/claim-daily-trust-points",
  "/api/maxflow",
  // Gmail ledger and its sync cron.
  "/api/gmail",
  "/api/cron/gmail-sync",
  "/api/ledger",
  "/ledger",
  // PIZZA.
  "/api/pizza",
  "/checkout/pizza",
  // DeFindex / Blend auto-deposit.
  "/api/wallet/defindex",
  "/api/wallet/vault",
  "/defi-info",
]

export function isPilotBlockedPath(pathname: string): boolean {
  return PILOT_BLOCKED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}
