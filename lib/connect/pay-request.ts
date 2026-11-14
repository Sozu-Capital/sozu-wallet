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
