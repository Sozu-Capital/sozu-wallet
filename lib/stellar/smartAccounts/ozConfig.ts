import "server-only"

import { normalizeStellarNetwork } from "@/lib/stellar/network-env"

export type OzSmartAccountNetworkConfig = {
  accountWasmHash: string
  webauthnVerifierContractId: string
  thresholdPolicyContractId: string
}

export function getOzSmartAccountConfig(): OzSmartAccountNetworkConfig {
  const isPublic = normalizeStellarNetwork(process.env.STELLAR_NETWORK || "testnet") === "mainnet"
  const suffix = isPublic ? "PUBLIC" : "TESTNET"

  const accountWasmHash =
    process.env[`OZ_SMART_ACCOUNT_WASM_HASH_${suffix}` as const]?.trim() ?? ""
  const webauthnVerifierContractId =
    process.env[`OZ_WEBAUTHN_VERIFIER_CONTRACT_ID_${suffix}` as const]?.trim() ?? ""
  const thresholdPolicyContractId =
    process.env[`OZ_THRESHOLD_POLICY_CONTRACT_ID_${suffix}` as const]?.trim() ?? ""

  if (!accountWasmHash) {
    throw new Error(`Missing OZ_SMART_ACCOUNT_WASM_HASH_${suffix}`)
  }
  if (!webauthnVerifierContractId) {
    throw new Error(`Missing OZ_WEBAUTHN_VERIFIER_CONTRACT_ID_${suffix}`)
  }
  if (!thresholdPolicyContractId) {
    throw new Error(`Missing OZ_THRESHOLD_POLICY_CONTRACT_ID_${suffix}`)
  }

  return {
    accountWasmHash,
    webauthnVerifierContractId,
    thresholdPolicyContractId,
  }
}

export function isOzSmartAccountConfigured(): boolean {
  try {
    getOzSmartAccountConfig()
    return Boolean(process.env.SOROBAN_RPC_URL?.trim() || process.env.NEXT_PUBLIC_SOROBAN_RPC_URL?.trim())
  } catch {
    return false
  }
}
