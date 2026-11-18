import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/session"
import { listMerchItems } from "@/lib/merch/catalog"
import { heldCollectibleSlugs } from "@/lib/merch/collections"
import { tryGetSorobanTokenBalance } from "@/lib/stellar/soroban-token"
import { resolveWithdrawSender } from "@/lib/withdraw/prepare-withdraw"

/** Registered item contracts this session wallet holds. Other tokens are not read. */
export async function GET(request: NextRequest) {
  const auth = requireSession(request)
  if (auth.error) return auth.error

  const items = listMerchItems().filter((item) => item.contractId)
  const network = items[0]?.network ?? "testnet"
  const resolved = await resolveWithdrawSender(auth.userId, network)
  if (!resolved.ok) return NextResponse.json({ slugs: [] })

  const balances: Record<string, number | null> = {}
  await Promise.all(
    items.map(async (item) => {
      const contractId = item.contractId!.trim().toUpperCase()
      balances[contractId] = await tryGetSorobanTokenBalance(contractId, resolved.sender.senderC, item.network, 0)
    }),
  )

  return NextResponse.json({ slugs: heldCollectibleSlugs(items, balances) })
}
