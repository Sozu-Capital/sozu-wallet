import { describe, expect, it } from "vitest"
import { crossDeviceBindingValue, isCrossDeviceBindingValid } from "./cross-device-binding"

const secret = "test-session-secret-at-least-32-characters"
const sessionId = "6f1c2b9e-1d4a-4c55-9a51-0b8f3c2d7e11"

describe("cross-device binding cookie", () => {
  it("accepts the value issued to the browser that showed the QR", () => {
    expect(isCrossDeviceBindingValid(sessionId, crossDeviceBindingValue(sessionId, secret), secret)).toBe(true)
  })

  it("rejects the bare sessionId copied from the QR", () => {
    expect(isCrossDeviceBindingValid(sessionId, sessionId, secret)).toBe(false)
  })

  it("rejects a value issued for another session", () => {
    expect(isCrossDeviceBindingValid(sessionId, crossDeviceBindingValue("other-session", secret), secret)).toBe(false)
  })

  it("rejects a missing cookie", () => {
    expect(isCrossDeviceBindingValid(sessionId, undefined, secret)).toBe(false)
  })
})
