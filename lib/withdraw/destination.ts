import { Account, MuxedAccount, StrKey } from "@stellar/stellar-sdk"

/**
 * Parses the withdraw destination a beneficiary pastes (G…, M… or C…) plus an optional
 * exchange memo into what the SAC `transfer` needs.
 *
 * A transaction that invokes a contract must use MEMO_NONE, so a classic tx memo can't be
 * attached to a Soroban transfer. Since Protocol 23 (CAP-67) the SAC `transfer` `to` argument
 * is a MuxedAddress: a numeric memo (uint64) is carried by sending to the muxed `M…` address
 * of the exchange's G account, and the id is emitted as `to_muxed_id` in the transfer event.
 * Text and hash memos have no Soroban equivalent and are rejected.
 */

export type WithdrawDestinationErrorCode =
  | "empty"
  | "invalid_address"
  | "memo_not_numeric"
  | "memo_too_large"
  | "memo_with_muxed"
  | "memo_on_contract"

export type WithdrawDestination = {
  /** Normalized address the user entered, shown in full on the confirm screen. */
  address: string
  kind: "classic" | "muxed" | "contract"
  /** Ledger account that receives the balance (G… or C…). Trustline is checked here. */
  baseAddress: string
  /** `to` argument for the SAC transfer (G…, M… or C…). */
  transferTo: string
  /** Muxed id / exchange memo as a decimal string, or null. */
  memoId: string | null
}

export type ParseWithdrawDestinationResult =
  | { ok: true; destination: WithdrawDestination }
  | { ok: false; code: WithdrawDestinationErrorCode }

const UINT64_MAX = BigInt("18446744073709551615")

export function normalizeAddressInput(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase()
}

/** Digits only, no leading zeros (a zero-padded memo is a text memo we can't reproduce). */
export function parseMemoId(
  raw: string,
): { ok: true; memoId: string | null } | { ok: false; code: "memo_not_numeric" | "memo_too_large" } {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: true, memoId: null }
  if (!/^(0|[1-9]\d*)$/.test(trimmed)) return { ok: false, code: "memo_not_numeric" }
  if (BigInt(trimmed) > UINT64_MAX) return { ok: false, code: "memo_too_large" }
  return { ok: true, memoId: trimmed }
}

export function muxedAddressFor(baseG: string, memoId: string): string {
  return new MuxedAccount(new Account(baseG, "0"), memoId).accountId()
}

export function parseWithdrawDestination(
  addressRaw: string,
  memoRaw = "",
): ParseWithdrawDestinationResult {
  const address = normalizeAddressInput(addressRaw ?? "")
  if (!address) return { ok: false, code: "empty" }

  const memo = parseMemoId(memoRaw ?? "")
  if (!memo.ok) return { ok: false, code: memo.code }

  if (StrKey.isValidEd25519PublicKey(address)) {
    return {
      ok: true,
      destination: {
        address,
        kind: "classic",
        baseAddress: address,
        transferTo: memo.memoId ? muxedAddressFor(address, memo.memoId) : address,
        memoId: memo.memoId,
      },
    }
  }

  if (StrKey.isValidMed25519PublicKey(address)) {
    if (memo.memoId) return { ok: false, code: "memo_with_muxed" }
    const muxed = MuxedAccount.fromAddress(address, "0")
    return {
      ok: true,
      destination: {
        address,
        kind: "muxed",
        baseAddress: muxed.baseAccount().accountId(),
        transferTo: address,
        memoId: muxed.id(),
      },
    }
  }

  if (StrKey.isValidContract(address)) {
    if (memo.memoId) return { ok: false, code: "memo_on_contract" }
    return {
      ok: true,
      destination: { address, kind: "contract", baseAddress: address, transferTo: address, memoId: null },
    }
  }

  return { ok: false, code: "invalid_address" }
}