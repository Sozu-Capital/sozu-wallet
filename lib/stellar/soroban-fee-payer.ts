import "server-only"

import type { Keypair } from "@stellar/stellar-sdk"
import * as rpc from "@stellar/stellar-sdk/rpc"
import { getStellarConfig } from "@/lib/turnkey/config"
import {
  funderKeypairFromResolution,
  resolveFunderSecret,
  type FunderSecretResolution,
} from "@/lib/stellar/funder-secret"
import { resolveSorobanRpcUrlForNetwork } from "@/lib/stellar/network-env"
import type { StellarNetwork } from "@/lib/stellar/asset-types"

function funderResolution(network?: string | null): FunderSecretResolution {
  return resolveFunderSecret(network)
}

/** Classic G that pays Soroban fees for `network` (or the deployment network). */
export function getConfiguredFunderPublicKey(network?: string | null): string | null {
  return funderKeypairFromResolution(funderResolution(network))?.publicKey() ?? null
}

/** Server keypair for co-signing Soroban envelopes whose `source` is the funder G. */
export function getFunderKeypair(network?: string | null): Keypair | null {
  return funderKeypairFromResolution(funderResolution(network))
}

async function sorobanAccountExists(publicKey: string, network: StellarNetwork): Promise<boolean> {
  const rpcUrl = resolveSorobanRpcUrlForNetwork(network)
  const server = new rpc.Server(rpcUrl, { allowHttp: network === "testnet" })
  try {
    await server.getAccount(publicKey.trim().toUpperCase())
    return true
  } catch {
    return false
  }
}

/** Fund a testnet G via Friendbot when it has no on-chain account yet. */
export async function ensureTestnetAccountFunded(publicKey: string): Promise<void> {
  const pk = publicKey.trim().toUpperCase()
  if (!pk.startsWith("G") || pk.length !== 56) {
    throw new Error("Invalid G address for Friendbot funding.")
  }

  if (await sorobanAccountExists(pk, "testnet")) {
    return
  }

  const cfg = getStellarConfig()
  if (cfg.network !== "testnet") {
    throw new Error(
      `Account ${pk.slice(0, 8)}… is not active on the network. Fund it with XLM before sending.`,
    )
  }

  const friendbotUrl = `${cfg.horizonUrl.replace(/\/$/, "")}/friendbot?addr=${encodeURIComponent(pk)}`
  const res = await fetch(friendbotUrl, { redirect: "follow" })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(
      `Could not fund passkey signer ${pk.slice(0, 8)}… on testnet (Friendbot ${res.status}). ${body.slice(0, 200)}`,
    )
  }

  if (!(await sorobanAccountExists(pk, "testnet"))) {
    throw new Error(
      `Friendbot returned success but account ${pk.slice(0, 8)}… is still missing. Retry in a few seconds.`,
    )
  }
}

function funderMissingOnNetworkMessage(
  resolved: FunderSecretResolution,
  publicKey: string,
): string {
  const prefix = publicKey.slice(0, 8)
  const where = `${resolved.envName ?? resolved.expectedEnvName} account ${prefix}… is not on ${resolved.network}.`
  if (resolved.envName === "STELLAR_FUNDER_SECRET") {
    return (
      `${where} Set ${resolved.expectedEnvName} to a classic G funded with XLM on ${resolved.network}. ` +
      "A single STELLAR_FUNDER_SECRET cannot pay fees on both testnet and mainnet."
    )
  }
  return `${where} Fund ${prefix}… with XLM on ${resolved.network}.`
}

/**
 * Soroban txs need a funded classic G as `source` (fee payer).
 * OZ smart accounts (C) authorize via passkey; signer G does not need USDC.
 *
 * - Default: use the fee-payer G for this network (passkey G may be unfunded).
 * - Factory G-signer path: must use passkey G as source → fund on testnet if needed.
 */
export async function resolveSorobanFeePayer(params: {
  signerPublicKey: string
  network: StellarNetwork | string
  requireSignerAsSource?: boolean
}): Promise<{ feePayer: string; usedFunder: boolean }> {
  const resolved = resolveFunderSecret(params.network)
  const network = resolved.network
  const signer = params.signerPublicKey.trim().toUpperCase()
  if (!signer.startsWith("G") || signer.length !== 56) {
    throw new Error("Passkey signer (G…) is required for Soroban payments.")
  }

  if (params.requireSignerAsSource) {
    if (network === "testnet") {
      await ensureTestnetAccountFunded(signer)
    } else if (!(await sorobanAccountExists(signer, network))) {
      throw new Error(
        `Signer account ${signer.slice(0, 8)}… is not on ${network}. Fund it with XLM first.`,
      )
    }
    return { feePayer: signer, usedFunder: false }
  }

  if (resolved.secret) {
    const funderKp = funderKeypairFromResolution(resolved)
    if (!funderKp) {
      throw new Error(`${resolved.envName} is not a valid Stellar secret key.`)
    }
    const funder = funderKp.publicKey()
    if (!(await sorobanAccountExists(funder, network))) {
      throw new Error(funderMissingOnNetworkMessage(resolved, funder))
    }
    return { feePayer: funder, usedFunder: true }
  }

  if (network === "testnet") {
    await ensureTestnetAccountFunded(signer)
  } else if (!(await sorobanAccountExists(signer, network))) {
    throw new Error(
      `No ${resolved.expectedEnvName} configured and signer ${signer.slice(0, 8)}… is not on mainnet.`,
    )
  }

  return { feePayer: signer, usedFunder: false }
}
