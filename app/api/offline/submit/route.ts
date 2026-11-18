import { NextResponse } from "next/server"
import { submitOfflineCheque, submitSignedOfflineCheque } from "@/lib/offline/submit-cheque"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const signed = typeof body?.signedEnvelopeXdr === "string" ? body.signedEnvelopeXdr.trim() : ""
  if (signed) {
    const result = await submitSignedOfflineCheque(signed)
    if (!result.ok) {
      return NextResponse.json({ error: result.error, reason: result.reason }, { status: 422 })
    }
    return NextResponse.json({
      hash: result.hash,
      ledgerUrl: "https://dev.sozu.capital/offline",
    })
  }

  const frame = typeof body?.frame === "string" ? body.frame : ""
  const settler = typeof body?.settler === "string" ? body.settler : ""
  const result = await submitOfflineCheque(frame, settler)
  if (!result.ok) {
    return NextResponse.json({ error: result.error, reason: result.reason }, { status: 422 })
  }
  return NextResponse.json({
    hash: result.hash,
    settler: result.settler,
    ledgerUrl: "https://dev.sozu.capital/offline",
  })
}
