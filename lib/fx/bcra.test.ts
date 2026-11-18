import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  BcraRateUnavailableError,
  getArsQuote,
  parseBcraUsdResponse,
  resetArsQuoteCacheForTests,
} from "./bcra"

const LIVE_SHAPE = {
  status: 200,
  metadata: { resultset: { count: 1, offset: 0, limit: 1000 } },
  results: [
    {
      fecha: "2026-11-05",
      detalle: [{ codigoMoneda: "USD", descripcion: "DOLAR E.E.U.U.", tipoPase: 0, tipoCotizacion: 1545.5 }],
    },
  ],
}

describe("parseBcraUsdResponse", () => {
  it("parses the live BCRA shape", () => {
    expect(parseBcraUsdResponse(LIVE_SHAPE)).toEqual({ rate: 1545.5, rateDate: "2026-11-05" })
  })

  it("picks the latest date when given a range", () => {
    const body = {
      results: [
        { fecha: "2026-11-03", detalle: [{ codigoMoneda: "USD", tipoCotizacion: 1500 }] },
        { fecha: "2026-11-05", detalle: [{ codigoMoneda: "USD", tipoCotizacion: 1545.5 }] },
        { fecha: "2026-11-04", detalle: [{ codigoMoneda: "USD", tipoCotizacion: 1520 }] },
      ],
    }
    expect(parseBcraUsdResponse(body)).toEqual({ rate: 1545.5, rateDate: "2026-11-05" })
  })

  it.each([
    ["null", null],
    ["empty results", { results: [] }],
    ["no USD row", { results: [{ fecha: "2026-11-05", detalle: [{ codigoMoneda: "EUR", tipoCotizacion: 1700 }] }] }],
    ["zero rate", { results: [{ fecha: "2026-11-05", detalle: [{ codigoMoneda: "USD", tipoCotizacion: 0 }] }] }],
    ["string rate", { results: [{ fecha: "2026-11-05", detalle: [{ codigoMoneda: "USD", tipoCotizacion: "1545" }] }] }],
    ["bad date", { results: [{ fecha: "05/11/2026", detalle: [{ codigoMoneda: "USD", tipoCotizacion: 1545 }] }] }],
    ["error payload", { status: 400, errorMessages: ["fecha invalida"] }],
  ])("rejects %s", (_label, body) => {
    expect(() => parseBcraUsdResponse(body)).toThrow(BcraRateUnavailableError)
  })
})

describe("getArsQuote", () => {
  beforeEach(() => resetArsQuoteCacheForTests())
  afterEach(() => vi.unstubAllGlobals())

  it("returns a BCRA quote and caches it", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(LIVE_SHAPE), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const a = await getArsQuote()
    const b = await getArsQuote()
    expect(a).toMatchObject({ rate: 1545.5, source: "BCRA", rateDate: "2026-11-05" })
    expect(typeof a.fetchedAt).toBe("string")
    expect(b).toBe(a)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("throws when BCRA returns an HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })))
    await expect(getArsQuote()).rejects.toBeInstanceOf(BcraRateUnavailableError)
  })

  it("throws when BCRA is unreachable and does not cache the failure", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response(JSON.stringify(LIVE_SHAPE), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(getArsQuote()).rejects.toBeInstanceOf(BcraRateUnavailableError)
    await expect(getArsQuote()).resolves.toMatchObject({ rate: 1545.5 })
  })

  it("does not serve an expired quote when the refresh fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(LIVE_SHAPE), { status: 200 }))
      .mockRejectedValueOnce(new TypeError("fetch failed"))
    vi.stubGlobal("fetch", fetchMock)

    await getArsQuote()
    await expect(getArsQuote(Date.now() + 60 * 60 * 1000)).rejects.toBeInstanceOf(BcraRateUnavailableError)
  })
})
