import type { SupabaseClient } from "@supabase/supabase-js"
import { RECOVERY_LINK_TTL_MS } from "@/lib/auth/recovery-email"
import { hashRecoveryToken } from "@/lib/auth/recovery-token"

export type RecoveryAccount = {
  linkId: string
  userId: string
  username: string
}

export async function findRecoveryAccount(
  service: SupabaseClient,
  token: string,
): Promise<RecoveryAccount | null> {
  if (!token || token.length < 20) return null
  const tokenHash = hashRecoveryToken(token)
  const { data: link, error } = await service
    .from("account_recovery_links")
    .select("id, user_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .maybeSingle()

  if (error || !link || link.used_at) return null
  if (new Date(link.expires_at).getTime() <= Date.now()) return null

  const { data: profile, error: profileError } = await service
    .from("profiles")
    .select("id, username")
    .eq("id", link.user_id)
    .maybeSingle()

  if (profileError || !profile?.username) return null
  return { linkId: link.id, userId: profile.id, username: profile.username }
}

export function recoveryExpiryIso(): string {
  return new Date(Date.now() + RECOVERY_LINK_TTL_MS).toISOString()
}
