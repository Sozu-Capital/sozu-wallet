import { describe, expect, it, vi } from "vitest"
import { confirmMerchOrder, createMemoryOrderStore, type PaymentSubmitter } from "./order"
import { deliverMerchCollectible, type CollectibleTransfer } from "./transfer"

const PAYER = `C${"A".repeat(55)}`
const MERCH = `G${"A".repeat(55)}`

function input(attemptId: string) {
  return {
    userId: "user-1",
    attemptId,
    slug: "liquid-society",
    payer: PAYER,
    priceUsdc: "12",
    destination: MERCH,
  }
}

async function pay(attemptId: string, store: ReturnType<typeof createMemoryOrderStore>) {
  const submit = vi.fn<PaymentSubmitter>(async () => ({ ok: true, hash: "e".repeat(64) }))
  const paid = await confirmMerchOrder(input(attemptId), store, submit)
  if (!paid.ok) throw new Error(paid.code)
  return paid.order
}

describe("merch collectible transfer", () => {
  it("sends one unit after payment and does not send a second unit on retry", async () => {
    const store = createMemoryOrderStore()
    const order = await pay("attempt-paid-0000000001", store)
    const transfer = vi.fn<CollectibleTransfer>(async (current) => {
      expect(current.payer).toBe(PAYER)
      expect(current.priceUsdc).toBe("12")
      return { ok: true, hash: "f".repeat(64) }
    })

    const first = await deliverMerchCollectible(order, store, transfer)
    const retry = await deliverMerchCollectible(first.ok ? first.order : order, store, transfer)

    expect(transfer).toHaveBeenCalledTimes(1)
    expect(first.ok && first.transferred).toBe(true)
    expect(first.ok && first.order).toMatchObject({
      status: "completed",
      transferHash: "f".repeat(64),
      paymentHash: "e".repeat(64),
    })
    expect(retry.ok && retry.transferred).toBe(false)
    expect(retry.ok && retry.order.transferHash).toBe("f".repeat(64))
    const keys = Object.keys(first.ok ? first.order : {})
    expect(keys.some((key) => /secret|signer/i.test(key))).toBe(false)
  })

  it("refuses a failed payment and does not transfer", async () => {
    const store = createMemoryOrderStore()
    const failed = await confirmMerchOrder(input("attempt-fail-0000000001"), store, async () => ({
      ok: false,
      reason: "passkey_rejected",
    }))
    if (!failed.ok) throw new Error(failed.code)
    const transfer = vi.fn<CollectibleTransfer>(async () => ({ ok: true, hash: "f".repeat(64) }))

    const result = await deliverMerchCollectible(failed.order, store, transfer)

    expect(transfer).not.toHaveBeenCalled()
    expect(result).toEqual({ ok: false, code: "not_paid" })
    expect(failed.order.transferHash).toBeNull()
    expect(failed.order.transferAttempted).toBe(false)
  })

  it("leaves a failed transfer paid so it can be retried", async () => {
    const store = createMemoryOrderStore()
    const order = await pay("attempt-retry-000000001", store)
    const transfer = vi
      .fn<CollectibleTransfer>()
      .mockResolvedValueOnce({ ok: false, reason: "rpc_unavailable" })
      .mockResolvedValueOnce({ ok: true, hash: "1".repeat(64) })

    const failed = await deliverMerchCollectible(order, store, transfer)
    const retried = await deliverMerchCollectible(failed.ok ? failed.order : order, store, transfer)

    expect(failed.ok && failed.order.status).toBe("paid")
    expect(failed.ok && failed.order.transferHash).toBeNull()
    expect(failed.ok && failed.order.failureReason).toBe("rpc_unavailable")
    expect(failed.ok && failed.transferred).toBe(false)
    expect(retried.ok && retried.transferred).toBe(true)
    expect(retried.ok && retried.order.status).toBe("completed")
    expect(transfer).toHaveBeenCalledTimes(2)
  })
})
