import { OfflineLedgerView } from "@/components/offline/offline-ledger"

export const dynamic = "force-dynamic"

export default async function OfflineLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ vault?: string }> | { vault?: string }
}) {
  const params = await Promise.resolve(searchParams)
  return (
    <div className="min-h-[100dvh] bg-black">
      <OfflineLedgerView vaultQuery={params.vault ?? null} />
    </div>
  )
}
