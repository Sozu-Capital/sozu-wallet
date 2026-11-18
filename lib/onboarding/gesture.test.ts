import { describe, expect, it } from "vitest"
import { activationDragThreshold, resolveActivationGesture } from "./gesture"

const frame = {
  width: 390,
  index: 1,
  count: 4,
}

describe("activation onboarding gestures", () => {
  it("uses a short drag threshold on a phone-width frame", () => {
    expect(activationDragThreshold(390)).toBeLessThanOrEqual(56)
    expect(activationDragThreshold(320)).toBeGreaterThanOrEqual(36)
  })

  it("goes back from the left of the frame and forward from the right", () => {
    expect(
      resolveActivationGesture({ ...frame, dx: 2, dy: 1, x: 40, dragged: false }),
    ).toBe("back")
    expect(
      resolveActivationGesture({ ...frame, dx: -3, dy: 2, x: 280, dragged: false }),
    ).toBe("forward")
  })

  it("does not leave the ends from a tap", () => {
    expect(
      resolveActivationGesture({ ...frame, index: 0, dx: 0, dy: 0, x: 20, dragged: false }),
    ).toBe("ignore")
    expect(
      resolveActivationGesture({ ...frame, index: 3, dx: 0, dy: 0, x: 300, dragged: false }),
    ).toBe("ignore")
  })

  it("treats a sideways drag as a step and lets a vertical drag pass", () => {
    expect(
      resolveActivationGesture({ ...frame, dx: -80, dy: 8, x: 200, dragged: true }),
    ).toBe("forward")
    expect(
      resolveActivationGesture({ ...frame, dx: 80, dy: -6, x: 200, dragged: true }),
    ).toBe("back")
    expect(
      resolveActivationGesture({ ...frame, dx: 10, dy: 70, x: 200, dragged: true }),
    ).toBe("ignore")
  })

  it("does not open the wallet from a drag off the last screen", () => {
    expect(
      resolveActivationGesture({ ...frame, index: 3, dx: -120, dy: 0, x: 200, dragged: true }),
    ).toBe("ignore")
    expect(
      resolveActivationGesture({ ...frame, index: 0, dx: 120, dy: 0, x: 200, dragged: true }),
    ).toBe("ignore")
  })
})
