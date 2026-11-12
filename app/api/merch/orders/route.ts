import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/session"
import { MerchOrderStoreUnavailableError, supabaseMerchOrderStore } from "@/lib/db/merch-orders"
import { getMerchItem } from "@/lib/merch/catalog"
import { merchUsdcAddress } from "@/lib/merch/destination"
import { confirmMerchOrder, isMerchAttemptId, openMerchOrder, type MerchOrder } from "@/lib/merch/order"
import { prepareMerchPaymentBuild } from "@/lib/merch/payment-build"
import { sendOneCollectible } from "@/lib/merch/send-collectible"
import { deliverMerchCollectible } from "@/lib/merch/transfer"
import { parseSacTransferEnvelope } from "@/lib/stellar/parse-sac-transfer-envelope"
import { submitSignedSorobanEnvelope } from "@/lib/stellar/send-token"
import { decimalStringToMinor } from "@/lib/withdraw/amount"
import { resolveWithdrawSender } from "@/lib/withdraw/prepare-withdraw"
import { getWithdrawUsdcAsset, networkPassphraseFor } from "@/lib/withdraw/usdc-asset"

function orderBody(order: MerchOrder) {
  return {
    id: order.id,
    status: order.status,
    paymentHash: order.paymentHash,
    failureReason: order.failureReason,
    priceUsdc: order.priceUsdc,
    destination: order.destination,
    payer: order.payer,
    transferAttempted: order.transferAttempted,
    transferHash: order.transferHash,
  }
}

async function settleCollectible(order: MerchOrder): Promise<MerchOrder> {
  if (order.status !== "paid") return order
  const delivered = await deliverMerchCollectible(order, supabaseMerchOrderStore, sendOneCollectible)
  return delivered.ok ? delivered.order : order
}

/** Confirm Buy: one USDC payment per attempt. The payer is the session wallet. */
export async function POST(request: NextRequest) {
  const auth = requireSession(request)
  if (auth.error) return auth.error

  try {
    const body = await request.json().catch(() => ({}))
    const slug = typeof body?.slug === "string" ? body.slug : ""
    const attemptId = typeof body?.attemptId === "string" ? body.attemptId : ""
    const item = getMerchItem(slug)
    if (!item || item.priceUsdc == null) {
      return NextResponse.json({ success: false, code: "unknown_item" }, { status: 404 })
    }
    if (!isMerchAttemptId(attemptId)) {
      return NextResponse.json({ success: false, code: "invalid_attempt" }, { status: 400 })
    }

    const destination = merchUsdcAddress()
    if (!destination) {
      return NextResponse.json({ success: false, code: "merch_address_unrecorded" }, { status: 409 })
    }

    const asset = getWithdrawUsdcAsset(item.network)
    const amountMinor = decimalStringToMinor(item.priceUsdc, asset.decimals)
    if (amountMinor == null || amountMinor <= BigInt(0)) {
      return NextResponse.json({ success: false, code: "price_unrecorded" }, { status: 409 })
    }

    const resolved = await resolveWithdrawSender(auth.userId, item.network)
    if (!resolved.ok) {
      return NextResponse.json({ success: false, code: resolved.code }, { status: resolved.status })
    }

    const input = {
      userId: auth.userId,
      attemptId,
      slug: item.slug,
      payer: resolved.sender.senderC,
      priceUsdc: item.priceUsdc,
      destination,
    }
    const envelope = typeof body?.signedEnvelopeXdr === "string" ? body.signedEnvelopeXdr.trim() : ""

    if (!envelope) {
      const opened = await openMerchOrder(input, supabaseMerchOrderStore)
      if (!opened.ok) return NextResponse.json({ success: false, code: opened.code }, { status: 400 })
      if (opened.order.status !== "awaiting_payment") {
        const settled = await settleCollectible(opened.order)
        return NextResponse.json({ success: true, order: orderBody(settled), submitted: false })
      }
      const built = await prepareMerchPaymentBuild({
        sender: resolved.sender,
        priceUsdc: item.priceUsdc,
        destination,
        network: item.network,
      })
      if (!built.ok) {
        return NextResponse.json({ success: false, code: built.code, order: orderBody(opened.order) }, { status: built.status })
      }
      return NextResponse.json({ success: true, order: orderBody(opened.order), build: built.build, submitted: false })
    }

    const parsed = parseSacTransferEnvelope(envelope, networkPassphraseFor(item.network))
    if (!parsed.ok) {
      return NextResponse.json({ success: false, code: "invalid_envelope", reason: parsed.reason }, { status: 400 })
    }
    const intent = parsed.intent
    if (
      intent.contractId !== asset.contractId ||
      intent.from !== resolved.sender.senderC ||
      intent.to !== destination ||
      intent.amountMinor !== amountMinor
    ) {
      return NextResponse.json({ success: false, code: "envelope_mismatch" }, { status: 422 })
    }

    const confirmed = await confirmMerchOrder(input, supabaseMerchOrderStore, async () => {
      const hash = await submitSignedSorobanEnvelope(envelope)
      return { ok: true, hash }
    })
    if (!confirmed.ok) return NextResponse.json({ success: false, code: confirmed.code }, { status: 400 })
    const settled = await settleCollectible(confirmed.order)
    return NextResponse.json({
      success: settled.status === "paid" || settled.status === "completed",
      order: orderBody(settled),
      submitted: confirmed.submitted,
    })
  } catch (err) {
    if (err instanceof MerchOrderStoreUnavailableError) {
      return NextResponse.json({ success: false, code: "orders_unavailable" }, { status: 503 })
    }
    const reason = err instanceof Error ? err.message : "payment_failed"
    console.error("[merch/orders]", reason)
    return NextResponse.json({ success: false, code: "payment_failed" }, { status: 500 })
  }
}
