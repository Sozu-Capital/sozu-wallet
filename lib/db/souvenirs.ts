import "server-only"

import { createClient as createServiceClient } from "@supabase/supabase-js"
import type { CollectibleSouvenir } from "@/lib/merch/catalog"
import type { ClaimedSouvenir } from "@/lib/merch/souvenirs"

const DROPS = "souvenirs"
const CLAIMS = "souvenir_claims"
const MISSING_TABLE_CODES = new Set(["PGRST205", "42P01"])

export class SouvenirStoreUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SouvenirStoreUnavailableError"
  }
}

type DropRow = {
  slug: string
  title: string
  drop_name: string
  image_url: string
  merchant_org_id: string | null
  claim_starts_at: string
  claim_ends_at: string
}

type ClaimRow = {
  souvenir_slug: string
  user_id: string
  wallet_address: string | null
  claimed_at: string
  title: string
  drop_name: string
  image_url: string
}

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new SouvenirStoreUnavailableError("Supabase service role not configured")
  return createServiceClient(url, key, { auth: { persistSession: false } })
}

function raise(op: string, error: { code?: string; message: string }): never {
  if (error.code && MISSING_TABLE_CODES.has(error.code)) {
    throw new SouvenirStoreUnavailableError(`${op}: ${error.message}`)
  }
  throw new Error(`${op}: ${error.message}`)
}

function toSouvenir(row: DropRow): CollectibleSouvenir {
  return {
    slug: row.slug,
    name: row.title,
    drop: row.drop_name,
    imagePath: row.image_url,
    claimStartsAt: row.claim_starts_at,
    claimEndsAt: row.claim_ends_at,
  }
}

function toClaim(row: ClaimRow): ClaimedSouvenir {
  return {
    slug: row.souvenir_slug,
    walletAddress: row.wallet_address?.trim().toUpperCase() ?? "",
    claimedAt: row.claimed_at,
    name: row.title,
    drop: row.drop_name,
    imagePath: row.image_url,
  }
}

export async function listSouvenirDrops(): Promise<CollectibleSouvenir[]> {
  const { data, error } = await db()
    .from(DROPS)
    .select("slug,title,drop_name,image_url,merchant_org_id,claim_starts_at,claim_ends_at")
    .order("created_at", { ascending: false })
  if (error) raise("souvenirs list", error)
  return ((data ?? []) as DropRow[]).map(toSouvenir)
}

export async function listSouvenirDropsForOrg(orgId: string): Promise<CollectibleSouvenir[]> {
  const { data, error } = await db()
    .from(DROPS)
    .select("slug,title,drop_name,image_url,merchant_org_id,claim_starts_at,claim_ends_at")
    .eq("merchant_org_id", orgId)
    .order("created_at", { ascending: false })
  if (error) raise("souvenirs list org", error)
  return ((data ?? []) as DropRow[]).map(toSouvenir)
}

export async function getSouvenirDrop(slug: string): Promise<CollectibleSouvenir | null> {
  const { data, error } = await db()
    .from(DROPS)
    .select("slug,title,drop_name,image_url,merchant_org_id,claim_starts_at,claim_ends_at")
    .eq("slug", slug)
    .maybeSingle()
  if (error) raise("souvenirs get", error)
  return data ? toSouvenir(data as DropRow) : null
}

export async function insertSouvenirDrop(input: {
  slug: string
  title: string
  drop: string
  imageUrl: string
  merchantOrgId: string | null
  claimStartsAt: string
  claimEndsAt: string
}): Promise<CollectibleSouvenir | "conflict"> {
  const { data, error } = await db()
    .from(DROPS)
    .insert({
      slug: input.slug,
      title: input.title,
      drop_name: input.drop,
      image_url: input.imageUrl,
      merchant_org_id: input.merchantOrgId,
      claim_starts_at: input.claimStartsAt,
      claim_ends_at: input.claimEndsAt,
    })
    .select("slug,title,drop_name,image_url,merchant_org_id,claim_starts_at,claim_ends_at")
    .maybeSingle()
  if (error?.code === "23505") return "conflict"
  if (error) raise("souvenirs insert", error)
  return data ? toSouvenir(data as DropRow) : toSouvenir({
    slug: input.slug,
    title: input.title,
    drop_name: input.drop,
    image_url: input.imageUrl,
    merchant_org_id: input.merchantOrgId,
    claim_starts_at: input.claimStartsAt,
    claim_ends_at: input.claimEndsAt,
  })
}

export async function listSouvenirClaimsForUser(userId: string): Promise<ClaimedSouvenir[]> {
  const { data, error } = await db()
    .from(CLAIMS)
    .select("souvenir_slug,user_id,wallet_address,claimed_at,title,drop_name,image_url")
    .eq("user_id", userId)
    .order("claimed_at", { ascending: false })
  if (error) raise("souvenir claims list", error)
  return ((data ?? []) as ClaimRow[]).map(toClaim)
}

export async function getSouvenirClaim(userId: string, slug: string): Promise<ClaimedSouvenir | null> {
  const { data, error } = await db()
    .from(CLAIMS)
    .select("souvenir_slug,user_id,wallet_address,claimed_at,title,drop_name,image_url")
    .eq("user_id", userId)
    .eq("souvenir_slug", slug)
    .maybeSingle()
  if (error) raise("souvenir claims get", error)
  return data ? toClaim(data as ClaimRow) : null
}

export async function insertSouvenirClaim(input: {
  userId: string
  slug: string
  walletAddress: string
  title: string
  drop: string
  imageUrl: string
}): Promise<ClaimedSouvenir | "conflict"> {
  const claimedAt = new Date().toISOString()
  const { data, error } = await db()
    .from(CLAIMS)
    .insert({
      souvenir_slug: input.slug,
      user_id: input.userId,
      wallet_address: input.walletAddress,
      claimed_at: claimedAt,
      title: input.title,
      drop_name: input.drop,
      image_url: input.imageUrl,
    })
    .select("souvenir_slug,user_id,wallet_address,claimed_at,title,drop_name,image_url")
    .maybeSingle()
  if (error?.code === "23505") return "conflict"
  if (error) raise("souvenir claims insert", error)
  return data
    ? toClaim(data as ClaimRow)
    : {
        slug: input.slug,
        walletAddress: input.walletAddress,
        claimedAt,
        name: input.title,
        drop: input.drop,
        imagePath: input.imageUrl,
      }
}

export function isSouvenirStoreUnavailable(error: unknown): boolean {
  return error instanceof SouvenirStoreUnavailableError
}
