import { createClient as createServiceClient, createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { createClient as createServerSupabase } from "@/lib/supabase/server"
import { isValidSozuTag, normalizeSozuTag } from "@/lib/payment/sozu-tag-lookup"
import {
  isValidStellarReceiveAddress,
  normalizeStellarAddressInput,
} from "@/lib/payment/stellar-address"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

/**
 * GET /api/wallet/sozu-tag
 *
 * Returns the authenticated user's Sozu tag (`profiles.username`) and primary Stellar address
 * for partner apps (e.g. Sozu Pay Dashboard) that share the same Supabase project but run on
 * another origin (no shared session cookie).
 *
 * Auth (first match wins):
 * 1) `Authorization: Bearer <Supabase access_token>` — JWT from the same Supabase Auth pool.
 * 2) Cookie session — same as Sozu Credit web (optional).
 * 3) Server-to-server: `X-Sozu-Internal-Secret` must equal env `SOZU_INTERNAL_API_SECRET`, and
 *    `X-User-Id` must be the target user's UUID (only use from your trusted backend).
 */
export async function GET(request: NextRequest) {
  const headers = corsHeaders(request)

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500, headers }
      )
    }

    let userId: string | null = null

    const internalSecret = process.env.SOZU_INTERNAL_API_SECRET?.trim()
    const headerSecret = request.headers.get("x-sozu-internal-secret")
    const headerUserId = request.headers.get("x-user-id")

    if (
      internalSecret &&
      internalSecret.length >= 16 &&
      headerSecret &&
      headerSecret === internalSecret &&
      headerUserId
    ) {
      userId = headerUserId.trim()
    }

    if (!userId) {
      const authHeader = request.headers.get("authorization")
      if (authHeader?.startsWith("Bearer ")) {
        const jwt = authHeader.slice(7).trim()
        if (jwt) {
          const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey)
          const { data: userData, error: jwtError } = await supabaseAuth.auth.getUser(jwt)
          if (jwtError || !userData.user) {
            return NextResponse.json({ error: "Invalid or expired token" }, { status: 401, headers })
          }
          userId = userData.user.id
        }
      }
    }

    if (!userId) {
      const supabase = await createServerSupabase()
      const { data: userData } = await supabase.auth.getUser()
      if (userData.user) {
        userId = userData.user.id
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers })
    }

    const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey)

    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .maybeSingle()

    if (profileError) {
      console.error("[Sozu Tag API] profile error:", profileError)
      return NextResponse.json({ error: "Failed to load profile" }, { status: 500, headers })
    }

    const { data: wallets, error: walletError } = await serviceClient
      .from("stellar_wallets")
      .select("public_key, network")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)

    if (walletError) {
      console.error("[Sozu Tag API] wallet error:", walletError)
      return NextResponse.json({ error: "Failed to load wallet" }, { status: 500, headers })
    }

    const wallet = wallets?.[0] ?? null

    return NextResponse.json(
      {
        tag: profile?.username ?? null,
        stellarAddress: wallet?.public_key ?? null,
        network: wallet?.network ?? null,
      },
      { headers }
    )
  } catch (e) {
    console.error("[Sozu Tag API] unexpected:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers })
  }
}

/**
 * POST /api/wallet/sozu-tag
 *
 * Offline phones register a tag against their Stellar address so a later send
 * can resolve `$tag` through the same directory as Sozu Credit.
 * Body: `{ tag, stellarAddress }`. First claim wins. The same pair can be repeated.
 */
