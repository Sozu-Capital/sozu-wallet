import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { clearSessionCookie } from "@/lib/auth/session"

export async function POST() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return clearSessionCookie(
    NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000")),
  )
}
