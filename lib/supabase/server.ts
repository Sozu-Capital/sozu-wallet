import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { WALLET_SESSION_COOKIE, parseSessionCookieValue } from "@/lib/auth/session-cookie"

type AuthClient = { auth: Pick<SupabaseClient["auth"], "getUser"> }
type UserResponse = Awaited<ReturnType<SupabaseClient["auth"]["getUser"]>>

/**
 * Supabase auth cookies outlive the wallet session (logout clears only the wallet cookie) and can
 * name a different user, so auth.getUser() only reports a user that matches the signed wallet session.
 */
export function bindAuthToWalletSession<T extends AuthClient>(client: T, walletUserId: string | null): T {
  const getUser = client.auth.getUser.bind(client.auth)
  client.auth.getUser = async (...args: Parameters<typeof getUser>): Promise<UserResponse> => {
    const result = await getUser(...args)
    if (walletUserId && result.data.user?.id === walletUserId) return result
    return { data: { user: null }, error: null } as unknown as UserResponse
  }
  return client
}

export async function createClient() {
  const cookieStore = await cookies()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    const missing = []
    if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL")
    if (!supabaseAnonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    
    console.error(`[Supabase] Missing required environment variables: ${missing.join(", ")}`)
    console.error("[Supabase] Please set these in Vercel Dashboard → Settings → Environment Variables")
    
    throw new Error(
      `Missing Supabase environment variables: ${missing.join(", ")}. ` +
      "Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel."
    )
  }

  let walletUserId: string | null = null
  try {
    walletUserId = parseSessionCookieValue(cookieStore.get(WALLET_SESSION_COOKIE)?.value)?.uid ?? null
  } catch {
    // Without WALLET_SESSION_SECRET there is no wallet session, so no Supabase user is reported either.
  }

  const client = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // The "setAll" method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  })

  return bindAuthToWalletSession(client, walletUserId)
}
