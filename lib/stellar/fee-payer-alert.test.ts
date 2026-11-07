import { describe, expect, it } from "vitest"
import { feePayerThresholdXlm, shouldAlert } from "./fee-payer-alert"

describe("feePayerThresholdXlm", () => {
  it("reads the env value and falls back to 25", () => {
    expect(feePayerThresholdXlm("40")).toBe(40)
    expect(feePayerThresholdXlm("0")).toBe(0)
    expect(feePayerThresholdXlm(undefined)).toBe(25)
    expect(feePayerThresholdXlm("")).toBe(25)
    expect(feePayerThresholdXlm("lots")).toBe(25)
    expect(feePayerThresholdXlm("-1")).toBe(25)
  })
})

describe("shouldAlert", () => {
  const now = 1_000_000_000

  it("stays quiet at or above the line", () => {
    expect(shouldAlert({ xlm: 25, thresholdXlm: 25, lastAlertAt: 0, now })).toBe(false)
  })

  it("alerts below the line, then waits 15 minutes before alerting again", () => {
    expect(shouldAlert({ xlm: 10, thresholdXlm: 25, lastAlertAt: 0, now })).toBe(true)
    expect(shouldAlert({ xlm: 10, thresholdXlm: 25, lastAlertAt: now - 60_000, now })).toBe(false)
    expect(shouldAlert({ xlm: 10, thresholdXlm: 25, lastAlertAt: now - 15 * 60_000, now })).toBe(true)
  })

  it("force skips the cooldown but never alerts above the line", () => {
    expect(shouldAlert({ xlm: 10, thresholdXlm: 25, lastAlertAt: now, now, force: true })).toBe(true)
    expect(shouldAlert({ xlm: 30, thresholdXlm: 25, lastAlertAt: 0, now, force: true })).toBe(false)
  })
})
