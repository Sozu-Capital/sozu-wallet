import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { requireSession } from "@/lib/auth/session"
import { normalizeCredentialId } from "@/lib/webauthn/normalize-credential-id"
import { SponsoredDeployRejected, submitSponsoredDeploy } from "@/lib/stellar/deploy-fee-bump"
import { ozDeploySalt } from "@/lib/stellar/smartAccounts/ozContractId"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

const inFlight = new Map<string, Promise<{ hash: string | null; alreadyDeployed: boolean }>>()

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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500, headers })
  }

  const userId = session.userId
  const existingFlight = inFlight.get(userId)
  if (existingFlight) {
    try {
      const submitted = await existingFlight
      return NextResponse.json({ ok: true, hash: submitted.hash, alreadyDeployed: submitted.alreadyDeployed }, { headers })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const status = err instanceof SponsoredDeployRejected ? 400 : 502
      return NextResponse.json({ error: message }, { status, headers })
    }
  }

  const work = sponsorForUser(userId, signedXdr, supabaseUrl, supabaseServiceKey)
  inFlight.set(userId, work)
  try {
    const submitted = await work
    return NextResponse.json({ ok: true, hash: submitted.hash, alreadyDeployed: submitted.alreadyDeployed }, { headers })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const status = err instanceof SponsoredDeployRejected ? 400 : 502
    return NextResponse.json({ error: message }, { status, headers })
  } finally {
    inFlight.delete(userId)
  }
}

async function sponsorForUser(
  userId: string,
  signedXdr: string,
  supabaseUrl: string,
  supabaseServiceKey: string,
): Promise<{ hash: string | null; alreadyDeployed: boolean }> {
  const svc = createServiceClient(supabaseUrl, supabaseServiceKey)
  const { data: wallet } = await svc
    .from("stellar_wallets")
    .select("public_key, wallet_type")
    .eq("user_id", userId)
    .maybeSingle()
  const existingPk = typeof wallet?.public_key === "string" ? wallet.public_key.trim().toUpperCase() : ""
  if (existingPk.startsWith("C") && existingPk.length === 56) {
    return { hash: null, alreadyDeployed: true }
  }
  if (wallet?.wallet_type === "factory" || existingPk.startsWith("G")) {
    throw new SponsoredDeployRejected("Existing accounts are not redeployed.")
  }

  const { data: passkeys, error } = await svc.from("passkeys").select("credential_id").eq("user_id", userId)
  if (error) throw new Error("Could not load passkeys for this account.")
  const salts = (passkeys ?? [])
    .map((row) => (typeof row.credential_id === "string" ? normalizeCredentialId(row.credential_id) : ""))
    .filter((id) => id.length > 0)
    .map((id) => ozDeploySalt(id, userId))

  const submitted = await submitSponsoredDeploy(signedXdr, salts)
  return { hash: submitted.hash, alreadyDeployed: submitted.alreadyDeployed }
}
