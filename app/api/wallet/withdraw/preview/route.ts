import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/session"
import { prepareWithdrawAll, withdrawSummary } from "@/lib/withdraw/prepare-withdraw"

/** Withdraw-all step 1: validate the destination and return the exact amount to show on confirm. No tx is built. */
export async function POST(request: NextRequest) {
  const auth = requireSession(request)
  if (auth.error) return auth.error
  try {
    const body = await request.json().catch(() => ({}))
    const prepared = await prepareWithdrawAll({ userId: auth.userId, address: body?.address, memo: body?.memo })
    if (!prepared.ok) {
      if (prepared.detail) console.warn("[withdraw/preview]", prepared.code, prepared.detail)
      return NextResponse.json({ error: prepared.code, code: prepared.code }, { status: prepared.status })
    }
    return NextResponse.json(withdrawSummary(prepared))
  } catch (e) {
    console.error("[withdraw/preview] error:", e)
    return NextResponse.json({ error: "internal_error", code: "internal_error" }, { status: 500 })
  }
}
