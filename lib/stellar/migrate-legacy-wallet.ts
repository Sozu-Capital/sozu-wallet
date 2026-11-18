import "server-only"

import { getStellarConfig } from "@/lib/turnkey/config"
import { getStellarWallet } from "@/lib/turnkey/stellar-wallet"
import { provisionSmartWalletForSigner } from "@/lib/stellar/smart-account-provision"
import {
  describeMissingSmartWalletEnv,
  isFactorySmartAccountConfigured,
} from "@/lib/stellar/soroban-env"
import {
  assignCanonicalSmartAccount,
  resolveCanonicalSmartAccount,
} from "@/lib/wallet/persist-canonical-smart-account"

export type CanonicalWalletRow = {
  publicKey: string
  signerPublicKey: string | null
  walletType: "factory" | "oz" | "legacy"
  network: "testnet" | "mainnet"
  migrated: boolean
}

/**
 * Ensures stellar_wallets.public_key is a factory smart account (C…).
 * Legacy G rows are replaced via SMART_ACCOUNT_FACTORY_ID deploy.
 */
export async function ensureFactorySmartWalletForUser(
  userId: string,
  signerHint?: string | null,
): Promise<CanonicalWalletRow | { error: string }> {
  const existing = await getStellarWallet(userId, true)
  const pk = existing?.publicKey?.trim().toUpperCase() ?? ""

  const canonical = await resolveCanonicalSmartAccount(userId).catch(() => null)
  if (canonical && !(pk.startsWith("C") && pk.length === 56)) {
    await assignCanonicalSmartAccount(userId, canonical.contractId, { wallet_type: "oz" })
    return {
      publicKey: canonical.contractId,
      signerPublicKey: existing?.signerPublicKey?.trim().toUpperCase() ?? null,
      walletType: "oz",
      network: existing?.network ?? getStellarConfig().network,
      migrated: canonical.source === "org_treasury",
    }
  }

  if (pk.startsWith("C") && pk.length === 56) {
    const wt =
      existing?.walletType === "oz"
        ? "oz"
        : existing?.walletType === "factory"
          ? "factory"
          : "factory"
    return {
      publicKey: pk,
      signerPublicKey: existing?.signerPublicKey?.trim().toUpperCase() ?? null,
      walletType: wt,
      network: existing?.network ?? getStellarConfig().network,
      migrated: false,
    }
  }

  const signer =
    signerHint?.trim().toUpperCase() ||
    existing?.signerPublicKey?.trim().toUpperCase() ||
    (pk.startsWith("G") ? pk : null)

  if (!signer?.startsWith("G") || signer.length !== 56) {
    return {
      error:
        "Passkey signer (G…) required to deploy smart account. Sign in again with your passkey.",
    }
  }

  if (!isFactorySmartAccountConfigured()) {
    return {
      error:
        describeMissingSmartWalletEnv() ||
        "Smart account factory is not configured (SMART_ACCOUNT_FACTORY_ID, SOROBAN_RPC_URL, STELLAR_FUNDER_SECRET).",
    }
  }

  const provisioned = await provisionSmartWalletForSigner(signer)
  if ("error" in provisioned) {
    return { error: provisioned.error }
  }

  const contractId = provisioned.contractId.trim().toUpperCase()
  let assigned: { contractId: string }
  try {
    assigned = await assignCanonicalSmartAccount(userId, contractId, {
      signer_public_key: provisioned.signerPublicKey,
      wallet_type: "factory",
      turnkey_wallet_id: null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (!message.includes("signer_public_key")) {
      return { error: `Smart account ${contractId} deployed but DB update failed: ${message}` }
    }
    try {
      assigned = await assignCanonicalSmartAccount(userId, contractId, {
        wallet_type: "factory",
        turnkey_wallet_id: null,
      })
    } catch (retryErr) {
      const retryMessage = retryErr instanceof Error ? retryErr.message : String(retryErr)
      return { error: `Smart account ${contractId} deployed but DB update failed: ${retryMessage}` }
    }
  }

  console.log("[migrate-legacy-wallet] ✅ G → C for user", userId.slice(0, 8), assigned.contractId.slice(0, 12))

  return {
    publicKey: assigned.contractId,
    signerPublicKey: provisioned.signerPublicKey,
    walletType: "factory",
    network: getStellarConfig().network,
    migrated: true,
  }
}
