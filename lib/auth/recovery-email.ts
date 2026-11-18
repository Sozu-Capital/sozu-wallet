const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const RECOVERY_LINK_TTL_MS = 30 * 60 * 1000

export function normalizeRecoveryEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const email = raw.trim().toLowerCase()
  if (email.length > 254 || !EMAIL.test(email)) return null
  return email
}

/** Same sentence whether or not an account exists. */
export const RECOVERY_START_MESSAGE =
  "Si hay una cuenta con ese correo, te enviamos un enlace para crear una llave nueva."
