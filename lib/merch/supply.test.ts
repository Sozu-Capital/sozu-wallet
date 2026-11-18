import { describe, expect, it, vi } from "vitest"
import { getMerchItem, LIQUID_SOCIETY_SLUG, type MerchItemRecord } from "./catalog"
import { remainingSupply } from "./supply"

const CONTRACT = `C${"A".repeat(55)}`
const HOLDER = `G${"A".repeat(55)}`

function recordedItem(): MerchItemRecord {
  const item = getMerchItem(LIQUID_SOCIETY_SLUG)
  if (!item) throw new Error("missing seed")
  return { ...item, contractId: CONTRACT, distributorAddress: HOLDER }
}

describe("remaining supply", () => {
  it("does not read the chain when the contract is not recorded", async () => {
    const item = getMerchItem(LIQUID_SOCIETY_SLUG)
    if (!item) throw new Error("missing seed")
    expect(item.preMintSupply).toBe(10)
    const read = vi.fn()
    await expect(remainingSupply(item, read)).resolves.toBeNull()
    expect(read).not.toHaveBeenCalled()
  })

  it("treats a zero distributor balance as no units left", async () => {
    const read = vi.fn(async () => 0)
    await expect(remainingSupply(recordedItem(), read)).resolves.toBe(0)
    expect(read).toHaveBeenCalledWith(CONTRACT, HOLDER, "testnet")
  })

  it("keeps a failed read unknown instead of sold out", async () => {
    const read = vi.fn(async () => {
      throw new Error("rpc down")
    })
    await expect(remainingSupply(recordedItem(), read)).resolves.toBeNull()
  })
})
