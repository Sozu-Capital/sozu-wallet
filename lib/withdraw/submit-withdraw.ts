import {
  IdempotencyStoreUnavailableError,
  isValidIdempotencyKey,
  runIdempotent,
  type IdempotencyStore,
} from "@/lib/idempotency/idempotency"
import { parseSacTransferEnvelope, sacTransferIntentKey } from "@/lib/stellar/parse-sac-transfer-envelope"
import { SorobanTransactionPendingError } from "@/lib/stellar/soroban-pending"

export const WITHDRAW_IDEMPOTENCY_SCOPE = "withdraw_all"

export type ExpectedWithdrawTransfer = {
  contractId: string
  from: string
  to: string
  amountMinor: bigint
}

export type SubmitWithdrawResult = { status: number; body: Record<string, unknown> | unknown; replayed?: boolean }

export type LedgerLookup = (hash: string) => Promise<"SUCCESS" | "FAILED" | "PENDING">

function pendingHash(body: unknown): string | null {
  if (!body || typeof body !== "object") return null
  const record = body as { code?: unknown; transactionHash?: unknown }
  if (record.code !== "submit_pending") return null
  return typeof record.transactionHash === "string" && /^[a-fA-F0-9]{64}$/.test(record.transactionHash)
    ? record.transactionHash
    : null
}

/** Maps a `submitSignedSorobanEnvelope` error to a client code. Pending means "may still land — don't resend yet". */
export function classifyWithdrawSubmitError(message: string): { status: number; code: string } {
  if (/still pending/i.test(message)) return { status: 502, code: "submit_pending" }
  if (/__check_auth|auth rejected|txBadAuth|signature was rejected/i.test(message)) return { status: 400, code: "submit_auth_rejected" }
  return { status: 400, code: "submit_failed" }
}

/**
 * Withdraw submit: the signed envelope must be exactly the transfer she confirmed (asset, from her
 * session wallet, to the confirmed destination, exact amount), and each idempotency key submits once.
 */
export async function submitWithdraw(params: {
  userId: string
  idempotencyKey: unknown
  signedEnvelopeXdr: unknown
  expected: ExpectedWithdrawTransfer
  networkPassphrase: string
  store: IdempotencyStore
  submitEnvelope: (xdr: string) => Promise<string>
  /** When a stored submit is still pending, read the ledger instead of sending again. */
  lookupLedger?: LedgerLookup
}): Promise<SubmitWithdrawResult> {
  if (!isValidIdempotencyKey(params.idempotencyKey)) {
    return { status: 400, body: { success: false, code: "invalid_idempotency_key" } }
  }
  if (typeof params.signedEnvelopeXdr !== "string" || !params.signedEnvelopeXdr.trim()) {
    return { status: 400, body: { success: false, code: "invalid_envelope" } }
  }
  const signedXdr = params.signedEnvelopeXdr.trim()
  const parsed = parseSacTransferEnvelope(signedXdr, params.networkPassphrase)
  if (!parsed.ok) return { status: 400, body: { success: false, code: "invalid_envelope", reason: parsed.reason } }

  const { intent } = parsed
  const e = params.expected
  const mismatch =
    intent.contractId !== e.contractId
      ? "wrong_contract"
      : intent.from !== e.from
        ? "wrong_sender"
        : intent.to !== e.to
          ? "wrong_destination"
          : intent.amountMinor !== e.amountMinor
            ? "wrong_amount"
            : null
  if (mismatch) return { status: 422, body: { success: false, code: "envelope_mismatch", reason: mismatch } }

  try {
    const result = await runIdempotent(
      params.store,
      {
        userId: params.userId,
        key: params.idempotencyKey,
        scope: WITHDRAW_IDEMPOTENCY_SCOPE,
        fingerprint: sacTransferIntentKey(intent),
      },
      async () => {
        try {
          const transactionHash = await params.submitEnvelope(signedXdr)
          return {
            status: 200,
            body: {
              success: true,
              transactionHash,
              amountMinor: intent.amountMinor.toString(),
              transferTo: intent.to,
            },
          }
        } catch (err) {
          if (err instanceof SorobanTransactionPendingError) {
            return {
              status: 502,
              body: { success: false, code: "submit_pending", transactionHash: err.hash },
            }
          }
          const message = err instanceof Error ? err.message : String(err)
          const { status, code } = classifyWithdrawSubmitError(message)
          return { status, body: { success: false, code, detail: message.slice(0, 300) } }
        }
      },
    )
    return await settlePendingWithdraw(result, {
      userId: params.userId,
      idempotencyKey: params.idempotencyKey,
      amountMinor: intent.amountMinor,
      transferTo: intent.to,
      store: params.store,
      lookupLedger: params.lookupLedger,
    })
  } catch (err) {
    if (err instanceof IdempotencyStoreUnavailableError) {
      console.error("[withdraw/submit] idempotency store unavailable:", err.message)
      return { status: 503, body: { success: false, code: "idempotency_unavailable" } }
    }
    throw err
  }
}

/** A pending idempotency record is not final: the same key resolves to the receipt once the tx lands. */
export async function settlePendingWithdraw(
  result: SubmitWithdrawResult,
  params: {
    userId: string
    idempotencyKey: string
    amountMinor: bigint
    transferTo: string
    store: IdempotencyStore
    lookupLedger?: LedgerLookup
  },
): Promise<SubmitWithdrawResult> {
  const hash = pendingHash(result.body)
  if (!hash || !params.lookupLedger) return result
  let outcome: "SUCCESS" | "FAILED" | "PENDING"
  try {
    outcome = await params.lookupLedger(hash)
  } catch {
    return result
  }
  if (outcome === "PENDING") return result
  const settled: SubmitWithdrawResult =
    outcome === "SUCCESS"
      ? {
          status: 200,
          body: {
            success: true,
            transactionHash: hash,
            amountMinor: params.amountMinor.toString(),
            transferTo: params.transferTo,
          },
        }
      : { status: 400, body: { success: false, code: "submit_failed", transactionHash: hash } }
  try {
    await params.store.complete({
      userId: params.userId,
      key: params.idempotencyKey,
      responseStatus: settled.status,
      responseBody: settled.body,
    })
  } catch (err) {
    console.error("[withdraw/submit] could not store settled pending result:", err)
  }
  return { ...settled, replayed: result.replayed }
}
