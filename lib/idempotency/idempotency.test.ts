import { describe, expect, it, vi } from "vitest"
import {
  createMemoryIdempotencyStore,
  IDEMPOTENCY_IN_PROGRESS_CODE,
  IDEMPOTENCY_KEY_REUSED_CODE,
  isValidIdempotencyKey,
  runIdempotent,
  type IdempotencyStore,
} from "./idempotency"

const claim = { userId: "user-1", key: "k_0123456789abcdef", scope: "withdraw_all", fingerprint: "usdc|C1|G1|100" }

describe("isValidIdempotencyKey", () => {
  it("accepts UUIDs and rejects short or odd keys", () => {
    expect(isValidIdempotencyKey(crypto.randomUUID())).toBe(true)
    expect(isValidIdempotencyKey("short")).toBe(false)
    expect(isValidIdempotencyKey("has spaces in it 1234")).toBe(false)
    expect(isValidIdempotencyKey(123)).toBe(false)
  })
})

describe("runIdempotent", () => {
  it("runs once and replays the stored response for the same key", async () => {
    const store = createMemoryIdempotencyStore()
    const execute = vi.fn(async () => ({ status: 200, body: { success: true, transactionHash: "abc" } }))

    const first = await runIdempotent(store, claim, execute)
    const second = await runIdempotent(store, claim, execute)

    expect(execute).toHaveBeenCalledTimes(1)
    expect(first).toEqual({ status: 200, body: { success: true, transactionHash: "abc" }, replayed: false })
    expect(second).toEqual({ status: 200, body: { success: true, transactionHash: "abc" }, replayed: true })
  })

  it("concurrent double tap submits once; the loser gets in-progress, then the original result", async () => {
    const store = createMemoryIdempotencyStore()
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const execute = vi.fn(async () => {
      await gate
      return { status: 200, body: { success: true, transactionHash: "hash-1" } }
    })

    const firstTap = runIdempotent(store, claim, execute)
    const secondTap = await runIdempotent(store, claim, execute)
    expect(secondTap.status).toBe(409)
    expect(secondTap.body).toMatchObject({ code: IDEMPOTENCY_IN_PROGRESS_CODE })

    release()
    expect((await firstTap).body).toEqual({ success: true, transactionHash: "hash-1" })
    expect((await runIdempotent(store, claim, execute)).body).toEqual({ success: true, transactionHash: "hash-1" })
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it("replays failures too, so a retry needs a new key", async () => {
    const store = createMemoryIdempotencyStore()
    const execute = vi.fn(async () => ({ status: 400, body: { success: false, code: "submit_failed" } }))
    await runIdempotent(store, claim, execute)
    const replay = await runIdempotent(store, claim, execute)
    expect(replay).toMatchObject({ status: 400, replayed: true })
    expect(execute).toHaveBeenCalledTimes(1)

    const retry = await runIdempotent(store, { ...claim, key: "k_fedcba9876543210" }, execute)
    expect(retry.replayed).toBe(false)
    expect(execute).toHaveBeenCalledTimes(2)
  })

  it("refuses a key reused for a different payment or scope", async () => {
    const store = createMemoryIdempotencyStore()
    const execute = vi.fn(async () => ({ status: 200, body: { success: true } }))
    await runIdempotent(store, claim, execute)

    const other = await runIdempotent(store, { ...claim, fingerprint: "usdc|C1|G2|100" }, execute)
    expect(other.status).toBe(422)
    expect(other.body).toMatchObject({ code: IDEMPOTENCY_KEY_REUSED_CODE })
    expect((await runIdempotent(store, { ...claim, scope: "payment" }, execute)).status).toBe(422)
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it("keys are per user", async () => {
    const store = createMemoryIdempotencyStore()
    const execute = vi.fn(async () => ({ status: 200, body: { success: true } }))
    await runIdempotent(store, claim, execute)
    await runIdempotent(store, { ...claim, userId: "user-2" }, execute)
    expect(execute).toHaveBeenCalledTimes(2)
  })

  it("stores a 500 when execute throws, and never re-runs it for that key", async () => {
    const store = createMemoryIdempotencyStore()
    const execute = vi.fn(async () => {
      throw new Error("boom")
    })
    expect((await runIdempotent(store, claim, execute)).status).toBe(500)
    expect((await runIdempotent(store, claim, execute)).status).toBe(500)
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it("if the result can't be stored, replays stay in-progress instead of resubmitting", async () => {
    const inner = createMemoryIdempotencyStore()
    const store: IdempotencyStore = {
      claim: inner.claim,
      complete: async () => {
        throw new Error("db down")
      },
    }
    const execute = vi.fn(async () => ({ status: 200, body: { success: true } }))
    expect((await runIdempotent(store, claim, execute)).status).toBe(200)
    expect((await runIdempotent(store, claim, execute)).status).toBe(409)
    expect(execute).toHaveBeenCalledTimes(1)
  })
})
