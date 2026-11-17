import { createClient } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"
import { getSessionUserId } from "@/lib/auth/session"
import { sendFeedbackMail } from "@/lib/feedback/send-feedback-mail"
import { createRateLimiter } from "@/lib/waitlist/rate-limit"

export const dynamic = "force-dynamic"

const allowFeedback = createRateLimiter(5, 10 * 60_000)
const MAX_MESSAGE = 2_000

function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown"
}

function readMessage(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null
  const message = (body as { message?: unknown }).message
  if (typeof message !== "string") return null
  const text = message.trim()
  if (!text || text.length > MAX_MESSAGE) return null
  return text
}

function readPath(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null
  const path = (body as { path?: unknown }).path
  if (typeof path !== "string" || !path.startsWith("/") || path.length > 200) return null
  return path
}

async function lookupUsername(userId: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  try {
    const db = createClient(url, key, { auth: { persistSession: false } })
    const { data } = await db.from("profiles").select("username").eq("id", userId).maybeSingle()
    return typeof data?.username === "string" && data.username.trim() ? data.username.trim() : null
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  if (!allowFeedback(clientIp(request))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  const message = readMessage(body)
  if (!message) return NextResponse.json({ error: "invalid_message" }, { status: 400 })

  const userId = getSessionUserId(request)
  const username = userId ? await lookupUsername(userId) : null

  try {
    await sendFeedbackMail({ message, userId, username, path: readPath(body) })
  } catch (error) {
    console.error("[feedback]", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "unavailable" }, { status: 503 })
  }

  return NextResponse.json({ ok: true })
}
