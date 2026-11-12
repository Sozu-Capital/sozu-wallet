import { IDEMPOTENCY_KEY_PATTERN } from "@/lib/idempotency/idempotency"

export type MerchOrderStatus = "awaiting_payment" | "charging" | "paid" | "transferring" | "failed" | "completed"

export type MerchOrder = {
  id: string
  attemptId: string
  userId: string
  slug: string
  /** Smart wallet from the session. Never a value the client sent as the payer. */
  payer: string
  priceUsdc: string
  destination: string
  status: MerchOrderStatus
  paymentHash: string | null
  failureReason: string | null
  transferHash: string | null
  transferAttempted: boolean
}

export type PaymentSubmitResult =
  | { ok: true; hash: string }
  | { ok: false; reason: string }

export type PaymentSubmitter = (order: MerchOrder) => Promise<PaymentSubmitResult>

export interface MerchOrderStore {
  getByAttempt(userId: string, attemptId: string): Promise<MerchOrder | null>
  /** An order that can still take the payment: awaiting, charging, or paid. */
  getOpen(userId: string, slug: string): Promise<MerchOrder | null>
  insert(order: MerchOrder): Promise<MerchOrder | "conflict">
  /** Moves awaiting_payment → charging. False when another confirm already claimed it. */
  claimCharge(id: string): Promise<boolean>
  /** Moves paid → transferring. False when a transfer is already claimed or finished. */
  claimTransfer(id: string): Promise<boolean>
  save(order: MerchOrder): Promise<void>
}

export type ConfirmMerchOrderInput = {
  userId: string
  attemptId: string
  slug: string
  payer: string
  priceUsdc: string
  destination: string
}

export type ConfirmMerchOrderResult =
  | { ok: true; order: MerchOrder; submitted: boolean }
  | { ok: false; code: "invalid_attempt" | "invalid_payer" | "invalid_destination" | "invalid_price" }

const OPEN: ReadonlySet<MerchOrderStatus> = new Set(["awaiting_payment", "charging", "paid", "transferring"])

export function isMerchAttemptId(value: string): boolean {
  return IDEMPOTENCY_KEY_PATTERN.test(value)
}

export function createMemoryOrderStore(): MerchOrderStore {
  const byId = new Map<string, MerchOrder>()
  const clone = (order: MerchOrder): MerchOrder => ({ ...order })

  return {
    async getByAttempt(userId, attemptId) {
      for (const order of byId.values()) {
        if (order.userId === userId && order.attemptId === attemptId) return clone(order)
      }
      return null
    },
    async getOpen(userId, slug) {
      for (const order of byId.values()) {
        if (order.userId === userId && order.slug === slug && OPEN.has(order.status)) return clone(order)
      }
      return null
    },
    async insert(order) {
      for (const existing of byId.values()) {
        if (existing.userId === order.userId && existing.attemptId === order.attemptId) return "conflict"
        if (existing.userId === order.userId && existing.slug === order.slug && OPEN.has(existing.status)) {
          return "conflict"
        }
      }
      byId.set(order.id, clone(order))
      return clone(order)
    },
    async claimCharge(id) {
      const order = byId.get(id)
      if (!order || order.status !== "awaiting_payment") return false
      order.status = "charging"
      return true
    },
    async claimTransfer(id) {
      const order = byId.get(id)
      if (!order || order.status !== "paid" || order.transferHash) return false
      order.status = "transferring"
      return true
    },
    async save(order) {
      byId.set(order.id, clone(order))
    },
  }
}

function newOrderId(): string {
  return crypto.randomUUID()
}

async function loadOrCreate(
  input: ConfirmMerchOrderInput,
  store: MerchOrderStore,
): Promise<ConfirmMerchOrderResult | { ok: true; order: MerchOrder }> {
  if (!isMerchAttemptId(input.attemptId)) return { ok: false, code: "invalid_attempt" }
  const payer = input.payer.trim().toUpperCase()
  const destination = input.destination.trim().toUpperCase()
  if (!/^[CG][A-Z2-7]{55}$/.test(payer)) return { ok: false, code: "invalid_payer" }
  if (!/^[CG][A-Z2-7]{55}$/.test(destination)) return { ok: false, code: "invalid_destination" }
  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(input.priceUsdc.trim())) return { ok: false, code: "invalid_price" }

  const existingAttempt = await store.getByAttempt(input.userId, input.attemptId)
  const open = existingAttempt ?? (await store.getOpen(input.userId, input.slug))
  if (open) return { ok: true, order: open }

  const created: MerchOrder = {
    id: newOrderId(),
    attemptId: input.attemptId,
    userId: input.userId,
    slug: input.slug,
    payer,
    priceUsdc: input.priceUsdc.trim(),
    destination,
    status: "awaiting_payment",
    paymentHash: null,
    failureReason: null,
    transferHash: null,
    transferAttempted: false,
  }
  const inserted = await store.insert(created)
  if (inserted === "conflict") {
    const raced =
      (await store.getByAttempt(input.userId, input.attemptId)) ??
      (await store.getOpen(input.userId, input.slug))
    if (!raced) return { ok: false, code: "invalid_attempt" }
    return { ok: true, order: raced }
  }
  return { ok: true, order: inserted }
}

/** Creates the attempt's order, or resumes the open one. Does not submit a payment. */
export async function openMerchOrder(
  input: ConfirmMerchOrderInput,
  store: MerchOrderStore,
): Promise<ConfirmMerchOrderResult> {
  const loaded = await loadOrCreate(input, store)
  if (!loaded.ok) return loaded
  return { ok: true, order: loaded.order, submitted: false }
}

/**
 * One USDC payment for one attempt. A retry returns the same order and does not submit again.
 * A failed payment is stored with a reason and does not transfer a collectible.
 * A later attempt, after failure or completion, is a new order.
 */
export async function confirmMerchOrder(
  input: ConfirmMerchOrderInput,
  store: MerchOrderStore,
  submit: PaymentSubmitter,
): Promise<ConfirmMerchOrderResult> {
  const loaded = await loadOrCreate(input, store)
  if (!loaded.ok) return loaded
  let order = loaded.order

  if (order.status !== "awaiting_payment") {
    return { ok: true, order, submitted: false }
  }

  const claimed = await store.claimCharge(order.id)
  if (!claimed) {
    const current = (await store.getByAttempt(input.userId, order.attemptId)) ?? order
    return { ok: true, order: current, submitted: false }
  }

  const charging: MerchOrder = { ...order, status: "charging" }
  let result: PaymentSubmitResult
  try {
    result = await submit(charging)
  } catch (err) {
    result = { ok: false, reason: err instanceof Error ? err.message : "payment_failed" }
  }

  const finished: MerchOrder = result.ok
    ? {
        ...charging,
        status: "paid",
        paymentHash: result.hash,
        failureReason: null,
        transferHash: null,
        transferAttempted: false,
      }
    : {
        ...charging,
        status: "failed",
        paymentHash: null,
        failureReason: result.reason,
        transferHash: null,
        transferAttempted: false,
      }
  await store.save(finished)
  return { ok: true, order: finished, submitted: true }
}
