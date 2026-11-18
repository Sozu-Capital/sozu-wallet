import { NextRequest, NextResponse } from "next/server"
import { corsHeaders } from "@/lib/cors"
import { createClient } from "@supabase/supabase-js"
import {
  isValidSozuTag,
  normalizeSozuTag,
} from "@/lib/payment/sozu-tag-lookup"
import {
  LEGACY_CLASSIC_PAYMENT_NOTICE,
  paymentRailForAddress,
} from "@/lib/payment/payment-rail"
import {
  isValidStellarReceiveAddress,
  normalizeStellarAddressInput,
} from "@/lib/payment/stellar-address"
import { selectCanonicalSmartAccount } from "@/lib/wallet/canonical-smart-account"
import { findCanonicalTagOwner } from "@/lib/wallet/tag-owner"


type ResolveCacheEntry = {
  expiresAt: number
  body: Record<string, unknown>
}

const RESOLVE_CACHE_TTL_MS = 5 * 60 * 1000
const resolveRecipientCache = new Map<string, ResolveCacheEntry>()

function readResolveCache(tag: string): Record<string, unknown> | null {
  const hit = resolveRecipientCache.get(tag)
  if (!hit) return null
  if (Date.now() > hit.expiresAt) {
    resolveRecipientCache.delete(tag)
    return null
  }
  return hit.body
}

function writeResolveCache(tag: string, body: Record<string, unknown>): void {
  resolveRecipientCache.set(tag, { body, expiresAt: Date.now() + RESOLVE_CACHE_TTL_MS })
}

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { headers: corsHeaders(request) })
}

export async function POST(request: NextRequest) {
  try {
    const { recipient: rawRecipient } = await request.json()

    if (!rawRecipient || typeof rawRecipient !== "string") {
      return NextResponse.json(
        { error: "Recipient is required" },
        { status: 400, headers: corsHeaders(request) }
      )
    }

    const trimmed = rawRecipient.trim()
    const stellarDirect = normalizeStellarAddressInput(trimmed)

    if (isValidStellarReceiveAddress(stellarDirect)) {
      const rail = paymentRailForAddress(stellarDirect)!
      return NextResponse.json(
        {
          walletAddress: stellarDirect,
          addressType: rail === "smart" ? "contract" : "classic",
          paymentRail: rail,
          paymentSupported: true,
          ...(rail === "legacy" && { legacyNotice: LEGACY_CLASSIC_PAYMENT_NOTICE }),
        },
        { headers: corsHeaders(request) }
      )
    }

    const sozuTagLookup = normalizeSozuTag(trimmed)

    if (!sozuTagLookup) {
      return NextResponse.json(
        { error: "Recipient is required" },
        { status: 400, headers: corsHeaders(request) }
      )
    }

    if (!isValidSozuTag(sozuTagLookup)) {
      return NextResponse.json(
        { error: "Recipient not found. Please check the Sozu tag or wallet address." },
        { status: 404, headers: corsHeaders(request) }
      )
    }

    const cached = readResolveCache(sozuTagLookup.toLowerCase())
    if (cached) {
      return NextResponse.json(cached, { headers: corsHeaders(request) })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Supabase configuration missing" },
        { status: 500, headers: corsHeaders(request) }
      )
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

    console.log("[Resolve Recipient] Looking up profile for Sozu tag:", sozuTagLookup)

    const owner = await findCanonicalTagOwner(serviceClient, sozuTagLookup)
    const profile = owner
      ? { id: owner.id, username: owner.username }
      : null

    if (!profile) {
      console.log("[Resolve Recipient] Profile not found for username:", sozuTagLookup)
      return NextResponse.json(
        { error: "Recipient not found. Please check the Sozu tag or wallet address." },
        { status: 404, headers: corsHeaders(request) }
      )
    }

    console.log("[Resolve Recipient] Profile found:", {
      profileId: profile.id,
      username: profile.username,
    })

    const [{ data: wallets, error: walletError }, { data: orgRow }] = await Promise.all([
      serviceClient
        .from("stellar_wallets")
        .select("public_key, user_id, network, updated_at")
        .eq("user_id", profile.id)
        .order("updated_at", { ascending: false })
        .limit(1),
      serviceClient
        .from("organizations")
        .select("treasury_smart_account_address, treasury_contract_id, soroban_contract_id")
        .eq("sozu_tag_auth_user_id", profile.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    if (walletError) {
      console.error("[Resolve Recipient] Error finding wallet:", walletError)
      return NextResponse.json(
        { error: "Failed to lookup recipient wallet. Please try again." },
        { status: 500, headers: corsHeaders(request) }
      )
    }

    let wallet = wallets?.[0] ?? null

    /** One receive address. A stored smart account wins. Org treasury is used only before that exists. */
    const orgTreasuryC = [
      orgRow?.treasury_smart_account_address,
      orgRow?.treasury_contract_id,
      orgRow?.soroban_contract_id,
    ]
      .map((value) => (typeof value === "string" ? value.trim().toUpperCase() : ""))
      .find((value) => value.startsWith("C") && value.length === 56)
    const canonical = selectCanonicalSmartAccount({
      walletPublicKey: wallet?.public_key,
      orgTreasuryContractId: orgTreasuryC,
    })
    const resolvedFromOrgTreasury = canonical?.source === "org_treasury"
    if (canonical) {
      wallet = {
        public_key: canonical.contractId,
        user_id: profile.id,
        network: wallet?.network ?? "testnet",
        updated_at: wallet?.updated_at ?? new Date().toISOString(),
      }
    }

    if (!wallet?.public_key) {
      console.log("[Resolve Recipient] No wallet found for user_id:", profile.id)
      return NextResponse.json(
        { error: "Recipient wallet not found. They may not have created a wallet yet." },
        { status: 404, headers: corsHeaders(request) }
      )
    }

    const pk = wallet.public_key.trim().toUpperCase()
    if (!isValidStellarReceiveAddress(pk)) {
      console.error("[Resolve Recipient] Invalid wallet public_key format:", {
        length: wallet.public_key?.length,
        prefix: wallet.public_key?.[0],
      })
      return NextResponse.json(
        { error: "Invalid wallet address format. Please contact support." },
        { status: 500, headers: corsHeaders(request) }
      )
    }

    const rail = paymentRailForAddress(pk)!
    console.log("[Resolve Recipient] Returning wallet for tag:", profile.username, rail)

    const payload = {
      walletAddress: pk,
      tag: profile.username,
      network: wallet.network,
      addressType: rail === "smart" ? "contract" : "classic",
      paymentRail: rail,
      paymentSupported: true,
      ...(resolvedFromOrgTreasury && { receiveTarget: "sozupay_org_treasury" }),
      ...(rail === "legacy" && { legacyNotice: LEGACY_CLASSIC_PAYMENT_NOTICE }),
    }

    writeResolveCache(sozuTagLookup.toLowerCase(), payload)

    return NextResponse.json(payload, { headers: corsHeaders(request) })
  } catch (error: unknown) {
    console.error("[Resolve Recipient] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to resolve recipient" },
      { status: 500, headers: corsHeaders(request) }
    )
  }
}
