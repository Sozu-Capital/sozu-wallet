import { NextRequest, NextResponse } from "next/server"
import { sozuPayOriginFromRequest } from "@/lib/sozupay-origin"

type Params = { params: Promise<{ id: string }> }

/**
 * POST /api/stores/[id]/pay
 * { slug } pays an item. { amountUsd } sends a custom amount to the store.
 * Returns the wallet checkout id so the payer stays in Sozu and gets a receipt.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  try {
    const res = await fetch(
      `${sozuPayOriginFromRequest(request)}/api/public/stores/${encodeURIComponent(id)}/pay`,
      {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json(
        { error: typeof data.error === "string" ? data.error : "No se pudo iniciar el pago" },
        { status: res.status },
      )
    }
    return NextResponse.json({
      checkoutId: data.id,
      amountUsd: data.amountUsd,
      itemName: data.itemName ?? null,
      storeName: data.storeName ?? null,
    })
  } catch {
    return NextResponse.json({ error: "No se pudo iniciar el pago" }, { status: 502 })
  }
}
