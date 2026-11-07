import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/session"
import { parseMinorAmount } from "@/lib/withdraw/amount"
import { buildExactTokenTransfer } from "@/lib/withdraw/exact-transfer"
import { prepareWithdrawAll, withdrawSummary } from "@/lib/withdraw/prepare-withdraw"

/**
 * Withdraw-all step 2 (after she taps confirm): re-read the balance and build the unsigned SAC
 * transfer for exactly the amount she confirmed. If the balance moved, refuse so she re-confirms.
 */
export async function POST(request: NextRequest) {
  const auth = requireSession(request)
  if (auth.error) return auth.error
  try {
    const body = await request.json().catch(() => ({}))
    const expectedMinor = parseMinorAmount(body?.amountMinor)
    if (expectedMinor == null || expectedMinor <= BigInt(0)) {
      return NextResponse.json({ error: "invalid_amount", code: "invalid_amount" }, { status: 400 })
    }

    const prepared = await prepareWithdrawAll({ userId: auth.userId, address: body?.address, memo: body?.memo })
    if (!prepared.ok) {
      if (prepared.detail) console.warn("[withdraw/build]", prepared.code, prepared.detail)
      return NextResponse.json({ error: prepared.code, code: prepared.code }, { status: prepared.status })
    }
    if (prepared.balanceMinor !== expectedMinor) {
      return NextResponse.json(
        { error: "balance_changed", code: "balance_changed", ...withdrawSummary(prepared) },
        { status: 409 },
      )
    }

    const { unsignedXdr, sorobanDataXdr } = await buildExactTokenTransfer({
      contractId: prepared.asset.contractId,
      from: prepared.sender.senderC,
      to: prepared.destination.transferTo,
      amountMinor: prepared.balanceMinor,
      feePayer: prepared.feePayer,
      network: prepared.network,
    })
    return NextResponse.json({
      ...withdrawSummary(prepared),
      build: {
        unsignedXdr,
        sorobanDataXdr,
        signMethod: prepared.signMethod,
        supportsOzKitApi: prepared.supportsOzKitApi,
        signerPublicKey: prepared.sender.signerPk,
        walletAddress: prepared.sender.senderC,
        ozCredentialId: prepared.sender.ozCredentialId,
        feePayerPublicKey: prepared.feePayer,
      },
    })
  } catch (e) {
    console.error("[withdraw/build] error:", e)
    return NextResponse.json({ error: "internal_error", code: "internal_error" }, { status: 500 })
  }
}
