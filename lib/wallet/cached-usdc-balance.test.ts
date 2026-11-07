import { describe, expect, it } from "vitest"
import {
  readCachedUsdcBalance,
  writeCachedUsdcBalance,
  type CachedUsdcBalance,
} from "./cached-usdc-balance"

const C = "C".padEnd(56, "A")

function memoryStorage() {
  const rows = new Map<string, string>()
  return {
    getItem: (key: string) => rows.get(key) ?? null,
    setItem: (key: string, value: string) => {
      rows.set(key, value)
    },
  }
}

const sample: CachedUsdcBalance = {
  walletBalance: 0,
  sorobanSacBalance: 12.5,
  spendableOnC: 12.5,
  strategyBalance: 0,
  totalBalance: 12.5,
  displayBalance: 12.5,
  classicOnSigner: 0,
  legacyUsdcOnSigner: 0,
}

describe("cached USDC balance", () => {
  it("returns the balance saved for that account", () => {
    const storage = memoryStorage()
    writeCachedUsdcBalance(C, sample, storage)
    expect(readCachedUsdcBalance(C, storage)).toEqual(sample)
  })

  it("does not return another account's balance", () => {
    const storage = memoryStorage()
    writeCachedUsdcBalance(C, sample, storage)
    expect(readCachedUsdcBalance("C".padEnd(56, "B"), storage)).toBeNull()
  })

  it("ignores a corrupt or partial payload", () => {
    const storage = memoryStorage()
    storage.setItem(`sozu.usdcBalance:v1:${C}`, JSON.stringify({ displayBalance: 1 }))
    expect(readCachedUsdcBalance(C, storage)).toBeNull()
    storage.setItem(`sozu.usdcBalance:v1:${C}`, "not-json")
    expect(readCachedUsdcBalance(C, storage)).toBeNull()
  })

  it("ignores addresses that are not a smart account", () => {
    const storage = memoryStorage()
    writeCachedUsdcBalance("G".padEnd(56, "A"), sample, storage)
    expect(readCachedUsdcBalance("G".padEnd(56, "A"), storage)).toBeNull()
  })
})