export async function POST(request: NextRequest) {
  const headers = corsHeaders(request)

  try {
    const body = await request.json().catch(() => null)
    const tag = normalizeSozuTag(typeof body?.tag === "string" ? body.tag : "")
    const stellarAddress = normalizeStellarAddressInput(
      typeof body?.stellarAddress === "string" ? body.stellarAddress : "",
    )

    if (!isValidSozuTag(tag)) {
      return NextResponse.json(
        { error: "Tag must be 3–30 letters, numbers, or underscore." },
        { status: 400, headers },
      )
    }
    if (!isValidStellarReceiveAddress(stellarAddress)) {
      return NextResponse.json({ error: "Stellar address is not valid." }, { status: 400, headers })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500, headers })
    }

    const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey)
    const { data: profiles, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, username")
      .ilike("username", tag)
      .limit(10)

    if (profileError) {
      console.error("[Sozu Tag API] claim lookup:", profileError)
      return NextResponse.json({ error: "Failed to check tag" }, { status: 500, headers })
    }

    const owner =
      profiles?.find((p) => p.username === tag) ??
      profiles?.find((p) => p.username?.toLowerCase() === tag.toLowerCase()) ??
      null

    if (owner) {
      const { data: wallets } = await serviceClient
        .from("stellar_wallets")
        .select("public_key")
        .eq("user_id", owner.id)
        .order("updated_at", { ascending: false })
        .limit(1)
      const existing = wallets?.[0]?.public_key?.trim().toUpperCase() ?? ""
      if (existing === stellarAddress) {
        return NextResponse.json({ tag: owner.username ?? tag, stellarAddress }, { headers })
      }
      return NextResponse.json({ error: "That tag is taken." }, { status: 409, headers })
    }

    const { data: addressWallets } = await serviceClient
      .from("stellar_wallets")
      .select("user_id, public_key")
      .ilike("public_key", stellarAddress)
      .limit(1)
    const addressOwner = addressWallets?.[0]?.user_id as string | undefined

    let userId = addressOwner ?? null
    if (!userId) {
      const email = `offline.${stellarAddress.slice(1, 17).toLowerCase()}@mesh.sozu.capital`
      const created = await serviceClient.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { username: tag, source: "sozu-offline" },
      })
      if (created.error || !created.data.user) {
        const recovered = await userIdForEmail(supabaseUrl, supabaseServiceKey, email)
        if (!recovered) {
          console.error("[Sozu Tag API] create user:", created.error)
          return NextResponse.json({ error: "Could not save this tag." }, { status: 500, headers })
        }
        userId = recovered
      } else {
        userId = created.data.user.id
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "Could not save this tag." }, { status: 500, headers })
    }

    const { data: existingProfile } = await serviceClient
      .from("profiles")
      .select("id, username")
      .eq("id", userId)
      .maybeSingle()

    if (existingProfile?.username && existingProfile.username.toLowerCase() !== tag.toLowerCase()) {
      return NextResponse.json(
        { error: "This wallet already has a tag.", tag: existingProfile.username },
        { status: 409, headers },
      )
    }

    const profileWrite = existingProfile
      ? await serviceClient.from("profiles").update({ username: tag, display_name: tag }).eq("id", userId)
      : await serviceClient.from("profiles").insert({ id: userId, username: tag, display_name: tag })

    if (profileWrite.error) {
      const duplicate =
        profileWrite.error.code === "23505" || profileWrite.error.message.includes("duplicate")
      if (!duplicate) {
        console.error("[Sozu Tag API] profile write:", profileWrite.error)
        return NextResponse.json({ error: "Could not save this tag." }, { status: 500, headers })
      }
      const retry = await serviceClient
        .from("profiles")
        .update({ username: tag, display_name: tag })
        .eq("id", userId)
      if (retry.error) {
        console.error("[Sozu Tag API] profile retry:", retry.error)
        return NextResponse.json({ error: "Could not save this tag." }, { status: 500, headers })
      }
    }

    const walletType = stellarAddress.startsWith("C") ? "oz" : "legacy"
    const { error: walletError } = await serviceClient.from("stellar_wallets").upsert(
      {
        user_id: userId,
        public_key: stellarAddress,
        wallet_type: walletType,
        network: "testnet",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )

    if (walletError) {
      console.error("[Sozu Tag API] wallet write:", walletError)
      return NextResponse.json({ error: "Could not save this wallet." }, { status: 500, headers })
    }

    return NextResponse.json({ tag, stellarAddress, network: "testnet" }, { headers })
  } catch (e) {
    console.error("[Sozu Tag API] claim unexpected:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers })
  }
}

async function userIdForEmail(supabaseUrl: string, serviceKey: string, email: string): Promise<string | null> {
  const url = new URL(`${supabaseUrl}/auth/v1/admin/users`)
  url.searchParams.set("filter", email)
  url.searchParams.set("page", "1")
  url.searchParams.set("per_page", "5")
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
  })
  if (!response.ok) return null
  const json = (await response.json()) as { users?: { id?: string; email?: string }[] }
  const hit = json.users?.find((user) => user.email?.toLowerCase() === email.toLowerCase())
  return hit?.id ?? null
}
