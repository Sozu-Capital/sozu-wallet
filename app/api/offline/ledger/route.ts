import { NextResponse } from "next/server"
import { loadOfflineLedger, resolveVaultId } from "@/lib/offline/vault-ledger"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const vault = resolveVaultId(url.searchParams.get("vault"))
  try {
    const ledger = await loadOfflineLedger(vault)
    return NextResponse.json(ledger, {
      headers: { "Cache-Control": "public, max-age=15" },
    })
  } catch {
    return NextResponse.json(
      { error: "offline ledger unavailable" },
      { status: 502 },
    )
  }
}
