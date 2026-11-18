import "server-only"

import type { StellarNetwork } from "@/lib/stellar/asset-types"
import { contractIsFactoryForSigner } from "@/lib/stellar/factory-smart-account"
import { contractSupportsOzKitSigning } from "@/lib/stellar/supports-oz-kit-contract"
import { buildExactTokenTransfer } from "@/lib/withdraw/exact-transfer"
import { decimalStringToMinor } from "@/lib/withdraw/amount"
import type { WithdrawSender } from "@/lib/withdraw/prepare-withdraw"
import { withdrawSignMethod } from "@/lib/withdraw/sign-method"
import { getWithdrawUsdcAsset } from "@/lib/withdraw/usdc-asset"

export type MerchPaymentBuild = {
  unsignedXdr: string
  sorobanDataXdr: string | null
  signMethod: string
  supportsOzKitApi: boolean
  signerPublicKey: string | null
  walletAddress: string
  ozCredentialId: string | null
  feePayerPublicKey: string
}

/** Unsigned USDC transfer of the recorded item price, from the session wallet to the merch address. */
export async function prepareMerchPaymentBuild(params: {
  sender: WithdrawSender
  priceUsdc: string
  destination: string
  network: StellarNetwork
}): Promise<{ ok: true; build: MerchPaymentBuild } | { ok: false; status: number; code: string }> {
  const asset = getWithdrawUsdcAsset(params.network)
  const amountMinor = decimalStringToMinor(params.priceUsdc, asset.decimals)
  if (amountMinor == null || amountMinor <= BigInt(0)) {
    return { ok: false, status: 409, code: "price_unrecorded" }
  }

  const supportsOzKitApi = await contractSupportsOzKitSigning(params.sender.senderC)
  const isFactoryOnChain = params.sender.signerPk.startsWith("G")
    ? await contractIsFactoryForSigner(params.sender.senderC, params.sender.signerPk)
    : false
  const signMethod = withdrawSignMethod(supportsOzKitApi, isFactoryOnChain)
  const { resolveSorobanFeePayer } = await import("@/lib/stellar/soroban-fee-payer")
  const { feePayer } = await resolveSorobanFeePayer({
    signerPublicKey: params.sender.signerPk,
    network: params.network,
    requireSignerAsSource: signMethod === "smart_g_signer",
  })
  const { unsignedXdr, sorobanDataXdr } = await buildExactTokenTransfer({
    contractId: asset.contractId,
    from: params.sender.senderC,
    to: params.destination,
    amountMinor,
    feePayer,
    network: params.network,
  })

  return {
    ok: true,
    build: {
      unsignedXdr,
      sorobanDataXdr,
      signMethod,
      supportsOzKitApi,
      signerPublicKey: params.sender.signerPk.startsWith("G") ? params.sender.signerPk : null,
      walletAddress: params.sender.senderC,
      ozCredentialId: params.sender.ozCredentialId,
      feePayerPublicKey: feePayer,
    },
  }
}
