import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { isSameSozuTag, pickTagOwner } from "@/lib/wallet/canonical-smart-account"

export type CanonicalTagOwner = {
  id: string
  username: string
}

/**
 * Case-insensitive tag lookup. Duplicate profiles keep the earliest wallet.
 */
export async function findCanonicalTagOwner(
  svc: SupabaseClient,
  rawTag: string,
): Promise<CanonicalTagOwner | null> {
  const tag = rawTag.trim().replace(/^\$+/, "")
  if (!tag) return null

  const { data, error } = await svc
    .from("profiles")
    .select("id, username")
    .ilike("username", tag)
    .limit(10)
  if (error || !data?.length) return null

  const matches = data.filter(
    (profile) => typeof profile.username === "string" && isSameSozuTag(profile.username, tag),
  )
  if (matches.length === 0) return null

  const { data: wallets } = await svc
    .from("stellar_wallets")
    .select("user_id, created_at, updated_at")
    .in(
      "user_id",
      matches.map((profile) => profile.id),
    )

  const createdAt = new Map<string, string | null>()
  for (const wallet of wallets ?? []) {
    const row = wallet as { user_id?: string; created_at?: string | null; updated_at?: string | null }
    if (!row.user_id) continue
    createdAt.set(row.user_id, row.created_at ?? row.updated_at ?? null)
  }

  const owner = pickTagOwner(
    matches.map((profile) => ({
      id: profile.id,
      username: profile.username,
      walletCreatedAt: createdAt.get(profile.id) ?? null,
    })),
  )
  if (!owner?.username) return null
  return { id: owner.id, username: owner.username }
}
