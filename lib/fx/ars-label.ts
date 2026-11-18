/**
 * Client-safe formatting for the BCRA peso label. Mirrors `ArsQuote` from `lib/fx/bcra.ts`
 * without importing it (that module is server-only).
 */

export interface ArsQuoteDto {
  rate: number
  source: "BCRA"
  rateDate: string
  fetchedAt: string
}

const AR_TZ = "America/Argentina/Buenos_Aires"

export function isArsQuoteDto(value: unknown): value is ArsQuoteDto {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return (
    typeof v.rate === "number" &&
    Number.isFinite(v.rate) &&
    v.rate > 0 &&
    v.source === "BCRA" &&
    typeof v.rateDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(v.rateDate) &&
    typeof v.fetchedAt === "string" &&
    !Number.isNaN(Date.parse(v.fetchedAt))
  )
}

/** `12345.6` → `$ 12.346` */
export function formatArsWhole(amount: number): string {
  return `$ ${Math.round(amount).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`
}

/** `1545.5` → `$ 1.545,50` */
export function formatArsRate(rate: number): string {
  return `$ ${rate.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** `2026-11-05` → `05/11/2026` */
export function formatRateDate(rateDate: string): string {
  const [y, m, d] = rateDate.split("-")
  return `${d}/${m}/${y}`
}

/** ISO timestamp → `22:05` in Argentina time. */
export function formatFetchedTime(fetchedAt: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: AR_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(fetchedAt))
}
