import { NextResponse, type NextRequest } from "next/server"
import { addWaitlistSignup } from "@/lib/db/waitlist"
import { normalizeWaitlistEmail, normalizeWaitlistLocale } from "@/lib/waitlist/signup"

export const dynamic = "force-dynamic"

function referrerHost(request: NextRequest): string | null {
  const referrer = request.headers.get("referer")
  if (!referrer) return null
  try {
    return new URL(referrer).host.slice(0, 120)
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  // Honeypot: real visitors never fill the hidden field. Answer as if it worked.
  if (typeof body.company === "string" && body.company.length > 0) {
    return NextResponse.json({ ok: true })
  }

  const email = normalizeWaitlistEmail(body.email)
  if (!email) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 })
  }

  try {
    await addWaitlistSignup({
      email,
      locale: normalizeWaitlistLocale(body.locale),
      source: referrerHost(request),
    })
  } catch (error) {
    console.error("[waitlist]", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "unavailable" }, { status: 503 })
  }

  return NextResponse.json({ ok: true })
}
