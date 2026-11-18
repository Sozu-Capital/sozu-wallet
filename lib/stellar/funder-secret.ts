import "server-only"

import { Keypair } from "@stellar/stellar-sdk"
import type { StellarNetwork } from "@/lib/stellar/asset-types"
import { normalizeStellarNetwork } from "@/lib/stellar/network-env"

/** Classic G that pays Soroban fees on testnet. */
export const FUNDER_SECRET_TESTNET_ENV = "STELLAR_FUNDER_SECRET_TESTNET"
/** Classic G that pays Soroban fees on mainnet (public network). */
export const FUNDER_SECRET_MAINNET_ENV = "STELLAR_FUNDER_SECRET_MAINNET"
/** Alias accepted for mainnet so a `PUBLIC` suffix matches the OZ env names. */
export const FUNDER_SECRET_PUBLIC_ALIAS_ENV = "STELLAR_FUNDER_SECRET_PUBLIC"
/**
 * Single-network fallback. Used only when the network-specific secret is unset.
 * One value cannot pay fees on both testnet and mainnet.
 */
export const FUNDER_SECRET_LEGACY_ENV = "STELLAR_FUNDER_SECRET"

export type FunderSecretResolution = {
  secret: string | null
  /** Env var the secret was read from. Null when none is set. */
  envName: string | null
  /** Env var to set for this network. */
  expectedEnvName: string
  network: StellarNetwork
}

function trimEnv(name: string): string | null {
  const value = process.env[name]?.trim()
  return value ? value : null
}

/**
 * Fee-payer secret for one Stellar network.
 * Prefer STELLAR_FUNDER_SECRET_TESTNET / STELLAR_FUNDER_SECRET_MAINNET so both
 * keys can live in the same environment. STELLAR_FUNDER_SECRET is the fallback
 * when the specific name is unset (older single-network deploys).
 */
export function resolveFunderSecret(network?: string | null): FunderSecretResolution {
  const net = normalizeStellarNetwork(network)
  const expectedEnvName = net === "mainnet" ? FUNDER_SECRET_MAINNET_ENV : FUNDER_SECRET_TESTNET_ENV
  const names =
    net === "mainnet"
      ? [FUNDER_SECRET_MAINNET_ENV, FUNDER_SECRET_PUBLIC_ALIAS_ENV]
      : [FUNDER_SECRET_TESTNET_ENV]

  for (const name of names) {
    const secret = trimEnv(name)
    if (secret) {
      return { secret, envName: name, expectedEnvName, network: net }
    }
  }

  const legacy = trimEnv(FUNDER_SECRET_LEGACY_ENV)
  if (legacy) {
    return { secret: legacy, envName: FUNDER_SECRET_LEGACY_ENV, expectedEnvName, network: net }
  }

  return { secret: null, envName: null, expectedEnvName, network: net }
}

export function readFunderSecret(network?: string | null): string | null {
  return resolveFunderSecret(network).secret
}

export function hasFunderSecret(network?: string | null): boolean {
  return Boolean(readFunderSecret(network))
}

export function funderKeypairFromResolution(
  resolved: FunderSecretResolution,
): Keypair | null {
  if (!resolved.secret) return null
  try {
    return Keypair.fromSecret(resolved.secret)
  } catch {
    return null
  }
}

export function invalidFunderSecretMessage(resolved: FunderSecretResolution): string {
  return `${resolved.envName ?? resolved.expectedEnvName} is not a valid Stellar secret key.`
}

export function missingFunderSecretMessage(resolved: FunderSecretResolution): string {
  return (
    `${resolved.expectedEnvName} is not set. ` +
    `Testnet and mainnet each need their own fee-payer secret ` +
    `(${FUNDER_SECRET_TESTNET_ENV} and ${FUNDER_SECRET_MAINNET_ENV}).`
  )
}
