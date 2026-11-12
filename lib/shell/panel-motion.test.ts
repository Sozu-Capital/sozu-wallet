import { describe, expect, it } from "vitest"
import {
  FLICK_PX_PER_MS,
  RUBBER_BAND,
  SPRING_DAMPING,
  SPRING_STIFFNESS,
  nextPanelIndex,
  releaseMotion,
  rubberBandOffset,
  springIsUnderdamped,
  springStep,
} from "./panel-motion"

const WIDTH = 390

describe("panel motion", () => {
  it("follows a drag inside the range and rubber-bands at the ends", () => {
    expect(rubberBandOffset(-80, 1, 4)).toBe(-80)
    expect(rubberBandOffset(80, 0, 4)).toBe(80 * RUBBER_BAND)
    expect(rubberBandOffset(-80, 3, 4)).toBe(-80 * RUBBER_BAND)
  })

  it("commits a short fast flick and a long slow drag", () => {
    const flick = nextPanelIndex({
      index: 1,
      count: 4,
      dx: -30,
      velocity: -(FLICK_PX_PER_MS + 0.1),
      width: WIDTH,
    })
    expect(flick).toBe(2)

    const drag = nextPanelIndex({
      index: 1,
      count: 4,
      dx: -(WIDTH * 0.25),
      velocity: 0,
      width: WIDTH,
    })
    expect(drag).toBe(2)
  })

  it("stays put on a short slow drag and cannot move past either end", () => {
    expect(
      nextPanelIndex({ index: 1, count: 4, dx: -20, velocity: -0.1, width: WIDTH }),
    ).toBe(1)
    expect(
      nextPanelIndex({ index: 0, count: 4, dx: WIDTH, velocity: 1, width: WIDTH }),
    ).toBe(0)
    expect(
      nextPanelIndex({ index: 3, count: 4, dx: -WIDTH, velocity: -1, width: WIDTH }),
    ).toBe(3)
  })

  it("uses a spring that can overshoot, and a cross-fade when reduced motion is on", () => {
    expect(springIsUnderdamped(SPRING_STIFFNESS, SPRING_DAMPING)).toBe(true)
    expect(releaseMotion(false)).toBe("spring")
    expect(releaseMotion(true)).toBe("fade")

    let state = { x: 0, v: 0 }
    for (let i = 0; i < 8; i++) state = springStep(state, 100, 1 / 120)
    expect(state.x).toBeGreaterThan(0)
    expect(Math.abs(state.x)).toBeLessThan(1_000)
  })
})
