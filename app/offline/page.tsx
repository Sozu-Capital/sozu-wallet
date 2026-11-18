import { OfflineHome } from "@/components/offline/offline-home"

export const dynamic = "force-dynamic"

export default async function OfflineLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ vault?: string; deposit?: string; frame?: string }>
}) {
  const params = await searchParams
  return (
    <OfflineHome
      vaultQuery={params.vault ?? null}
      initialDeposit={params.deposit ?? null}
      initialFrame={params.frame ?? null}
    />
  )
}
