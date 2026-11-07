import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { requireSession } from "@/lib/auth/session"
import { submitSponsoredDeploy } from "@/lib/stellar/deploy-fee-bump"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

/** Sponsor an already deployer-signed smart-account deploy with the fee payer. */
export async function POST(request: NextRequest) {
  const headers = corsHeaders(request)
  const session = requireSession(request, headers)
  if (session.error) return session.error

  const body = await request.json().catch(() => ({}))
  const signedXdr = typeof body.signedXdr === "string" ? body.signedXdr.trim() : ""
  if (!signedXdr) {
    return NextResponse.json({ error: "signedXdr is required." }, { status: 400, headers })
  }

  try {
    const submitted = await submitSponsoredDeploy(signedXdr)
    return NextResponse.json({ ok: true, hash: submitted.hash }, { headers })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 502, headers })
  }
}
