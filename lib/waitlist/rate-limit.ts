/**
 * Per-instance sliding window. Serverless instances don't share it, so it only slows a single
 * client down; it is not a hard global cap.
 */
export function createRateLimiter(limit: number, windowMs: number, maxKeys = 10_000) {
  const hits = new Map<string, number[]>()

  return function allow(key: string, now = Date.now()): boolean {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
    if (recent.length >= limit) {
      hits.set(key, recent)
      return false
    }
    recent.push(now)
    hits.delete(key)
    hits.set(key, recent)
    if (hits.size > maxKeys) {
      const oldest = hits.keys().next().value
      if (oldest !== undefined) hits.delete(oldest)
    }
    return true
  }
}
