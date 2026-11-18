import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { normalizeRecoveryEmail, RECOVERY_START_MESSAGE } from "@/lib/auth/recovery-email"
import { createRecoveryToken } from "@/lib/auth/recovery-token"
import { recoveryExpiryIso } from "@/lib/auth/recovery-link"
import { sendRecoveryMail } from "@/lib/auth/send-recovery-mail"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

function originOf(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  if (!host) return "http://localhost:3000"
  const proto = host.startsWith("localhost") || host.startsWith("127.0.0.1")
    ? "http"
    : (request.headers.get("x-forwarded-proto") ?? "https")
  return `${proto}://${host}`
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const email = normalizeRecoveryEmail((body as { email?: unknown }).email)
  const headers = corsHeaders(request)
  if (!email) {
    return NextResponse.json({ ok: true, message: RECOVERY_START_MESSAGE }, { headers })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500, headers })
  }

  const service = createServiceClient(supabaseUrl, supabaseServiceKey)
  const { data: profile, error } = await service
    .from("profiles")
    .select("id")
    .eq("recovery_email", email)
    .maybeSingle()

  if (error) {
    console.error("[recovery start]", error)
    return NextResponse.json({ error: "No pudimos continuar." }, { status: 500, headers })
  }

  if (profile?.id) {
    const { token, tokenHash } = createRecoveryToken()
    await service.from("account_recovery_links").delete().eq("user_id", profile.id).is("used_at", null)
    const { error: insertError } = await service.from("account_recovery_links").insert({
      user_id: profile.id,
      token_hash: tokenHash,
      expires_at: recoveryExpiryIso(),
    })
    if (insertError) {
      console.error("[recovery start] insert", insertError)
      return NextResponse.json({ error: "No pudimos continuar." }, { status: 500, headers })
    }
    try {
      await sendRecoveryMail({
        to: email,
        link: `${originOf(request)}/auth/recover?token=${encodeURIComponent(token)}`,
      })
    } catch (mailError) {
      console.error("[recovery start] mail", mailError)
      return NextResponse.json({ error: "No pudimos enviar el correo." }, { status: 500, headers })
    }
  }

  return NextResponse.json({ ok: true, message: RECOVERY_START_MESSAGE }, { headers })
}
