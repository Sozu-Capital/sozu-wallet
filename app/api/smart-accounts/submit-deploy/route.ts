import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { resolveUserId } from "@/lib/auth/resolve-user"
import { normalizeCredentialId } from "@/lib/webauthn/normalize-credential-id"
import { ozDeploySalt } from "@/lib/stellar/smartAccounts/oz-deploy-id"
import {
  SponsoredDeployRejected,
  submitSponsoredDeploy,
} from "@/lib/stellar/sponsor-smart-account-deploy"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

/** The fee payer sponsors the OpenZeppelin deployer create. The user account holds no XLM. */
export async function POST(request: NextRequest) {
  const headers = corsHeaders(request)
  const session = await resolveUserId(request)
  if (session.error) return session.error

  const body = await request.json().catch(() => ({}))
  const signedXdr = typeof body.signedXdr === "string" ? body.signedXdr.trim() : ""
  if (!signedXdr) {
    return NextResponse.json({ error: "signedXdr is required." }, { status: 400, headers })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500, headers })
  }

  try {
    const svc = createServiceClient(supabaseUrl, supabaseServiceKey)
    const { data: passkeys, error } = await svc
      .from("passkeys")
      .select("credential_id")
      .eq("user_id", session.userId)
    if (error) throw new Error("Could not load passkeys for this account.")
    const salts = (passkeys ?? [])
      .map((row) => (typeof row.credential_id === "string" ? normalizeCredentialId(row.credential_id) : ""))
      .filter((id) => id.length > 0)
      .map((id) => ozDeploySalt(id, session.userId))

    const submitted = await submitSponsoredDeploy(signedXdr, salts)
    return NextResponse.json(
      {
        ok: true,
        hash: submitted.hash,
        alreadyDeployed: submitted.alreadyDeployed,
        contractId: submitted.contractId,
      },
      { headers },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const status = err instanceof SponsoredDeployRejected ? 400 : 502
    return NextResponse.json({ error: message }, { status, headers })
  }
}
