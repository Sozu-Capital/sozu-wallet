import { Networks } from "@stellar/stellar-sdk"
import type { StellarNetwork } from "@/lib/stellar/asset-types"

const TESTNET_RPC = "https://soroban-testnet.stellar.org"
const MAINNET_RPC = "https://mainnet.sorobanrpc.com"
const TESTNET_HORIZON = "https://horizon-testnet.stellar.org"
const MAINNET_HORIZON = "https://horizon.stellar.org"

const MAINNET_NAMES = new Set([
  "mainnet",
  "public",
  "pubnet",
  "stellar:pubnet",
  "stellar:public",
])

/**
 * Map Stellar network aliases onto the two networks this wallet pays on.
 * `public` and `pubnet` are mainnet. Unknown empty input follows STELLAR_NETWORK.
 */
export function normalizeStellarNetwork(raw?: string | null): StellarNetwork {
  const value = (raw ?? "").trim().toLowerCase()
  if (!value) {
    const fromEnv = (process.env.STELLAR_NETWORK || "testnet").trim().toLowerCase()
    if (!fromEnv || fromEnv === value) return "testnet"
    return normalizeStellarNetwork(fromEnv)
  }
  if (MAINNET_NAMES.has(value)) return "mainnet"
  if (value === "testnet" || value === "stellar:testnet") return "testnet"
  if (value.includes("testnet") || value.includes("futurenet")) return "testnet"
  if (value.includes("mainnet") || value.includes("public") || value.includes("pubnet")) {
    return "mainnet"
  }
  return "testnet"
}

export function deploymentStellarNetwork(): StellarNetwork {
  return normalizeStellarNetwork(process.env.STELLAR_NETWORK || "testnet")
}

export function stellarNetworkPassphrase(network?: string | null): string {
  return normalizeStellarNetwork(network ?? process.env.STELLAR_NETWORK ?? "testnet") === "mainnet"
    ? Networks.PUBLIC
    : Networks.TESTNET
}

function endpointHost(url: string): string {
  try {
    return new URL(url).host.toLowerCase()
  } catch {
    return url.toLowerCase()
  }
}

/** True when a Horizon or Soroban URL belongs on `network`. Custom hosts follow the deployment network. */
export function endpointMatchesNetwork(url: string, network: StellarNetwork): boolean {
  const host = endpointHost(url)
  const testnetHost = host.includes("testnet") || host.includes("futurenet")
  const mainnetHost =
    host === "horizon.stellar.org" ||
    host === "soroban.stellar.org" ||
    host === "soroban-mainnet.stellar.org" ||
    host.includes("mainnet") ||
    host.includes("pubnet")
  if (testnetHost) return network === "testnet"
  if (mainnetHost) return network === "mainnet"
  return network === deploymentStellarNetwork()
}

function firstMatching(urls: Array<string | undefined>, network: StellarNetwork): string | null {
  for (const url of urls) {
    const trimmed = url?.trim()
    if (trimmed && endpointMatchesNetwork(trimmed, network)) return trimmed
  }
  return null
}

/**
 * Soroban RPC for `network`.
 * Network-specific vars win. A generic SOROBAN_RPC_URL is used only when its host
 * belongs on that network, so a testnet URL cannot be the mainnet fee-payer RPC.
 */
export function resolveSorobanRpcUrlForNetwork(network?: string | null): string {
  const net = normalizeStellarNetwork(network ?? process.env.STELLAR_NETWORK ?? "testnet")
  if (net === "mainnet") {
    return (
      process.env.SOROBAN_RPC_URL_MAINNET?.trim() ||
      firstMatching(
        [process.env.SOROBAN_RPC_URL, process.env.NEXT_PUBLIC_SOROBAN_RPC_URL],
        "mainnet",
      ) ||
      MAINNET_RPC
    )
  }
  return (
    process.env.SOROBAN_RPC_URL_TESTNET?.trim() ||
    firstMatching(
      [process.env.SOROBAN_RPC_URL, process.env.NEXT_PUBLIC_SOROBAN_RPC_URL],
      "testnet",
    ) ||
    TESTNET_RPC
  )
}

export function resolveHorizonUrlForNetwork(network?: string | null): string {
  const net = normalizeStellarNetwork(network ?? process.env.STELLAR_NETWORK ?? "testnet")
  if (net === "mainnet") {
    return (
      process.env.STELLAR_HORIZON_URL_MAINNET?.trim() ||
      firstMatching([process.env.STELLAR_HORIZON_URL], "mainnet") ||
      MAINNET_HORIZON
    )
  }
  return (
    process.env.STELLAR_HORIZON_URL_TESTNET?.trim() ||
    firstMatching([process.env.STELLAR_HORIZON_URL], "testnet") ||
    TESTNET_HORIZON
  )
}
