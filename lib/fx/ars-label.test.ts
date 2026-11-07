import { describe, expect, it } from "vitest"
import { formatArsRate, formatArsWhole, formatFetchedTime, formatRateDate, isArsQuoteDto } from "./ars-label"

describe("ars-label", () => {
  it("formats pesos the Argentine way", () => {
    expect(formatArsWhole(12345.6)).toBe("$ 12.346")
    expect(formatArsWhole(0)).toBe("$ 0")
    expect(formatArsRate(1545.5)).toBe("$ 1.545,50")
  })

  it("formats the BCRA date and the fetch time in Argentina time", () => {
    expect(formatRateDate("2026-11-05")).toBe("05/11/2026")
    expect(formatFetchedTime("2026-11-07T01:05:00.000Z")).toBe("22:05")
  })

  it("validates the API payload", () => {
    const ok = { rate: 1545.5, source: "BCRA", rateDate: "2026-11-05", fetchedAt: "2026-11-07T01:05:00.000Z" }
    expect(isArsQuoteDto(ok)).toBe(true)
    expect(isArsQuoteDto({ ...ok, rate: 0 })).toBe(false)
    expect(isArsQuoteDto({ ...ok, source: "frankfurter" })).toBe(false)
    expect(isArsQuoteDto({ error: "rate_unavailable", source: "BCRA" })).toBe(false)
    expect(isArsQuoteDto(null)).toBe(false)
  })
})
