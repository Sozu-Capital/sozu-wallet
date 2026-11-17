import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/session"
import { claimSouvenirForAccount } from "@/lib/merch/account-souvenirs"

/** One claim per account. A second attempt returns the same collected badge. */
export async function POST(request: NextRequest) {
  const auth = requireSession(request)
  if (auth.error) return auth.error

  const body = await request.json().catch(() => ({}))
  const slug = typeof body.slug === "string" ? body.slug : ""
  const walletAddress = typeof body.walletAddress === "string" ? body.walletAddress.trim().toUpperCase() : ""
  if (!slug || !walletAddress) {
    return NextResponse.json({ error: "invalid_claim" }, { status: 400 })
  }

  const result = await claimSouvenirForAccount({
    userId: auth.userId,
    slug,
    walletAddress,
  })
  if (!result.ok) {
    if (result.error === "missing") return NextResponse.json({ error: "missing" }, { status: 404 })
    if (result.error === "closed") return NextResponse.json({ error: "claim_closed" }, { status: 409 })
    return NextResponse.json({ error: "unavailable" }, { status: 503 })
  }
  return NextResponse.json({ claim: result.claim, already: result.already })
}
