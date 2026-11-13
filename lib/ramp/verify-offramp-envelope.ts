import "server-only"

import { Address, FeeBumpTransaction, Transaction, TransactionBuilder, xdr } from "@stellar/stellar-sdk"

/**
 * Binds a passkey-signed off-ramp envelope to the specific order it claims to
 * settle. Without this check the submit route would submit ANY envelope the
 * caller signs (e.g. a 1-stroop self-transfer their own passkey can sign) and
 * still pay the order's full `usdc_minor` from treasury via
 * `sendAnchorPayment` — a treasury drain. Mirrors the build side
 * (`lib/stellar/send-token.ts`'s `sendToken`/`amountToI128ScVal`): a single
 * `invokeHostFunction` operation calling `transfer(from, to, amount)` on the
 * expected SAC contract, with `from`/`to`/`amount` matching the order exactly.
 */
export type OfframpEnvelopeVerification = { ok: true } | { ok: false; reason: string }

export interface VerifyOfframpEnvelopeExpected {
  /** The order's recorded sender — the user's smart account (C…). */
  senderC: string
  /** Treasury classic G — must be the sole payment destination. */
  treasuryG: string
  /** Circle USDC SAC contract id for the network. */
  sacContractId: string
  /** order.usdc_minor — the ONLY amount the server will ever pay the anchor. */
  amountMinor: number
  networkPassphrase: string
}

function i128ToBigInt(val: xdr.ScVal): bigint {
  if (val.type !== "scvI128") return BigInt(0)
  return (val.i128.hi << BigInt(64)) + val.i128.lo
}

function functionNameToString(name: { toString(): string }): string {
  return name.toString()
}

export function verifyOfframpEnvelope(
  envelopeXdr: string,
  expected: VerifyOfframpEnvelopeExpected,
): OfframpEnvelopeVerification {
  let parsed: Transaction | FeeBumpTransaction
  try {
    parsed = TransactionBuilder.fromXDR(envelopeXdr, expected.networkPassphrase)
  } catch {
    return { ok: false, reason: "unparseable" }
  }
  if (!(parsed instanceof Transaction)) {
    return { ok: false, reason: "fee_bump_not_allowed" }
  }
  if (parsed.operations.length !== 1) {
    return { ok: false, reason: "wrong_operation_count" }
  }

  const op = parsed.operations[0]
  if (op.type !== "invokeHostFunction") {
    return { ok: false, reason: "not_invoke_host_function" }
  }
  const func = (op as unknown as { func: xdr.HostFunction }).func
  if (func.type !== "hostFunctionTypeInvokeContract") {
    return { ok: false, reason: "not_contract_invocation" }
  }

  const invoke = func.invokeContract
  const contractId = Address.fromScAddress(invoke.contractAddress).toString().trim().toUpperCase()
  if (contractId !== expected.sacContractId.trim().toUpperCase()) {
    return { ok: false, reason: "wrong_contract" }
  }

  const fnName = functionNameToString(invoke.functionName)
  if (fnName !== "transfer") {
    return { ok: false, reason: "not_transfer" }
  }

  const args = invoke.args
  if (args.length !== 3) {
    return { ok: false, reason: "wrong_arg_count" }
  }
  const [fromArg, toArg, amountArg] = args
  if (fromArg.type !== "scvAddress" || toArg.type !== "scvAddress") {
    return { ok: false, reason: "wrong_arg_types" }
  }

  const from = Address.fromScVal(fromArg).toString().trim().toUpperCase()
  if (from !== expected.senderC.trim().toUpperCase()) {
    return { ok: false, reason: "wrong_sender" }
  }

  const to = Address.fromScVal(toArg).toString().trim().toUpperCase()
  if (to !== expected.treasuryG.trim().toUpperCase()) {
    return { ok: false, reason: "wrong_destination" }
  }

  if (amountArg.type !== "scvI128") {
    return { ok: false, reason: "wrong_amount_type" }
  }
  const amount = i128ToBigInt(amountArg)
  if (amount !== BigInt(expected.amountMinor)) {
    return { ok: false, reason: "wrong_amount" }
  }

  return { ok: true }
}
