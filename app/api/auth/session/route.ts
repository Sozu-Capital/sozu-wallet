import { NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

/**
 * Reports whether the httpOnly wallet cookie is present and valid.
 * Local storage can still say "signed in" after the cookie expires or is cleared.
 */
export async function GET(request: Request) {
  const userId = getSessionUserId(request)
  if (!userId) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
  return NextResponse.json({ authenticated: true })
}
