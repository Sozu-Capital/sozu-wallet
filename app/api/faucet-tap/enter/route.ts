import { NextResponse } from "next/server"
import {
  buildTapCookieValue,
  expectedTapSecret,
  tapCookieOptions,
  tapSecretMatches,
  tapSlug,
  FAUCET_TAP_COOKIE,
} from "@/lib/faucet/tap-gate"

export const dynamic = "force-dynamic"

/**
 * POST /api/faucet-tap/enter
 * Trades the chip secret for an httpOnly cookie. The response body does not echo the secret.
 */
export async function POST(request: Request) {
  let secret = ""
  try {
    const body = (await request.json()) as { secret?: unknown }
    if (typeof body.secret === "string") secret = body.secret.trim()
  } catch {
    secret = ""
  }

  const expected = expectedTapSecret()
  if (!expected || !tapSecretMatches(secret, expected)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(FAUCET_TAP_COOKIE, buildTapCookieValue(tapSlug(), Date.now(), expected), tapCookieOptions())
  return response
}
