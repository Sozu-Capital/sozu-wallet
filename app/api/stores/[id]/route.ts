import { NextResponse } from "next/server"

const SOZUPAY_URL = process.env.NEXT_PUBLIC_SOZUPAY_URL || "https://pay.sozu.capital"

type Params = { params: Promise<{ id: string }> }

/** GET /api/stores/[id] — store profile and items for sale. */
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  try {
    const res = await fetch(`${SOZUPAY_URL}/api/public/stores/${encodeURIComponent(id)}`, {
      cache: "no-store",
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: "No se pudo abrir el local" }, { status: 502 })
  }
}
