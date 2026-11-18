import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/session"
import { supabaseIdempotencyStore } from "@/lib/db/idempotency"
import { lookupSorobanLedger, submitSignedSorobanEnvelope } from "@/lib/stellar/send-token"
import { getStellarConfig } from "@/lib/turnkey/config"
import { parseMinorAmount } from "@/lib/withdraw/amount"
import { parseWithdrawDestination } from "@/lib/withdraw/destination"
import { resolveWithdrawSender } from "@/lib/withdraw/prepare-withdraw"
import { submitWithdraw } from "@/lib/withdraw/submit-withdraw"
import { getWithdrawUsdcAsset, networkPassphraseFor } from "@/lib/withdraw/usdc-asset"

/** Withdraw-all step 3: submit her passkey-signed transfer once per idempotency key. */
export async function POST(request: NextRequest) {
  const auth = requireSession(request)
  if (auth.error) return auth.error
  try {
    const body = await request.json().catch(() => ({}))
    const parsed = parseWithdrawDestination(
      typeof body?.address === "string" ? body.address : "",
      typeof body?.memo === "string" ? body.memo : "",
    )
    if (!parsed.ok) return NextResponse.json({ success: false, code: parsed.code }, { status: 400 })
    const amountMinor = parseMinorAmount(body?.amountMinor)
    if (amountMinor == null || amountMinor <= BigInt(0)) {
      return NextResponse.json({ success: false, code: "invalid_amount" }, { status: 400 })
    }

    const network = getStellarConfig().network
    const resolved = await resolveWithdrawSender(auth.userId, network)
    if (!resolved.ok) return NextResponse.json({ success: false, code: resolved.code }, { status: resolved.status })

    const result = await submitWithdraw({
      userId: auth.userId,
      idempotencyKey: body?.idempotencyKey,
      signedEnvelopeXdr: body?.signedEnvelopeXdr,
      expected: {
        contractId: getWithdrawUsdcAsset(network).contractId,
        from: resolved.sender.senderC,
        to: parsed.destination.transferTo,
        amountMinor,
      },
      networkPassphrase: networkPassphraseFor(network),
      store: supabaseIdempotencyStore,
      submitEnvelope: submitSignedSorobanEnvelope,
      lookupLedger: lookupSorobanLedger,
    })
    return NextResponse.json(result.body, {
      status: result.status,
      headers: result.replayed ? { "Idempotent-Replayed": "true" } : undefined,
    })
  } catch (e) {
    console.error("[withdraw/submit] error:", e)
    return NextResponse.json({ success: false, code: "internal_error" }, { status: 500 })
  }
}
