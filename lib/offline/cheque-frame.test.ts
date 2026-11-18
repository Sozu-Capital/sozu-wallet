import { describe, expect, it } from "vitest"
import { chequeWire } from "./cheque-frame"

describe("chequeWire", () => {
  it("accepts a 243-byte SOZU1 frame", () => {
    const wire = Buffer.alloc(243, 7)
    const frame = `SOZU1:${wire.toString("base64url")}`
    expect(chequeWire(frame)?.equals(wire)).toBe(true)
  })

  it("rejects a short payload", () => {
    expect(chequeWire("SOZU1:aaaa")).toBeNull()
  })
})
