import { decimalStringToMinor } from "@/lib/withdraw/amount"
import type { WithdrawUsdcAsset } from "@/lib/withdraw/usdc-asset"

/**
 * A SAC transfer to a G account fails unless the account exists and holds an authorized USDC
 * trustline with room for the amount. These checks run before she signs so the error is ours,
 * in Spanish, instead of a failed transaction.
 */

export type DestinationCheckCode =
  | "destination_not_found"
  | "destination_no_trustline"
  | "destination_trustline_unauthorized"
  | "destination_trustline_full"
  | "contract_not_found"
  | "destination_check_failed"

export type DestinationCheckResult = { ok: true } | { ok: false; code: DestinationCheckCode }

export type HorizonBalance = {
  asset_type: string
  asset_code?: string
  asset_issuer?: string
  balance: string
  limit?: string
  buying_liabilities?: string
  is_authorized?: boolean
}

/** Pure: evaluates a Horizon `/accounts/{G}` body (null when the account is not on-chain). */
export function evaluateClassicDestination(
  account: { balances?: HorizonBalance[] } | null,
  baseAddress: string,
  asset: Pick<WithdrawUsdcAsset, "code" | "issuer" | "decimals">,
  amountMinor: bigint,
): DestinationCheckResult {
  if (!account) return { ok: false, code: "destination_not_found" }
  if (baseAddress === asset.issuer) return { ok: true }

  const line = (account.balances ?? []).find(
    (b) => b.asset_type !== "native" && b.asset_code === asset.code && b.asset_issuer === asset.issuer,
  )
  if (!line) return { ok: false, code: "destination_no_trustline" }
  if (line.is_authorized === false) return { ok: false, code: "destination_trustline_unauthorized" }

  const balance = decimalStringToMinor(line.balance, asset.decimals)
  const limit = line.limit ? decimalStringToMinor(line.limit, asset.decimals) : null
  const buying =
    line.buying_liabilities == null || line.buying_liabilities === ""
      ? BigInt(0)
      : decimalStringToMinor(line.buying_liabilities, asset.decimals)
  if (buying == null) return { ok: false, code: "destination_trustline_full" }
  if (balance != null && limit != null && limit - balance - buying < amountMinor) {
    return { ok: false, code: "destination_trustline_full" }
  }
  return { ok: true }
}

export async function fetchHorizonAccount(
  horizonUrl: string,
  accountId: string,
): Promise<{ balances?: HorizonBalance[] } | null> {
  const res = await fetch(`${horizonUrl.replace(/\/$/, "")}/accounts/${accountId}`, { cache: "no-store" })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Horizon /accounts returned ${res.status}`)
  return (await res.json()) as { balances?: HorizonBalance[] }
}
