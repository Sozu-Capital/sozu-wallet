/**
 * Faucet payout policy.
 *
 * Testnet: Circle USDC claims stay open. Cooldown may be set to 0 for rehearsal.
 * Mainnet: refused unless FAUCET_MAINNET_PILOT=1. The armed pilot can pay only
 * the pilot slug, only from the vault contract, and never more than 300 USDC
 * in total. The cap is not an env var — a mis-set FAUCET_CLAIM_AMOUNT cannot raise it.
 */

export const MAINNET_PILOT_CAP_USDC = 300
export const MAINNET_PILOT_SLUG = "mainnet-pilot"
/** Mainnet pilot keeps the per-wallet cooldown; 0 is a testnet rehearsal switch. */
export const MAINNET_MIN_USER_COOLDOWN_HOURS = 24

const USDC_MINOR = 10_000_000

export type FaucetNetwork = "testnet" | "mainnet"

export type FaucetPolicyReason =
  | "mainnet_refused"
  | "pilot_slug"
  | "pilot_cap"
  | "pilot_contract_required"
  | "invalid_amount"
  | "treasury_missing"
  | "mainnet_funder_fallback"

export class FaucetPolicyError extends Error {
  readonly reason: FaucetPolicyReason

  constructor(reason: FaucetPolicyReason) {
    super(reason)
    this.name = "FaucetPolicyError"
    this.reason = reason
  }
}

export function readFaucetNetwork(
  env: NodeJS.ProcessEnv = process.env,
): FaucetNetwork {
  return env.STELLAR_NETWORK === "mainnet" ? "mainnet" : "testnet"
}

/** Exact opt-in. Any other value, including "true", keeps mainnet closed. */
export function isMainnetPilotArmed(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.FAUCET_MAINNET_PILOT === "1"
}

export function mainnetPilotSlug(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.FAUCET_MAINNET_PILOT_SLUG?.trim().toLowerCase()
  return raw || MAINNET_PILOT_SLUG
}

export function isFaucetContractConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const id = env.FAUCET_CONTRACT_ID?.trim().toUpperCase() ?? ""
  return id.startsWith("C") && id.length === 56
}

export function usdcToMinorUnits(amount: number): bigint {
  if (!Number.isFinite(amount)) return 0n
  return BigInt(Math.round(amount * USDC_MINOR))
}

export function effectiveUserCooldownHours(
  network: FaucetNetwork,
  configuredHours: number,
): number {
  if (network === "mainnet") {
    if (!Number.isFinite(configuredHours) || configuredHours < MAINNET_MIN_USER_COOLDOWN_HOURS) {
      return MAINNET_MIN_USER_COOLDOWN_HOURS
    }
    return configuredHours
  }
  if (!Number.isFinite(configuredHours) || configuredHours < 0) return 24
  return configuredHours
}

/** Mainnet daily budget cannot exceed the pilot cap. Testnet keeps the configured budget. */
export function effectiveDailyLimitUsdc(
  network: FaucetNetwork,
  configured: number,
): number {
  if (!Number.isFinite(configured) || configured < 0) return 0
  if (network !== "mainnet") return configured
  return Math.min(configured, MAINNET_PILOT_CAP_USDC)
}

export function withinDailyBudget(remainingToday: number, payoutAmount: number): boolean {
  return payoutAmount > 0 && Number.isFinite(remainingToday) && remainingToday >= payoutAmount
}

/**
 * True when the vault can cover the claim.
 * A configured contract with an unreadable balance refuses the claim.
 * No contract skips the on-chain check (testnet direct-transfer rail only).
 */
export function vaultCoversClaim(input: {
  contractConfigured: boolean
  balanceMinor: bigint | null
  amountUsdc: number
}): boolean {
  if (!input.contractConfigured) return true
  if (input.balanceMinor === null) return false
  return input.balanceMinor >= usdcToMinorUnits(input.amountUsdc)
}

export function pilotReservedExceedsCap(
  reservedUsdc: number,
  capUsdc = MAINNET_PILOT_CAP_USDC,
): boolean {
  return usdcToMinorUnits(reservedUsdc) > usdcToMinorUnits(capUsdc)
}

export type FaucetPayoutInput = {
  network: FaucetNetwork
  pilotArmed: boolean
  slug: string
  amountUsdc: number
  /** Sum of pending + successful claims for this faucet, in USDC. */
  reservedUsdc: number
  /** True when `reservedUsdc` already includes this claim's pending row. */
  reservedIncludesAmount?: boolean
  contractConfigured: boolean
  pilotSlug?: string
}

export function decideFaucetPayout(
  input: FaucetPayoutInput,
): { ok: true } | { ok: false; reason: FaucetPolicyReason } {
  if (!Number.isFinite(input.amountUsdc) || input.amountUsdc <= 0) {
    return { ok: false, reason: "invalid_amount" }
  }

  if (input.network !== "mainnet") return { ok: true }

  if (!input.pilotArmed) return { ok: false, reason: "mainnet_refused" }

  const slug = input.slug.trim().toLowerCase()
  const pilotSlug = (input.pilotSlug ?? MAINNET_PILOT_SLUG).trim().toLowerCase()
  if (slug !== pilotSlug) return { ok: false, reason: "pilot_slug" }

  if (!input.contractConfigured) return { ok: false, reason: "pilot_contract_required" }

  const reserved = input.reservedIncludesAmount
    ? input.reservedUsdc
    : input.reservedUsdc + input.amountUsdc
  if (pilotReservedExceedsCap(reserved)) return { ok: false, reason: "pilot_cap" }

  return { ok: true }
}

export function faucetPolicyMessage(reason: FaucetPolicyReason): string {
  switch (reason) {
    case "mainnet_refused":
      return "Faucet payouts stay on testnet until the 300 USDC mainnet pilot is armed."
    case "pilot_slug":
      return "This faucet is not part of the 300 USDC mainnet pilot."
    case "pilot_cap":
      return "The 300 USDC mainnet pilot is fully claimed."
    case "pilot_contract_required":
      return "The mainnet pilot pays only from the faucet vault contract."
    case "invalid_amount":
      return "Invalid faucet amount."
    case "treasury_missing":
      return "Faucet treasury is not configured."
    case "mainnet_funder_fallback":
      return "Mainnet pilot payouts require FAUCET_TREASURY_SECRET. The testnet funder key is not a fallback."
  }
}

/**
 * Mainnet refuses the testnet funder secret. A shared key would let a testnet
 * env var sign real USDC.
 */
export function resolveFaucetTreasurySecret(input: {
  network: FaucetNetwork
  faucetTreasurySecret?: string | null
  funderSecret?: string | null
}): { ok: true; secret: string } | { ok: false; reason: "treasury_missing" | "mainnet_funder_fallback" } {
  const dedicated = input.faucetTreasurySecret?.trim() ?? ""
  if (dedicated) return { ok: true, secret: dedicated }
  if (input.network === "mainnet") {
    return {
      ok: false,
      reason: input.funderSecret?.trim() ? "mainnet_funder_fallback" : "treasury_missing",
    }
  }
  const fallback = input.funderSecret?.trim() ?? ""
  if (!fallback) return { ok: false, reason: "treasury_missing" }
  return { ok: true, secret: fallback }
}
