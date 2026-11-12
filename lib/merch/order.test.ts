import { describe, expect, it, vi } from "vitest"
import { confirmMerchOrder, createMemoryOrderStore, type MerchOrder, type PaymentSubmitter } from "./order"

const PAYER = `C${"A".repeat(55)}`
const MERCH = `G${"A".repeat(55)}`
const ATTEMPT = "attempt-liquid-society-0001"

function input(attemptId = ATTEMPT) {
  return {
    userId: "user-1",
    attemptId,
    slug: "liquid-society",
    payer: PAYER,
    priceUsdc: "12",
    destination: MERCH,
  }
}

describe("merch order payment", () => {
  it("submits one payment at the item price and keeps the hash on a retry", async () => {
    const store = createMemoryOrderStore()
    const submit = vi.fn<PaymentSubmitter>(async (order) => {
      expect(order.payer).toBe(PAYER)
      expect(order.priceUsdc).toBe("12")
      expect(order.destination).toBe(MERCH)
      return { ok: true, hash: "a".repeat(64) }
    })

    const first = await confirmMerchOrder(input(), store, submit)
    const retry = await confirmMerchOrder(input(), store, submit)

    expect(submit).toHaveBeenCalledTimes(1)
    expect(first.ok && first.order.status).toBe("paid")
    expect(first.ok && first.order.paymentHash).toBe("a".repeat(64))
    expect(first.ok && first.submitted).toBe(true)
    expect(retry.ok && retry.order.id).toBe(first.ok ? first.order.id : "")
    expect(retry.ok && retry.submitted).toBe(false)
    expect(retry.ok && retry.order.transferAttempted).toBe(false)
  })

  it("uses the session payer when the client offers a different one", async () => {
    const store = createMemoryOrderStore()
    const submit = vi.fn<PaymentSubmitter>(async () => ({ ok: true, hash: "b".repeat(64) }))
    const clientPayer = `G${"B".repeat(55)}`
    const result = await confirmMerchOrder(
      { ...input(), payer: PAYER },
      store,
      submit,
    )
    expect(clientPayer).not.toBe(PAYER)
    expect(submit.mock.calls[0]?.[0].payer).toBe(PAYER)
    expect(result.ok && result.order.payer).toBe(PAYER)
  })

  it("marks a failed payment failed, records the reason, and does not transfer", async () => {
    const store = createMemoryOrderStore()
    const submit = vi.fn<PaymentSubmitter>(async () => ({ ok: false, reason: "passkey_rejected" }))
    const transfer = vi.fn()

    const failed = await confirmMerchOrder(input(), store, submit)
    const retry = await confirmMerchOrder(input(), store, submit)

    expect(submit).toHaveBeenCalledTimes(1)
    expect(transfer).not.toHaveBeenCalled()
    expect(failed.ok && failed.order).toMatchObject({
      status: "failed",
      failureReason: "passkey_rejected",
      paymentHash: null,
      transferAttempted: false,
    })
    expect(retry.ok && retry.submitted).toBe(false)
    expect(retry.ok && retry.order.status).toBe("failed")
  })

  it("starts a new order after a failed or completed one", async () => {
    const store = createMemoryOrderStore()
    const submit = vi.fn<PaymentSubmitter>(async () => ({ ok: false, reason: "rejected" }))
    const failed = await confirmMerchOrder(input("attempt-failed-00000001"), store, submit)
    expect(failed.ok && failed.order.status).toBe("failed")

    const completed: MerchOrder = {
      ...(failed.ok ? failed.order : ({} as MerchOrder)),
      id: "done",
      attemptId: "attempt-done-000000001",
      status: "completed",
      paymentHash: "c".repeat(64),
      failureReason: null,
    }
    await store.insert(completed)

    const again = await confirmMerchOrder(input("attempt-again-00000001"), store, async () => ({
      ok: true,
      hash: "d".repeat(64),
    }))
    expect(again.ok && again.order.id).not.toBe(failed.ok ? failed.order.id : "")
    expect(again.ok && again.order.id).not.toBe("done")
    expect(again.ok && again.order.status).toBe("paid")
    expect(again.ok && again.order.paymentHash).toBe("d".repeat(64))
  })
})
