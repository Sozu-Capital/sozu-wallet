import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { hashRecoveryToken } from "@/lib/auth/recovery-token"
import { findRecoveryAccount } from "@/lib/auth/recovery-link"
import { challengeStore, cleanupChallenges, getRpID, rpName } from "@/lib/webauthn/config"
import { generateChallenge } from "@/lib/webauthn/utils"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

export async function POST(request: NextRequest) {
  const headers = corsHeaders(request)
  const body = await request.json().catch(() => ({}))
  const token = typeof (body as { token?: unknown }).token === "string" ? (body as { token: string }).token : ""

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

  cleanupChallenges()
  const challenge = generateChallenge()
  challengeStore.set(`recover:${hashRecoveryToken(token)}`, { challenge, timestamp: Date.now() })

  return NextResponse.json(
    {
      challenge,
      rp: { name: rpName, id: getRpID(request) },
      user: {
        id: account.userId,
        name: account.username,
        displayName: account.username,
      },
      timeout: 60000,
      authenticatorSelection: {
        requireResidentKey: true,
        residentKey: "required",
        userVerification: "required",
      },
    },
    { headers },
  )
}
