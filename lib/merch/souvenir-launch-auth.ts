/** Sozu Pay launches souvenirs with this shared secret. Staging without a secret stays closed. */
export function isSouvenirLaunchAuthorized(request: Request): boolean {
  const expected = process.env.SOZU_PAY_SOUVENIR_SECRET?.trim()
  if (!expected || expected.length < 16) return false
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim()
  const header = request.headers.get("x-sozu-pay-souvenir")?.trim()
  return bearer === expected || header === expected
}
