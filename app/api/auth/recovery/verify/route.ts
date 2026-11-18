import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { setSessionCookie } from "@/lib/auth/session"
import { hashRecoveryToken } from "@/lib/auth/recovery-token"
import { findRecoveryAccount } from "@/lib/auth/recovery-link"
import { MAX_PASSKEYS_PER_USER } from "@/lib/auth/passkey-limits"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { challengeStore } from "@/lib/webauthn/config"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

function normalizeCredentialId(id: string): string {
  return String(id).replace(/\s+/g, "").trim()
}

export async function POST(request: NextRequest) {
  const headers = corsHeaders(request)
  const body = await request.json().catch(() => ({}))
  const token = typeof body.token === "string" ? body.token : ""
  const credential = body.credential
  const providedChallenge = typeof body.challenge === "string" ? body.challenge : ""

  if (!credential?.id) {
    return NextResponse.json({ error: "Invalid credential data" }, { status: 400, headers })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500, headers })
  }

  const service = createServiceClient(supabaseUrl, supabaseServiceKey)
  const account = await findRecoveryAccount(service, token)
  if (!account) {
    return NextResponse.json({ error: "Este enlace venció. Pedí otro." }, { status: 400, headers })
  }

  const challengeKey = `recover:${hashRecoveryToken(token)}`
  const stored = challengeStore.get(challengeKey)
  if (stored) challengeStore.delete(challengeKey)
  if (!stored && !providedChallenge) {
    return NextResponse.json({ error: "Challenge not found or expired" }, { status: 400, headers })
  }

  const { count, error: countError } = await service
    .from("passkeys")
    .select("id", { count: "exact", head: true })
    .eq("user_id", account.userId)
  if (countError) {
    return NextResponse.json({ error: "Failed to verify passkeys" }, { status: 500, headers })
  }
  if ((count ?? 0) >= MAX_PASSKEYS_PER_USER) {
    return NextResponse.json(
      { error: `Esta cuenta ya tiene ${MAX_PASSKEYS_PER_USER} llaves.` },
      { status: 409, headers },
    )
  }

  const normalizedCredentialId = normalizeCredentialId(credential.id)
  const { data: existingSame } = await service
    .from("passkeys")
    .select("id")
    .eq("credential_id", normalizedCredentialId)
    .maybeSingle()
  if (existingSame) {
    return NextResponse.json({ error: "Esta llave ya está registrada." }, { status: 409, headers })
  }

  let publicKey: string
  const { extractPasskeyPublicKey65ForStorage } = await import("@/lib/webauthn/extract-attestation-pubkey")
  const { parsePasskeyPublicKey65, publicKeyToBase64Url } = await import(
    "@/lib/stellar/smartAccounts/passkeyPublicKey"
  )
  try {
    const clientPublicKey65b = typeof body.clientPublicKey65b === "string" ? body.clientPublicKey65b.trim() : ""
    publicKey = clientPublicKey65b
      ? publicKeyToBase64Url(parsePasskeyPublicKey65(clientPublicKey65b))
      : extractPasskeyPublicKey65ForStorage(credential)
  } catch {
    return NextResponse.json({ error: "No pudimos leer la llave nueva." }, { status: 400, headers })
  }

  const { error: insertError } = await service.from("passkeys").insert({
    user_id: account.userId,
    credential_id: normalizedCredentialId,
    public_key: publicKey,
    counter: 0,
    transports: credential.response?.transports || [],
  })
  if (insertError) {
    console.error("[recovery verify]", insertError)
    return NextResponse.json({ error: "No pudimos guardar la llave." }, { status: 500, headers })
  }

  await service
    .from("account_recovery_links")
    .update({ used_at: new Date().toISOString() })
    .eq("id", account.linkId)

  const response = NextResponse.json(
    { success: true, userId: account.userId, username: account.username },
    { headers },
  )
  return setSessionCookie(response, account.userId)
}
