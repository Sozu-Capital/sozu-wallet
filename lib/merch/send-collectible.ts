import "server-only"

import { Keypair, Transaction, TransactionBuilder } from "@stellar/stellar-sdk"
import { getMerchItem } from "@/lib/merch/catalog"
import type { MerchOrder, PaymentSubmitResult } from "@/lib/merch/order"
import { submitSignedSorobanEnvelope } from "@/lib/stellar/send-token"
import { buildExactTokenTransfer } from "@/lib/withdraw/exact-transfer"
import { networkPassphraseFor } from "@/lib/withdraw/usdc-asset"

const CONTRACT = /^C[A-Z2-7]{55}$/

function distributorKeypair(env: NodeJS.ProcessEnv): Keypair | null {
  const secret = env.MERCH_DISTRIBUTOR_SECRET?.trim() ?? ""
  if (!secret) return null
  try {
    return Keypair.fromSecret(secret)
  } catch {
    return null
  }
}

/** Server-signed transfer of exactly one pre-minted unit. The secret never leaves this module. */
export async function sendOneCollectible(order: MerchOrder): Promise<PaymentSubmitResult> {
  const item = getMerchItem(order.slug)
  const distributor = distributorKeypair(process.env)
  const contractId = item?.contractId?.trim().toUpperCase() ?? ""
  if (!item || !distributor || !CONTRACT.test(contractId)) {
    return { ok: false, reason: "receipt_pending" }
  }

  const { unsignedXdr } = await buildExactTokenTransfer({
    contractId,
    from: distributor.publicKey(),
    to: order.payer,
    amountMinor: BigInt(1),
    feePayer: distributor.publicKey(),
    network: item.network,
  })
  const parsed = TransactionBuilder.fromXDR(unsignedXdr, networkPassphraseFor(item.network))
  if (!(parsed instanceof Transaction)) return { ok: false, reason: "receipt_pending" }
  parsed.sign(distributor)
  const hash = await submitSignedSorobanEnvelope(parsed.toXDR())
  return { ok: true, hash }
}
