import "server-only"

import type { StellarNetwork } from "@/lib/stellar/asset-types"
import { contractIsFactoryForSigner } from "@/lib/stellar/factory-smart-account"
import { contractSupportsOzKitSigning } from "@/lib/stellar/supports-oz-kit-contract"
import { getStellarConfig } from "@/lib/turnkey/config"
import { getStellarWallet } from "@/lib/turnkey/stellar-wallet"
import { minorToDecimalString } from "@/lib/withdraw/amount"
import { withdrawSignMethod, type WithdrawSignMethod } from "@/lib/withdraw/sign-method"
import { parseWithdrawDestination, type WithdrawDestination } from "@/lib/withdraw/destination"
import { evaluateClassicDestination, fetchHorizonAccount } from "@/lib/withdraw/destination-check"
import { contractInstanceExists, readExactTokenBalance } from "@/lib/withdraw/exact-transfer"
import { getWithdrawUsdcAsset, type WithdrawUsdcAsset } from "@/lib/withdraw/usdc-asset"

export type WithdrawSender = {
  senderC: string
  signerPk: string
  ozCredentialId: string | null
}

export type PreparedWithdraw = {
  network: StellarNetwork
  sender: WithdrawSender
  destination: WithdrawDestination
  asset: WithdrawUsdcAsset
  feePayer: string
  balanceMinor: bigint
  signMethod: WithdrawSignMethod
  supportsOzKitApi: boolean
}

export type WithdrawFailure = { ok: false; status: number; code: string; detail?: string }

/** Who is withdrawing — always from the session user's DB wallet, never from the request body. */
export async function resolveWithdrawSender(
  userId: string,
  network: StellarNetwork,
): Promise<{ ok: true; sender: WithdrawSender } | WithdrawFailure> {
  const wallet = await getStellarWallet(userId, true)
  if (!wallet?.publicKey) return { ok: false, status: 404, code: "wallet_not_found" }
  const senderC = wallet.publicKey.trim().toUpperCase()
  if (!senderC.startsWith("C")) return { ok: false, status: 422, code: "wallet_must_be_smart_account" }
  if (wallet.network && wallet.network !== network) return { ok: false, status: 409, code: "network_mismatch" }
  const signerPk = wallet.signerPublicKey?.trim().toUpperCase()
  if (!signerPk?.startsWith("G")) return { ok: false, status: 422, code: "smart_signer_required" }
  return { ok: true, sender: { senderC, signerPk, ozCredentialId: wallet.ozCredentialId?.trim() || null } }
}

/**
 * Everything withdraw-all knows before building: parsed destination, exact on-chain USDC balance,
 * and destination pre-checks (exists, trustline, room) against that exact amount.
 */
export async function prepareWithdrawAll(params: {
  userId: string
  address: unknown
  memo: unknown
}): Promise<({ ok: true } & PreparedWithdraw) | WithdrawFailure> {
  const parsed = parseWithdrawDestination(
    typeof params.address === "string" ? params.address : "",
    typeof params.memo === "string" ? params.memo : "",
  )
  if (!parsed.ok) return { ok: false, status: 400, code: parsed.code }
  const destination = parsed.destination

  const cfg = getStellarConfig()
  const network = cfg.network
  const resolved = await resolveWithdrawSender(params.userId, network)
  if (!resolved.ok) return resolved
  const { sender } = resolved
  if (destination.baseAddress === sender.senderC) return { ok: false, status: 400, code: "self_destination" }

  const asset = getWithdrawUsdcAsset(network)
  const supportsOzKitApi = await contractSupportsOzKitSigning(sender.senderC)
  const isFactoryOnChain = await contractIsFactoryForSigner(sender.senderC, sender.signerPk)
  const signMethod = withdrawSignMethod(supportsOzKitApi, isFactoryOnChain)
  const { resolveSorobanFeePayer } = await import("@/lib/stellar/soroban-fee-payer")
  const { feePayer } = await resolveSorobanFeePayer({
    signerPublicKey: sender.signerPk,
    network,
    requireSignerAsSource: signMethod === "smart_g_signer",
  })

  const balanceMinor = await readExactTokenBalance({
    contractId: asset.contractId,
    holder: sender.senderC,
    sourceAccount: feePayer,
    network,
  })
  if (balanceMinor <= BigInt(0)) return { ok: false, status: 409, code: "no_balance" }

  try {
    if (destination.kind === "contract") {
      if (!(await contractInstanceExists(destination.baseAddress, network))) {
        return { ok: false, status: 422, code: "contract_not_found" }
      }
    } else {
      const account = await fetchHorizonAccount(cfg.horizonUrl, destination.baseAddress)
      const check = evaluateClassicDestination(account, destination.baseAddress, asset, balanceMinor)
      if (!check.ok) return { ok: false, status: 422, code: check.code }
    }
  } catch (err) {
    return {
      ok: false,
      status: 502,
      code: "destination_check_failed",
      detail: err instanceof Error ? err.message : String(err),
    }
  }

  return { ok: true, network, sender, destination, asset, feePayer, balanceMinor, signMethod, supportsOzKitApi }
}

export function withdrawSummary(p: PreparedWithdraw) {
  return {
    address: p.destination.address,
    kind: p.destination.kind,
    baseAddress: p.destination.baseAddress,
    transferTo: p.destination.transferTo,
    memoId: p.destination.memoId,
    amountMinor: p.balanceMinor.toString(),
    amountDisplay: minorToDecimalString(p.balanceMinor, p.asset.decimals),
    assetCode: p.asset.code,
    network: p.network,
  }
}
