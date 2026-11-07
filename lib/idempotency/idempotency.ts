/**
 * Idempotent payment submits. The client sends one key per confirm; the first request with a
 * key runs, later requests with the same key and the same fingerprint get the stored response
 * (or 409 while the first is still running) instead of submitting again.
 *
 * The fingerprint describes the payment intent (asset, from, to, amount), not the signed bytes:
 * a double tap produces two different passkey signatures for the same payment and must still
 * resolve to the first result.
 */

export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{16,128}$/

export function isValidIdempotencyKey(value: unknown): value is string {
  return typeof value === "string" && IDEMPOTENCY_KEY_PATTERN.test(value)
}

export type IdempotencyRecord = {
  scope: string
  fingerprint: string
  status: "in_progress" | "completed"
  responseStatus: number | null
  responseBody: unknown
}

export type IdempotencyClaim = {
  userId: string
  key: string
  scope: string
  fingerprint: string
}

export interface IdempotencyStore {
  /** Atomically inserts an in-progress record. Returns null when this call owns the key, else the existing record. */
  claim(claim: IdempotencyClaim): Promise<IdempotencyRecord | null>
  complete(params: { userId: string; key: string; responseStatus: number; responseBody: unknown }): Promise<void>
}

/** Raised by stores when the backing table is missing (migration not applied). */
export class IdempotencyStoreUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "IdempotencyStoreUnavailableError"
  }
}

export type IdempotentResponse = { status: number; body: unknown; replayed: boolean }

export const IDEMPOTENCY_IN_PROGRESS_CODE = "IDEMPOTENCY_IN_PROGRESS"
export const IDEMPOTENCY_KEY_REUSED_CODE = "IDEMPOTENCY_KEY_REUSED"

export async function runIdempotent(
  store: IdempotencyStore,
  claim: IdempotencyClaim,
  execute: () => Promise<{ status: number; body: unknown }>,
): Promise<IdempotentResponse> {
  const existing = await store.claim(claim)
  if (existing) {
    if (existing.scope !== claim.scope || existing.fingerprint !== claim.fingerprint) {
      return {
        status: 422,
        body: { success: false, code: IDEMPOTENCY_KEY_REUSED_CODE, error: "Idempotency key was already used for a different payment." },
        replayed: true,
      }
    }
    if (existing.status === "in_progress" || existing.responseStatus == null) {
      return {
        status: 409,
        body: { success: false, code: IDEMPOTENCY_IN_PROGRESS_CODE, error: "This payment is already being submitted." },
        replayed: true,
      }
    }
    return { status: existing.responseStatus, body: existing.responseBody, replayed: true }
  }

  let result: { status: number; body: unknown }
  try {
    result = await execute()
  } catch (err) {
    console.error("[idempotency] execute threw:", err)
    result = { status: 500, body: { success: false, code: "INTERNAL_ERROR", error: "Payment submit failed unexpectedly." } }
  }

  try {
    await store.complete({ userId: claim.userId, key: claim.key, responseStatus: result.status, responseBody: result.body })
  } catch (err) {
    // The record stays in_progress: replays get 409, never a second submit.
    console.error("[idempotency] could not store result:", err)
  }
  return { ...result, replayed: false }
}

/** In-memory store for tests and local scripts. */
export function createMemoryIdempotencyStore(): IdempotencyStore & { size(): number } {
  const rows = new Map<string, IdempotencyRecord>()
  const id = (userId: string, key: string) => `${userId}\u0000${key}`
  return {
    async claim(c) {
      const existing = rows.get(id(c.userId, c.key))
      if (existing) return { ...existing }
      rows.set(id(c.userId, c.key), {
        scope: c.scope,
        fingerprint: c.fingerprint,
        status: "in_progress",
        responseStatus: null,
        responseBody: null,
      })
      return null
    },
    async complete(p) {
      const row = rows.get(id(p.userId, p.key))
      if (!row) return
      rows.set(id(p.userId, p.key), { ...row, status: "completed", responseStatus: p.responseStatus, responseBody: p.responseBody })
    },
    size: () => rows.size,
  }
}
