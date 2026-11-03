import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { setSessionCookie } from "@/lib/auth/session"
import { normalizeCredentialId } from "@/lib/webauthn/normalize-credential-id"
import { verifyLoginAssertion, type LoginAssertion } from "@/lib/webauthn/verify-login-assertion"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

function requestHostname(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? ""
  return host.split(",")[0].trim().split(":")[0]
}

export async function POST(request: NextRequest) {
  const headers = corsHeaders(request)
  const invalid = () => NextResponse.json({ error: "Invalid passkey" }, { status: 401, headers })

  try {
    const body = (await request.json().catch(() => null)) as
      | { credential?: LoginAssertion & { id?: string } }
      | null
    const credential = body?.credential
    if (!credential?.id) {
      return NextResponse.json({ error: "Invalid credential data" }, { status: 400, headers })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500, headers })
    }
    const svc = createServiceClient(supabaseUrl, supabaseServiceKey)

    const credentialId = normalizeCredentialId(credential.id)
    const { data: passkey, error: passkeyError } = await svc
      .from("passkeys")
      .select("id, user_id, public_key")
      .eq("credential_id", credentialId)
      .maybeSingle()
    if (passkeyError) {
      console.error("[Login] Passkey lookup failed:", passkeyError.message)
      return NextResponse.json({ error: "Failed to verify login" }, { status: 500, headers })
    }
    if (!passkey?.public_key) return invalid()

    const check = verifyLoginAssertion({
      assertion: credential,
      storedPublicKey: passkey.public_key,
      expectedHostname: requestHostname(request),
      configuredRpId: process.env.NEXT_PUBLIC_RP_ID,
    })
    if (!check.ok) {
      console.warn("[Login] Assertion rejected:", check.reason)
      return invalid()
    }

    const { data: profile } = await svc
      .from("profiles")
      .select("id, username")
      .eq("id", passkey.user_id)
      .maybeSingle()
    if (!profile) return invalid()

    await svc.from("passkeys").update({ last_used_at: new Date().toISOString() }).eq("id", passkey.id)

    const response = NextResponse.json(
      { success: true, userId: profile.id, username: profile.username ?? undefined },
      { headers },
    )
    return setSessionCookie(response, profile.id)
  } catch (error) {
    console.error("[Login] Login verification error:", error)
    return NextResponse.json({ error: "Failed to verify login" }, { status: 500, headers })
  }
}
