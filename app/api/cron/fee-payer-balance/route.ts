import { NextRequest, NextResponse } from "next/server"
import { checkFeePayerBalance } from "@/lib/stellar/fee-payer-alert"

/**
 * Fee-payer XLM balance; posts to FEE_PAYER_ALERT_WEBHOOK_URL when below the threshold.
 * `?force=1` skips the cooldown, so raising FEE_PAYER_ALERT_THRESHOLD_XLM tests the alert.
 * The dashboard ops panel (szp #96) can poll this with the same CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  try {
    const report = await checkFeePayerBalance({ force: request.nextUrl.searchParams.get("force") === "1" })
    if (!report) return NextResponse.json({ error: "fee payer not configured" }, { status: 503 })
    return NextResponse.json(report)
  } catch (e) {
    console.error("[cron/fee-payer-balance]", e)
    return NextResponse.json({ error: "balance check failed" }, { status: 502 })
  }
}
