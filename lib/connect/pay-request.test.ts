import { describe, expect, it } from "vitest"
import {
  circleSacBalance,
  circleSacCoversAmount,
  isCircleUsdcAmount,
  readSozuPayRequest,
  sozuConnectInsufficient,
  sozuConnectPayment,
} from "./pay-request"

const ACCOUNT = "CAMVPBC6XL42KGHQPOLBBZ5EKIHER3DCNY2FRZH677JS2KWH4RNILEJH"
const CLASSIC = "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37"
const HASH = "ab".repeat(32)

describe("isCircleUsdcAmount", () => {
  it("accepts a positive decimal with at most 7 places", () => {
    expect(isCircleUsdcAmount("5")).toBe(true)
    expect(isCircleUsdcAmount("5.50")).toBe(true)
    expect(isCircleUsdcAmount("0.0000001")).toBe(true)
  })

  it("rejects empty, zero, and too many decimal places", () => {
    expect(isCircleUsdcAmount("")).toBe(false)
    expect(isCircleUsdcAmount("0")).toBe(false)
    expect(isCircleUsdcAmount("5.12345678")).toBe(false)
    expect(isCircleUsdcAmount("ada")).toBe(false)
  })
})

describe("readSozuPayRequest", () => {
  it("reads the amount and a G or C address", () => {
    expect(readSozuPayRequest(new URLSearchParams(`amount=5&to=${ACCOUNT}`))).toEqual({
      amount: "5",
      to: ACCOUNT,
    })
    expect(readSozuPayRequest(new URLSearchParams(`amount=1.5&to=${CLASSIC.toLowerCase()}`))).toEqual({
      amount: "1.5",
      to: CLASSIC,
    })
  })

  it("ignores a username destination", () => {
    expect(readSozuPayRequest(new URLSearchParams("amount=5&to=ada"))).toBeNull()
  })
})

describe("circleSacCoversAmount", () => {
  it("uses only the Circle SAC balance", () => {
    const payload = {
      tokenBalances: [
        { assetId: "blend_usdc", balance: 100 },
        { assetId: "sozu_internal_usdc", balance: 100 },
        { assetId: "circle_usdc_sac", balance: 4 },
      ],
    }
    expect(circleSacBalance(payload)).toBe(4)
    expect(circleSacCoversAmount(circleSacBalance(payload), "5")).toBe(false)
    expect(circleSacCoversAmount(circleSacBalance(payload), "4")).toBe(true)
  })

  it("is short when a new account has no Circle balance yet", () => {
    expect(circleSacCoversAmount(circleSacBalance({}), "1")).toBe(false)
  })
})

describe("sozuConnectInsufficient", () => {
  it("returns the account and does not include a transaction", () => {
    expect(sozuConnectInsufficient("ada", ACCOUNT)).toEqual({
      type: "sozu-connect",
      username: "ada",
      accountId: ACCOUNT,
      error: "insufficient_funds",
    })
  })
})

describe("sozuConnectPayment", () => {
  it("returns the transaction, username, and C account", () => {
    expect(sozuConnectPayment("ada", ACCOUNT, HASH.toUpperCase())).toEqual({
      type: "sozu-connect",
      txHash: HASH,
      username: "ada",
      accountId: ACCOUNT,
    })
  })

  it("refuses a missing hash or a G account", () => {
    expect(sozuConnectPayment("ada", ACCOUNT, "nope")).toBeNull()
    expect(sozuConnectPayment("ada", CLASSIC, HASH)).toBeNull()
  })
})
