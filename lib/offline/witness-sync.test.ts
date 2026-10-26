import { describe, expect, it } from "vitest"
import { WITNESS_SYNC_MS, formatSyncRemaining, witnessSyncDial } from "./witness-sync"

describe("witness sync dial", () => {
  it("starts a full 16-minute turn at the moment of a read", () => {
    const dial = witnessSyncDial(1_000, 1_000)
    expect(WITNESS_SYNC_MS).toBe(16 * 60 * 1000)
    expect(dial.degrees).toBe(0)
    expect(dial.turns).toBe(0)
    expect(dial.remainingMs).toBe(WITNESS_SYNC_MS)
    expect(formatSyncRemaining(dial.remainingMs)).toBe("16:00")
  })

  it("points the needle halfway through the turn", () => {
    const dial = witnessSyncDial(WITNESS_SYNC_MS / 2, 0)
    expect(dial.degrees).toBe(180)
    expect(dial.remainingMs).toBe(WITNESS_SYNC_MS / 2)
    expect(formatSyncRemaining(dial.remainingMs)).toBe("8:00")
  })

  it("returns to 12 o'clock when the next reprint is due", () => {
    const dial = witnessSyncDial(WITNESS_SYNC_MS, 0)
    expect(dial.degrees).toBe(0)
    expect(dial.turns).toBe(1)
    expect(dial.remainingMs).toBe(WITNESS_SYNC_MS)
  })
})
