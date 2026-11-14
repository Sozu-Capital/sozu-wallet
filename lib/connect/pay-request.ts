import { isContractStellarAddress, isValidStellarReceiveAddress } from "@/lib/payment/stellar-address"
import { SOZU_CONNECT_MESSAGE_TYPE, sozuConnectSuccess } from "@/lib/connect/popup-result"

const USDC_AMOUNT = /^(?:0|[1-9]\d*)(?:\.\d{1,7})?$/
const TX_HASH = /^[a-f0-9]{64}$/i

export type SozuPayRequest = {
  amount: string
  to: string
}

export type SozuConnectPayment = {
  type: typeof SOZU_CONNECT_MESSAGE_TYPE
  txHash: string
  username: string
  accountId: string
}

export type SozuConnectInsufficient = {
  type: typeof SOZU_CONNECT_MESSAGE_TYPE
  username: string
  accountId: string
  error: "insufficient_funds"
}

export type CircleBalancePayload = {
  tokenBalances?: { assetId?: string; balance?: number }[]
  sorobanSacUsdcBalance?: number
}

/** Circle USDC amount: a positive decimal string with at most 7 decimal places. */
export function isCircleUsdcAmount(value: string): boolean {
  const amount = value.trim()
  if (!USDC_AMOUNT.test(amount)) return false
  const parsed = Number(amount)
  return Number.isFinite(parsed) && parsed > 0
}

export function readSozuPayRequest(params: {
  get(name: string): string | null
}): SozuPayRequest | null {
  const amount = params.get("amount")?.trim() ?? ""
  const to = params.get("to")?.trim().toUpperCase() ?? ""
  if (!isCircleUsdcAmount(amount)) return null
  if (!isValidStellarReceiveAddress(to)) return null
  return { amount, to }
}

export function circleSacBalance(payload: CircleBalancePayload): number {
  const row = payload.tokenBalances?.find((item) => item.assetId === "circle_usdc_sac")
  if (row && typeof row.balance === "number" && Number.isFinite(row.balance)) return row.balance
  if (typeof payload.sorobanSacUsdcBalance === "number" && Number.isFinite(payload.sorobanSacUsdcBalance)) {
    return payload.sorobanSacUsdcBalance
  }
  return 0
}

/** Circle SAC only. Blend and Sozu Test balances do not count. */
export function circleSacCoversAmount(balance: number, amount: string): boolean {
  const need = Number(amount)
  return Number.isFinite(balance) && Number.isFinite(need) && balance >= need
}

export function sozuConnectInsufficient(
  username: string,
  accountId: string,
): SozuConnectInsufficient | null {
  const account = sozuConnectSuccess(username, accountId)
  if (!account) return null
  return {
    type: SOZU_CONNECT_MESSAGE_TYPE,
    username: account.username,
    accountId: account.accountId,
    error: "insufficient_funds",
  }
}

export function sozuConnectPayment(
  username: string | null | undefined,
  accountId: string | null | undefined,
  txHash: string | null | undefined,
): SozuConnectPayment | null {
  const account = sozuConnectSuccess(username, accountId)
  const hash = txHash?.trim().toLowerCase() ?? ""
  if (!account || !TX_HASH.test(hash)) return null
  if (!isContractStellarAddress(account.accountId)) return null
  return {
    type: SOZU_CONNECT_MESSAGE_TYPE,
    txHash: hash,
    username: account.username,
    accountId: account.accountId,
  }
}
