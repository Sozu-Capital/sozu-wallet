import { describe, expect, it } from "vitest"
import {
  OFFLINE_BALANCE_KEY,
  offlineCardUsdc,
  readOfflineBalance,
  saveOfflineBalance,
  type OfflineBalanceStore,
} from "./offline-balance"

const WALLET = "CAMVPBC6XL42KGHQPOLBBZ5EKIHER3DCNY2FRZH677JS2KWH4RNILEJH"

function memoryStore(): OfflineBalanceStore & { raw: Map<string, string> } {
  const raw = new Map<string, string>()
  return {
    raw,
    getItem: (key) => raw.get(key) ?? null,
    setItem: (key, value) => {
      raw.set(key, value)
    },
  }
}

describe("offline balance cache", () => {
  it("keeps the home-card USDC total", () => {
    expect(
      offlineCardUsdc({ walletBalance: 10, sorobanSacBalance: 100, strategyBalance: 5 }),
    ).toBe(115)
    expect(offlineCardUsdc({ walletBalance: 0, sorobanSacBalance: 0, strategyBalance: 0, displayBalance: 4 })).toBe(4)
    expect(offlineCardUsdc({ displayBalance: Number.NaN })).toBeNull()
  })

  it("saves a balance the phone can show with no network", () => {
    const store = memoryStore()
    expect(saveOfflineBalance(store, { wallet: WALLET.toLowerCase(), usdc: 100 }, 50)).toBe(true)
    expect(readOfflineBalance(store)).toEqual({ wallet: WALLET, usdc: 100, savedAt: 50 })
  })

  it("rejects a bad address or a broken record", () => {
    const store = memoryStore()
    expect(saveOfflineBalance(store, { wallet: "nope", usdc: 1 })).toBe(false)
    expect(saveOfflineBalance(store, { wallet: WALLET, usdc: -1 })).toBe(false)
    store.setItem(OFFLINE_BALANCE_KEY, "{")
    expect(readOfflineBalance(store)).toBeNull()
  })
})
