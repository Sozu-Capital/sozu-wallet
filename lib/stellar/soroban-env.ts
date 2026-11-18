import "server-only"

import { resolveFunderSecret } from "@/lib/stellar/funder-secret"
import {
  deploymentStellarNetwork,
  resolveSorobanRpcUrlForNetwork,
} from "@/lib/stellar/network-env"
import { isOzSmartAccountConfigured } from "@/lib/stellar/smartAccounts/ozConfig"

export function resolveSorobanRpcUrl(network?: string | null): string {
  return resolveSorobanRpcUrlForNetwork(network)
}

export function isFactorySmartAccountConfigured(): boolean {
  return Boolean(
    process.env.SMART_ACCOUNT_FACTORY_ID?.trim() &&
      resolveSorobanRpcUrl() &&
      resolveFunderSecret().secret,
  )
}

export function isSmartWalletProvisioningConfigured(): boolean {
  return isFactorySmartAccountConfigured() || isOzSmartAccountConfigured()
}

export function describeMissingSmartWalletEnv(): string {
  const missing: string[] = []
  if (!resolveSorobanRpcUrl()) missing.push("SOROBAN_RPC_URL")
  const funder = resolveFunderSecret()
  if (!funder.secret) missing.push(funder.expectedEnvName)
  if (!isFactorySmartAccountConfigured() && !isOzSmartAccountConfigured()) {
    const ozSuffix = deploymentStellarNetwork() === "mainnet" ? "PUBLIC" : "TESTNET"
    missing.push(
      `SMART_ACCOUNT_FACTORY_ID (factory) or OZ_SMART_ACCOUNT_WASM_HASH_${ozSuffix} + OZ_WEBAUTHN_VERIFIER_CONTRACT_ID_${ozSuffix} + OZ_THRESHOLD_POLICY_CONTRACT_ID_${ozSuffix} (passkey)`,
    )
  }
  return missing.length
    ? `Missing in .env.local: ${missing.join(", ")}`
    : ""
}
