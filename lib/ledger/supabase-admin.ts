import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { getSessionUserId } from "@/lib/auth/session"

export type ApiUserContext = {
  userId: string
  db: SupabaseClient
}

/**
 * Resolves the acting user from the signed wallet session cookie.
 * Uses the service role client when available because wallet sessions are not Supabase sessions.
 */
export async function getApiUserClient(request: Request): Promise<ApiUserContext | null> {
  const userId = getSessionUserId(request)
  if (!userId) return null

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (serviceKey && url) {
    return {
      userId,
      db: createServiceClient(url, serviceKey),
    }
  }

  return { userId, db: await createClient() }
}
