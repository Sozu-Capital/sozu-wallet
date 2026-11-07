import {
  IdempotencyStoreUnavailableError,
  isValidIdempotencyKey,
  runIdempotent,
  type IdempotencyStore,
} from "@/lib/idempotency/idempotency"
import { parseSacTransferEnvelope, sacTransferIntentKey } from "@/lib/stellar/parse-sac-transfer-envelope"

export const WITHDRAW_IDEMPOTENCY_SCOPE = "withdraw_all"

export type ExpectedWithdrawTransfer = {
  contractId: string
  from: string
  to: string
  amountMinor: bigint
}

export type SubmitWithdrawResult = { status: number; body: Record<string, unknown> | unknown; replayed?: boolean }

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
    return await runIdempotent(
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
          const message = err instanceof Error ? err.message : String(err)
          const { status, code } = classifyWithdrawSubmitError(message)
          return { status, body: { success: false, code, detail: message.slice(0, 300) } }
        }
      },
    )
  } catch (err) {
    if (err instanceof IdempotencyStoreUnavailableError) {
      console.error("[withdraw/submit] idempotency store unavailable:", err.message)
      return { status: 503, body: { success: false, code: "idempotency_unavailable" } }
    }
    throw err
  }
}
