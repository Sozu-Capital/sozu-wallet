import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { provisionSmartWalletForSigner } from "@/lib/stellar/smart-account-provision"
import { getSessionUserId } from "@/lib/auth/session"
import {
  assignCanonicalSmartAccount,
  resolveCanonicalSmartAccount,
} from "@/lib/wallet/persist-canonical-smart-account"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

/**
 * POST /api/wallet/smart-account/provision
 * Deploy a Soroban smart account (C…) for a passkey-derived signer (G…) and register it in stellar_wallets.
 */
export async function POST(request: NextRequest) {
  const headers = corsHeaders(request)

  try {
    const userId = getSessionUserId(request)
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers })
    }

    const body = await request.json().catch(() => ({}))
    const signerPublicKey =
      typeof body.signerPublicKey === "string" ? body.signerPublicKey.trim().toUpperCase() : ""

    if (!/^G[A-Z0-9]{55}$/.test(signerPublicKey)) {
      return NextResponse.json(
        { error: "signerPublicKey (G…) is required." },
        { status: 400, headers }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500, headers })
    }

    const svc = createServiceClient(supabaseUrl, supabaseServiceKey)
    const { data: existing } = await svc
      .from("stellar_wallets")
      .select("public_key, signer_public_key")
      .eq("user_id", userId)
      .maybeSingle()

    const canonical = await resolveCanonicalSmartAccount(userId).catch(() => null)
    if (canonical) {
      if (canonical.source === "org_treasury") {
        await assignCanonicalSmartAccount(userId, canonical.contractId, { wallet_type: "oz" })
      }
      return NextResponse.json(
        {
          ok: true,
          contractId: canonical.contractId,
          signerPublicKey: existing?.signer_public_key ?? signerPublicKey,
          alreadyProvisioned: true,
        },
        { headers },
      )
    }

    const provisioned = await provisionSmartWalletForSigner(signerPublicKey)
    if ("error" in provisioned) {
      return NextResponse.json({ error: provisioned.error }, { status: 502, headers })
    }

    let assigned: { contractId: string; immutable: boolean }
    try {
      assigned = await assignCanonicalSmartAccount(userId, provisioned.contractId, {
        signer_public_key: provisioned.signerPublicKey,
        wallet_type: "factory",
        turnkey_wallet_id: null,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!message.includes("signer_public_key")) {
        return NextResponse.json(
          {
            error: `Smart account deployed (${provisioned.contractId}) but DB save failed. ${message}`,
            contractId: provisioned.contractId,
          },
          { status: 502, headers },
        )
      }
      assigned = await assignCanonicalSmartAccount(userId, provisioned.contractId, {
        wallet_type: "factory",
        turnkey_wallet_id: null,
      })
    }

    return NextResponse.json(
      {
        ok: true,
        contractId: assigned.contractId,
        signerPublicKey: provisioned.signerPublicKey,
        funded: provisioned.funded,
        alreadyProvisioned: assigned.immutable,
      },
      { headers }
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[smart-account/provision]", msg)
    return NextResponse.json({ error: msg }, { status: 500, headers })
  }
}
