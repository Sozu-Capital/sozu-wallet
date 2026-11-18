import "server-only"

/**
 * USD → ARS reference rate from the Banco Central de la República Argentina public API.
 * Backs the wallet peso label and the P2P cash-out desk quote. Keep `ArsQuote` stable.
 *
 * BCRA publishes one rate per business day (`fecha`, no time of day). If BCRA is down or the
 * payload is malformed we throw. Callers show "rate unavailable" and never a guessed number.
 */

export const BCRA_USD_URL = "https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones/USD"

export const BCRA_CACHE_TTL_MS = 15 * 60 * 1000

export interface ArsQuote {
  /** 1 USD = `rate` ARS. */
  rate: number
  source: "BCRA"
  /** BCRA quote date, `YYYY-MM-DD` (Argentina business day). */
  rateDate: string
  /** ISO timestamp of when we fetched it from BCRA. */
  fetchedAt: string
}

export class BcraRateUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BcraRateUnavailableError"
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

interface BcraDetalle {
  codigoMoneda?: unknown
  tipoCotizacion?: unknown
}

interface BcraResult {
  fecha?: unknown
  detalle?: unknown
}

/**
 * Pick the latest USD quote out of a BCRA `Cotizaciones/USD` response.
 * Throws `BcraRateUnavailableError` on any shape it does not recognise.
 */
export function parseBcraUsdResponse(body: unknown): { rate: number; rateDate: string } {
  if (!body || typeof body !== "object") {
    throw new BcraRateUnavailableError("BCRA response is not an object")
  }
  const results = (body as { results?: unknown }).results
  if (!Array.isArray(results) || results.length === 0) {
    throw new BcraRateUnavailableError("BCRA response has no results")
  }

  let best: { rate: number; rateDate: string } | null = null
  for (const entry of results as BcraResult[]) {
    if (!entry || typeof entry.fecha !== "string" || !DATE_RE.test(entry.fecha)) continue
    if (!Array.isArray(entry.detalle)) continue
    const usd = (entry.detalle as BcraDetalle[]).find((d) => d?.codigoMoneda === "USD")
    const rate = usd?.tipoCotizacion
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) continue
    if (!best || entry.fecha > best.rateDate) {
      best = { rate, rateDate: entry.fecha }
    }
  }

  if (!best) {
    throw new BcraRateUnavailableError("BCRA response has no valid USD quote")
  }
  return best
}

let cached: { quote: ArsQuote; expiresAt: number } | null = null
let inflight: Promise<ArsQuote> | null = null

async function fetchFromBcra(): Promise<ArsQuote> {
  let res: Response
  try {
    res = await fetch(BCRA_USD_URL, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    })
  } catch (e) {
    throw new BcraRateUnavailableError(`BCRA unreachable: ${e instanceof Error ? e.message : String(e)}`)
  }
  if (!res.ok) {
    throw new BcraRateUnavailableError(`BCRA upstream ${res.status}`)
  }
  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new BcraRateUnavailableError("BCRA response is not JSON")
  }
  const { rate, rateDate } = parseBcraUsdResponse(body)
  return { rate, source: "BCRA", rateDate, fetchedAt: new Date().toISOString() }
}

/** Latest USD → ARS quote, cached in memory for `BCRA_CACHE_TTL_MS`. Failures are not cached. */
export async function getArsQuote(now: number = Date.now()): Promise<ArsQuote> {
  if (cached && cached.expiresAt > now) return cached.quote
  if (!inflight) {
    inflight = fetchFromBcra()
      .then((quote) => {
        cached = { quote, expiresAt: Date.now() + BCRA_CACHE_TTL_MS }
        return quote
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

/** Test hook. */
export function resetArsQuoteCacheForTests(): void {
  cached = null
  inflight = null
}
