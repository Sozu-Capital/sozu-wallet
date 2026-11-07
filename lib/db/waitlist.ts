import "server-only"

import { createClient as createServiceClient } from "@supabase/supabase-js"
import type { WaitlistLocale } from "@/lib/waitlist/signup"

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase service role not configured")
  return createServiceClient(url, key, { auth: { persistSession: false } })
}

/** Idempotent: a repeat email is a no-op, so callers can't tell who already signed up. */
export async function addWaitlistSignup(params: {
  email: string
  locale: WaitlistLocale | null
  source: string | null
}): Promise<void> {
  const { error } = await getServiceClient()
    .from("waitlist_signups")
    .upsert(
      { email: params.email, locale: params.locale, source: params.source },
      { onConflict: "email", ignoreDuplicates: true },
    )
  if (error) throw new Error(`waitlist insert failed: ${error.message}`)
}
