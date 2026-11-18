import { createHmac, timingSafeEqual } from "crypto"
import { getSessionSecret } from "@/lib/auth/session-cookie"

/** httpOnly cookie binding a cross-device registration to the browser that showed the QR. */
export const CROSS_DEVICE_BINDING_COOKIE = "sozu_xdevice"

/**
 * The QR carries the sessionId, so the cookie must hold something the QR does not reveal:
 * an HMAC of the sessionId under the server's session secret.
 */
export function crossDeviceBindingValue(sessionId: string, secret: string = getSessionSecret()): string {
  return createHmac("sha256", secret).update(`cross-device:${sessionId}`).digest("base64url")
}

export function isCrossDeviceBindingValid(
  sessionId: string,
  cookieValue: string | undefined,
  secret: string = getSessionSecret(),
): boolean {
  if (!cookieValue) return false
  const expected = Buffer.from(crossDeviceBindingValue(sessionId, secret))
  const actual = Buffer.from(cookieValue)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
