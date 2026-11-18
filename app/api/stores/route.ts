import { NextRequest, NextResponse } from "next/server"
import { sozuPayOriginFromRequest } from "@/lib/sozupay-origin"

/** GET /api/stores?q= — store names from Sozu Pay. */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? ""
  try {
    const res = await fetch(
      `${sozuPayOriginFromRequest(request)}/api/public/stores?q=${encodeURIComponent(q)}`,
      { cache: "no-store" },
    )
    const data = await res.json().catch(() => ({ stores: [] }))
    if (!res.ok) {
      return NextResponse.json({ error: "No se pudo buscar locales", stores: [] }, { status: res.status })
    }
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "No se pudo buscar locales", stores: [] }, { status: 502 })
  }
}
