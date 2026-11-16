import { NextRequest, NextResponse } from "next/server"

const SOZUPAY_URL = process.env.NEXT_PUBLIC_SOZUPAY_URL || "https://pay.sozu.capital"

/** GET /api/stores?q= — store names from Sozu Pay. */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? ""
  try {
    const res = await fetch(
      `${SOZUPAY_URL}/api/public/stores?q=${encodeURIComponent(q)}`,
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
