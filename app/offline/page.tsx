import { LinkPhone } from "@/components/offline/link-phone"
import { OfflineLedgerView } from "@/components/offline/offline-ledger"

export const dynamic = "force-dynamic"

export default async function OfflineLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ vault?: string }> | { vault?: string }
}) {
  const params = await Promise.resolve(searchParams)
  return (
    <>
      <LinkPhone />
      <OfflineLedgerView vaultQuery={params.vault ?? null} />
    </>
  )
}
