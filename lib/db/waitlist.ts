import "server-only"

import { createClient as createServiceClient } from "@supabase/supabase-js"
import type { WaitlistLocale } from "@/lib/waitlist/signup"

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase service role not configured")
  return createServiceClient(url, key, { auth: { persistSession: false } })
}

/** True when this email was new. A repeat signup returns false and does not throw. */
export async function addWaitlistSignup(params: {
  email: string
  locale: WaitlistLocale | null
  source: string | null
}): Promise<boolean> {
  const { error } = await getServiceClient()
    .from("waitlist_signups")
    .insert({ email: params.email, locale: params.locale, source: params.source })
  if (!error) return true
  if (error.code === "23505" || /duplicate key/i.test(error.message)) return false
  throw new Error(`waitlist insert failed: ${error.message}`)
}
