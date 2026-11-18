"use client"

import { getDefaultAssetRegistry } from "@/lib/stellar/asset-registry-core"
import { getStellarConfig } from "@/lib/turnkey/config"
import { getUserId } from "@/lib/wallet-utils"

function circleSacContractId(): string {
  const network = getStellarConfig().network
  const asset = getDefaultAssetRegistry(network).find((row) => row.id === "circle_usdc_sac")
  if (!asset?.contractId) {
    throw new Error("Circle USDC is not available on this network")
  }
  return asset.contractId
}

/**
 * Build, passkey-sign, and submit one Circle SAC transfer.
 * The contract id is explicit, so Blend and Sozu Test USDC are not selected.
 */
export async function sendCircleSacPayment(params: {
  from: string
  to: string
  amount: string
}): Promise<string> {
  const contractId = circleSacContractId()
  const buildResponse = await fetch("/api/wallet/stellar/payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      destination: params.to,
      amount: params.amount,
      sender: params.from,
      contractId,
    }),
  })
  if (!buildResponse.ok) {
    const error = (await buildResponse.json().catch(() => ({}))) as { error?: string }
    throw new Error(error.error || "Failed to build the Circle USDC payment")
  }

  const build = (await buildResponse.json()) as Record<string, unknown>
  const unsignedXdr =
    typeof build.unsignedXdr === "string"
      ? build.unsignedXdr
      : typeof build.envelopeXdr === "string"
        ? build.envelopeXdr
        : null
  if (!unsignedXdr) throw new Error("No unsigned transaction returned")

  const signMethod = typeof build.signMethod === "string" ? build.signMethod : undefined
  const signerPublicKey =
    typeof build.signerPublicKey === "string" && build.signerPublicKey.startsWith("G")
      ? build.signerPublicKey
      : null

  const { getCurrentCredentialId, storeCredentialIdInSession } = await import(
    "@/lib/storage/key-utils"
  )
  const credentialId =
    (typeof build.ozCredentialId === "string" ? build.ozCredentialId : null) ||
    (await getCurrentCredentialId(signerPublicKey ?? undefined))
  if (!credentialId) {
    throw new Error("Passkey credential not found. Sign in with passkey, then retry.")
  }
  storeCredentialIdInSession(credentialId)

  const walletContractId =
    typeof build.walletAddress === "string" && build.walletAddress.startsWith("C")
      ? build.walletAddress.trim().toUpperCase()
      : params.from.trim().toUpperCase()

  const { getStellarConfig: readConfig } = await import("@/lib/turnkey/config")
  const stellarConfig = readConfig()
  const { Networks } = await import("@stellar/stellar-sdk")
  const networkPassphrase =
    stellarConfig.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET

  let signedEnvelopeXdr: string
  if (signMethod === "oz_passkey" || signMethod === "oz_passkey_local") {
    const { getSmartAccountKit } = await import("@/lib/stellar/smartAccounts/client")
    const { signSorobanPreparedTxWithPasskey } = await import(
      "@/lib/stellar/smartAccounts/signSorobanUsdc"
    )
    const { extractSorobanDataXdr } = await import("@/lib/stellar/soroban-prepared-envelope")
    const { kit, config } = await getSmartAccountKit()
    const sorobanDataXdr =
      typeof build.sorobanDataXdr === "string" && build.sorobanDataXdr.length > 0
        ? build.sorobanDataXdr
        : extractSorobanDataXdr(unsignedXdr, config.networkPassphrase)
    signedEnvelopeXdr = await signSorobanPreparedTxWithPasskey({
      kit,
      unsignedXdr,
      sorobanDataXdr,
      networkPassphrase: config.networkPassphrase,
      credentialId,
      smartAccountContractId: walletContractId,
      webauthnVerifierAddress: config.webauthnVerifierAddress,
      supportsOzKitApi: build.supportsOzKitApi === true,
      signMethod: signMethod ?? "oz_passkey",
    })
  } else if (signMethod === "smart_g_signer") {
    const userId = getUserId()
    if (!signerPublicKey || !userId) {
      throw new Error("Passkey signer missing. Sign in with passkey on this device.")
    }
    const { signSorobanUsdcWithGSigner } = await import(
      "@/lib/stellar/smartAccounts/signSorobanTransferG"
    )
    signedEnvelopeXdr = await signSorobanUsdcWithGSigner({
      unsignedXdr,
      signerPublicKey,
      credentialId,
      userId,
      networkPassphrase,
    })
  } else {
    throw new Error(`Unsupported sign method: ${signMethod ?? "unknown"}`)
  }

  const submitResponse = await fetch("/api/wallet/stellar/payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signedEnvelopeXdr }),
  })
  if (!submitResponse.ok) {
    const submitErr = (await submitResponse.json().catch(() => ({}))) as { error?: string }
    throw new Error(submitErr.error || "Failed to submit the Circle USDC payment")
  }
  const result = (await submitResponse.json()) as { success?: boolean; transactionHash?: string }
  const txHash = typeof result.transactionHash === "string" ? result.transactionHash.trim() : ""
  if (!result.success || !/^[a-fA-F0-9]{64}$/.test(txHash)) {
    throw new Error("Circle USDC payment did not return a transaction hash")
  }
  return txHash.toLowerCase()
}
