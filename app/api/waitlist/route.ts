import { NextResponse, type NextRequest } from "next/server"
import { addWaitlistSignup } from "@/lib/db/waitlist"
import { sendWaitlistConfirmation } from "@/lib/waitlist/confirm-email"
import { createRateLimiter } from "@/lib/waitlist/rate-limit"
import { normalizeWaitlistEmail, normalizeWaitlistLocale } from "@/lib/waitlist/signup"

export const dynamic = "force-dynamic"

const allowSignup = createRateLimiter(5, 10 * 60_000)

function referrerHost(request: NextRequest): string | null {
  const referrer = request.headers.get("referer")
  if (!referrer) return null
  try {
    return new URL(referrer).host.slice(0, 120)
  } catch {
    return null
  }
}

function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown"
}

export async function POST(request: NextRequest) {
  if (!allowSignup(clientIp(request))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 })
  }

  let body: Record<string, unknown>
  try {
    const parsed: unknown = await request.json()
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 })
    }
    body = parsed as Record<string, unknown>
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

  const locale = normalizeWaitlistLocale(body.locale)
  let created = false
  try {
    created = await addWaitlistSignup({
      email,
      locale,
      source: referrerHost(request),
    })
  } catch (error) {
    console.error("[waitlist]", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "unavailable" }, { status: 503 })
  }

  if (created) {
    const confirmation = await sendWaitlistConfirmation({ email, locale })
    if (!confirmation.sent) {
      console.error("[waitlist] confirm email", confirmation.error ?? "skipped")
    }
  }

  return NextResponse.json({ ok: true })
}
