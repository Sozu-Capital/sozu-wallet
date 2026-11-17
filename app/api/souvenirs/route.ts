import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/session"
import { loadAccountSouvenirs } from "@/lib/merch/account-souvenirs"

/** Catalog every wallet sees, plus this account's collected badges. */
export async function GET(request: NextRequest) {
  const auth = requireSession(request)
  if (auth.error) return auth.error

  const { catalog, claims } = await loadAccountSouvenirs(auth.userId)
  return NextResponse.json({ catalog, claims })
}
