"use client"

import type { SmartAccountKit } from "smart-account-kit"
import { rpc, xdr } from "@stellar/stellar-sdk"
import { Client as SmartAccountClient } from "smart-account-kit-bindings"
import { deriveOzContractIdForUser, ozDeploySalt } from "@/lib/stellar/smartAccounts/oz-deploy-id"
import { getUserId } from "@/lib/wallet-utils"
import {
  buildExternalSignerKeyData,
  resolveCredentialIdBytes,
} from "@/lib/stellar/smartAccounts/passkeyPublicKey"

/** Kit fields used for deploy — avoid intersecting SmartAccountKit (private fields break types). */
type KitDeployInternals = {
  deployerKeypair: { publicKey(): string }
  networkPassphrase: string
  rpcUrl: string
  accountWasmHash: string
  webauthnVerifierAddress: string
  timeoutInSeconds?: number
  signWithDeployer: (tx: { sign: (opts: unknown) => Promise<void>; signed?: unknown; send: () => Promise<unknown> }) => Promise<void>
  setConnectedState?: (contractId: string, credentialId: string) => void
  initializeWallet?: (contractId: string) => void
}

function asDeployKit(kit: SmartAccountKit): KitDeployInternals {
  return kit as unknown as KitDeployInternals
}

function sorobanServer(rpcUrl: string): rpc.Server {
  return new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") })
}

export { deriveOzContractIdForUser, ozDeploySalt } from "@/lib/stellar/smartAccounts/oz-deploy-id"

export async function isOzContractDeployedOnChain(
  rpcUrl: string,
  contractId: string,
): Promise<boolean> {
  try {
    await sorobanServer(rpcUrl).getContractData(
      contractId,
      xdr.ScVal.scvLedgerKeyContractInstance(),
    )
    return true
  } catch {
    return false
  }
}

async function waitForContractOnChain(rpcUrl: string, contractId: string, maxMs = 45_000): Promise<void> {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    if (await isOzContractDeployedOnChain(rpcUrl, contractId)) return
    await new Promise((r) => setTimeout(r, 1500))
  }
  throw new Error(
    `Deployed smart account ${contractId.slice(0, 8)}… is not visible on Soroban RPC yet. Retry wallet setup in a moment.`,
  )
}

function isContractAlreadyExistsError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.includes("ExistingValue") || msg.includes("contract already exists")
}

function activateKitWallet(
  kit: KitDeployInternals,
  contractId: string,
  credentialId: string,
): void {
  kit.setConnectedState?.(contractId, credentialId)
  kit.initializeWallet?.(contractId)
}

/**
 * Deploy OZ smart account with user-scoped salt (not kit default hash(credentialId) only).
 */
export async function deployOzSmartAccountForUser(params: {
  kit: SmartAccountKit
  credentialId: string
  publicKey65: Uint8Array
  userId: string
}): Promise<{ contractId: string }> {
  const kit = asDeployKit(params.kit)
  const derivedId = deriveOzContractIdForUser({
    credentialId: params.credentialId,
    userId: params.userId,
    networkPassphrase: kit.networkPassphrase,
    deployerPublicKey: kit.deployerKeypair.publicKey(),
  })

  if (await isOzContractDeployedOnChain(kit.rpcUrl, derivedId)) {
    activateKitWallet(kit, derivedId, params.credentialId)
    return { contractId: derivedId }
  }

  // Match smart-account-kit: suffix is raw credential id bytes (prefer stored rawId).
  const credentialIdBuffer = resolveCredentialIdBytes(params.credentialId)
  const salt = ozDeploySalt(params.credentialId, params.userId)
  const keyData = buildExternalSignerKeyData(params.publicKey65, credentialIdBuffer)
  const signer = {
    tag: "External" as const,
    values: [kit.webauthnVerifierAddress, keyData] as [string, Buffer],
  }

  try {
    const deployTx = await SmartAccountClient.deploy(
      { signers: [signer], policies: new Map() },
      {
        networkPassphrase: kit.networkPassphrase,
        rpcUrl: kit.rpcUrl,
        wasmHash: kit.accountWasmHash,
        publicKey: kit.deployerKeypair.publicKey(),
        salt,
        timeoutInSeconds: kit.timeoutInSeconds ?? 30,
      },
    )

    await kit.signWithDeployer(deployTx as Parameters<KitDeployInternals["signWithDeployer"]>[0])
    const signedXdr = (deployTx as { signed?: { toXDR?: () => string } }).signed?.toXDR?.()
    if (!signedXdr) {
      throw new Error("Deploy transaction was not signed.")
    }
    const userId = getUserId()
    const sponsored = await fetch("/api/smart-accounts/submit-deploy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(userId ? { "x-user-id": userId } : {}),
      },
      body: JSON.stringify({ signedXdr }),
    })
    const sponsoredBody = (await sponsored.json().catch(() => ({}))) as { error?: string }
    if (!sponsored.ok) {
      throw new Error(
        sponsoredBody.error ||
          "Could not sponsor the smart account. The fee payer pays this create, and the deployer account has no XLM.",
      )
    }

    await waitForContractOnChain(kit.rpcUrl, derivedId)
    activateKitWallet(kit, derivedId, params.credentialId)
    return { contractId: derivedId }
  } catch (err) {
    if (isContractAlreadyExistsError(err) || (await isOzContractDeployedOnChain(kit.rpcUrl, derivedId))) {
      activateKitWallet(kit, derivedId, params.credentialId)
      return { contractId: derivedId }
    }
    throw err
  }
}
