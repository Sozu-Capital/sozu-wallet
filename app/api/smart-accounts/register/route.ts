import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { getStellarConfig } from "@/lib/turnkey/config"
import { normalizeCredentialId } from "@/lib/webauthn/normalize-credential-id"
import { getSessionUserId } from "@/lib/auth/session"
import { CANONICAL_SMART_ACCOUNT_IMMUTABLE } from "@/lib/wallet/canonical-smart-account"
import { assignCanonicalSmartAccount } from "@/lib/wallet/persist-canonical-smart-account"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

export async function POST(request: NextRequest) {
  const headers = corsHeaders(request)

  const userId = getSessionUserId(request)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers })
  }

  const body = await request.json().catch(() => ({}))
  const contractId = typeof body.contractId === "string" ? body.contractId.trim() : ""
  const credentialIdRaw = typeof body.credentialId === "string" ? body.credentialId.trim() : ""

  if (!contractId.startsWith("C") || !credentialIdRaw) {
    return NextResponse.json(
      { error: "contractId (C…) and credentialId are required." },
      { status: 400, headers }
    )
  }

  const credentialId = normalizeCredentialId(credentialIdRaw)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500, headers })
  }

  const svc = createServiceClient(supabaseUrl, supabaseServiceKey)
  const stellarConfig = getStellarConfig()

  const { data: existing } = await svc
    .from("stellar_wallets")
    .select("public_key, wallet_type")
    .eq("user_id", userId)
    .maybeSingle()

  // Factory accounts and classic G rows are not migrated by this route.
  const existingPk = typeof existing?.public_key === "string" ? existing.public_key.trim().toUpperCase() : ""
  if (existing?.wallet_type === "factory" && existingPk) {
    return NextResponse.json(
      {
        ok: true,
        contractId: existingPk,
        walletType: "factory",
        unchanged: true,
      },
      { headers },
    )
  }

  let assigned: { contractId: string; written: boolean; immutable: boolean }
  try {
    assigned = await assignCanonicalSmartAccount(userId, contractId, {
      wallet_type: "oz",
      oz_credential_id: credentialId,
      signer_public_key: null,
      turnkey_wallet_id: null,
      network: stellarConfig.network,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes("wallet_type") || message.includes("oz_credential")) {
      assigned = await assignCanonicalSmartAccount(userId, contractId, {
        signer_public_key: null,
        turnkey_wallet_id: null,
        network: stellarConfig.network,
      })
    } else {
      console.error("[smart-accounts/register]", message)
      return NextResponse.json({ error: message }, { status: 500, headers })
    }
  }

  return NextResponse.json(
    {
      ok: true,
      contractId: assigned.contractId,
      walletType: "oz",
      credentialId,
      unchanged: !assigned.written,
      ...(assigned.immutable && { code: CANONICAL_SMART_ACCOUNT_IMMUTABLE }),
    },
    { headers }
  )
}
