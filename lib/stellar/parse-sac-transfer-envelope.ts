import { Address, Transaction, TransactionBuilder, xdr } from "@stellar/stellar-sdk"
import { i128ScValToBigInt } from "@/lib/withdraw/amount"

/**
 * Reads the single `transfer(from, to, amount)` call out of a Soroban envelope.
 * `to` keeps its muxed form (M…) when the transfer carries an exchange memo id.
 */
export type SacTransferIntent = {
  contractId: string
  from: string
  to: string
  amountMinor: bigint
  /** Inner transaction hash (hex) — what the network will report once included. */
  txHash: string
}

export type ParseSacTransferResult = { ok: true; intent: SacTransferIntent } | { ok: false; reason: string }

export function parseSacTransferEnvelope(envelopeXdr: string, networkPassphrase: string): ParseSacTransferResult {
  let parsed: ReturnType<typeof TransactionBuilder.fromXDR>
  try {
    parsed = TransactionBuilder.fromXDR(envelopeXdr.trim(), networkPassphrase)
  } catch {
    return { ok: false, reason: "unparseable" }
  }
  if (!(parsed instanceof Transaction)) return { ok: false, reason: "fee_bump_not_allowed" }
  if (parsed.operations.length !== 1) return { ok: false, reason: "wrong_operation_count" }

  const op = parsed.operations[0]
  if (op.type !== "invokeHostFunction") return { ok: false, reason: "not_invoke_host_function" }
  const func = (op as unknown as { func: xdr.HostFunction }).func
  if (func.type !== "hostFunctionTypeInvokeContract") return { ok: false, reason: "not_contract_invocation" }

  const invoke = func.invokeContract
  const fnName = invoke.functionName.toString()
  if (fnName !== "transfer") {
    return { ok: false, reason: "not_transfer" }
  }
  const args = invoke.args
  if (args.length !== 3) return { ok: false, reason: "wrong_arg_count" }
  const [fromArg, toArg, amountArg] = args
  if (fromArg.type !== "scvAddress" || toArg.type !== "scvAddress") {
    return { ok: false, reason: "wrong_arg_types" }
  }
  if (amountArg.type !== "scvI128") return { ok: false, reason: "wrong_amount_type" }

  return {
    ok: true,
    intent: {
      contractId: Address.fromScAddress(invoke.contractAddress).toString(),
      from: Address.fromScVal(fromArg).toString(),
      to: Address.fromScVal(toArg).toString(),
      amountMinor: i128ScValToBigInt(amountArg),
      txHash: Buffer.from(parsed.hash()).toString("hex"),
    },
  }
}

/** Stable fingerprint of what a transfer does, independent of signatures and sequence numbers. */
export function sacTransferIntentKey(intent: Pick<SacTransferIntent, "contractId" | "from" | "to" | "amountMinor">): string {
  return [intent.contractId, intent.from, intent.to, intent.amountMinor.toString()].join("|")
}
