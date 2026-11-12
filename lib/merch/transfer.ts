import type { MerchOrder, MerchOrderStore, PaymentSubmitResult } from "@/lib/merch/order"

export type CollectibleTransfer = (order: MerchOrder) => Promise<PaymentSubmitResult>

export type DeliverCollectibleResult =
  | { ok: true; order: MerchOrder; transferred: boolean }
  | { ok: false; code: "not_paid" }

/**
 * Moves one collectible after the USDC payment is stored.
 * A second call for the same order does not send another unit.
 * A failed payment is refused. A failed transfer leaves the order paid.
 */
export async function deliverMerchCollectible(
  order: MerchOrder,
  store: MerchOrderStore,
  transfer: CollectibleTransfer,
): Promise<DeliverCollectibleResult> {
  if (order.status === "failed" || order.status === "awaiting_payment" || order.status === "charging") {
    return { ok: false, code: "not_paid" }
  }
  if (order.status === "completed" || order.transferHash) {
    const current = (await store.getByAttempt(order.userId, order.attemptId)) ?? order
    return { ok: true, order: current, transferred: false }
  }
  if (order.status === "transferring") {
    return { ok: true, order, transferred: false }
  }

  const claimed = await store.claimTransfer(order.id)
  if (!claimed) {
    const current = (await store.getByAttempt(order.userId, order.attemptId)) ?? order
    return { ok: true, order: current, transferred: false }
  }

  let result: PaymentSubmitResult
  try {
    result = await transfer({ ...order, status: "transferring", transferAttempted: true })
  } catch (err) {
    result = { ok: false, reason: err instanceof Error ? err.message : "transfer_failed" }
  }

  const finished: MerchOrder = result.ok
    ? {
        ...order,
        status: "completed",
        transferHash: result.hash,
        transferAttempted: true,
        failureReason: null,
      }
    : {
        ...order,
        status: "paid",
        transferHash: null,
        transferAttempted: true,
        failureReason: result.reason,
      }
  await store.save(finished)
  return { ok: true, order: finished, transferred: result.ok }
}
