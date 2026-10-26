/** How often the internet witness reprints the Sozu testnet tape. */
export const WITNESS_SYNC_MS = 16 * 60 * 1000

export type WitnessSyncDial = {
  /** Milliseconds into the current 16-minute turn. */
  into: number
  /** Milliseconds until the next reprint. */
  remainingMs: number
  /** Completed reprints since the last successful read. */
  turns: number
  /** Needle angle, clockwise from 12 o'clock. */
  degrees: number
}

export function witnessSyncDial(
  nowMs: number,
  syncedAtMs: number,
  periodMs = WITNESS_SYNC_MS,
): WitnessSyncDial {
  const elapsed = Math.max(0, nowMs - syncedAtMs)
  const into = elapsed % periodMs
  const remainingMs = into === 0 ? periodMs : periodMs - into
  return {
    into,
    remainingMs,
    turns: Math.floor(elapsed / periodMs),
    degrees: (into / periodMs) * 360,
  }
}

export function formatSyncRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, "0")}`
}
