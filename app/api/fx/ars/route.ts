import { NextResponse } from "next/server"
import { getArsQuote } from "@/lib/fx/bcra"

export const dynamic = "force-dynamic"

/** USD → ARS reference rate from BCRA: `{ rate, source, rateDate, fetchedAt }`. 503 when BCRA is unavailable. */
export async function GET() {
  try {
    const quote = await getArsQuote()
    return NextResponse.json(quote, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    })
  } catch (e) {
    console.error("[fx/ars]", e)
    return NextResponse.json(
      { error: "rate_unavailable", source: "BCRA" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }
}
