import { describe, expect, it } from "vitest"
import { createRateLimiter } from "./rate-limit"

describe("waitlist rate limiter", () => {
  it("allows up to the limit inside the window, then blocks", () => {
    const allow = createRateLimiter(2, 60_000)
    expect(allow("ip", 0)).toBe(true)
    expect(allow("ip", 1)).toBe(true)
    expect(allow("ip", 2)).toBe(false)
    expect(allow("other", 2)).toBe(true)
  })

  it("allows again once old hits leave the window", () => {
    const allow = createRateLimiter(1, 1_000)
    expect(allow("ip", 0)).toBe(true)
    expect(allow("ip", 500)).toBe(false)
    expect(allow("ip", 1_001)).toBe(true)
  })

  it("evicts the oldest key past the size cap", () => {
    const allow = createRateLimiter(1, 60_000, 2)
    allow("a", 0)
    allow("b", 0)
    allow("c", 0)
    expect(allow("a", 1)).toBe(true)
  })
})
