export type WaitlistLocale = "es" | "en"

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function normalizeWaitlistEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const email = raw.trim().toLowerCase()
  if (email.length > 254 || !EMAIL.test(email)) return null
  return email
}

export function normalizeWaitlistLocale(raw: unknown): WaitlistLocale | null {
  return raw === "es" || raw === "en" ? raw : null
}
