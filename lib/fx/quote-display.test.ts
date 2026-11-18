import { describe, expect, it } from "vitest"
import { isLiveFxQuote, localAmountFromUsdc } from "@/lib/fx/quote-display"

describe("localAmountFromUsdc", () => {
  it("rounds CLP to whole pesos", () => {
    expect(localAmountFromUsdc(12.5, 950.4, "CLP")).toBe(11880)
  })

  it("keeps two decimals for BRL", () => {
    expect(localAmountFromUsdc(10, 5.65, "BRL")).toBe(56.5)
  })
})

describe("isLiveFxQuote", () => {
  it("accepts a positive localPerUsdc", () => {
    expect(isLiveFxQuote({ from: "CLP", localPerUsdc: 950 })).toBe(true)
    expect(isLiveFxQuote({ from: "CLP", localPerUsdc: 0 })).toBe(false)
  })
})
