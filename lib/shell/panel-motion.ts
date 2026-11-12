/** Underdamped spring. Damping is just below critical, so the panel overshoots slightly and lands. */
export const SPRING_STIFFNESS = 300
export const SPRING_DAMPING = 30

/** A drag past this fraction of the panel width changes panel even when the flick is slow. */
export const COMMIT_FRACTION = 0.25

/** Finger speed, in pixels per millisecond, that changes panel on a short flick. */
export const FLICK_PX_PER_MS = 0.5

/** A sample older than this is a held finger, not a flick. */
export const FLICK_SAMPLE_MS = 80

/** How much of a pull past the first or last panel is shown. */
export const RUBBER_BAND = 0.35

export type PanelMotion = "spring" | "fade"

export function rubberBandOffset(dx: number, index: number, count: number): number {
  const pullingPastStart = index <= 0 && dx > 0
  const pullingPastEnd = index >= count - 1 && dx < 0
  if (pullingPastStart || pullingPastEnd) return dx * RUBBER_BAND
  return dx
}

/** Pixel position while a finger is down. Past the first or last panel, only part of the pull shows. */
export function followOffset(origin: number, dx: number, count: number, width: number): number {
  if (count <= 0 || width <= 0) return origin
  const raw = origin + dx
  const max = 0
  const min = -(count - 1) * width
  if (raw > max) return (raw - max) * RUBBER_BAND
  if (raw < min) return min + (raw - min) * RUBBER_BAND
  return raw
}

/**
 * Finger left (negative dx or velocity) moves toward the next panel.
 * Distance and flick both commit. The index never leaves 0..count-1.
 */
export function nextPanelIndex(input: {
  index: number
  count: number
  dx: number
  velocity: number
  width: number
}): number {
  const { index, count, dx, velocity, width } = input
  if (count <= 0 || width <= 0) return index
  const distanceCommit = Math.abs(dx) >= width * COMMIT_FRACTION
  const flickCommit = Math.abs(velocity) >= FLICK_PX_PER_MS
  if (!distanceCommit && !flickCommit) return index
  const signed = distanceCommit ? Math.sign(dx) : Math.sign(velocity)
  if (signed === 0) return index
  const delta = signed < 0 ? 1 : -1
  return Math.min(count - 1, Math.max(0, index + delta))
}

/** A finger that has been still does not count as a flick. */
export function releaseVelocity(velocity: number, sampleAgeMs: number): number {
  if (!Number.isFinite(sampleAgeMs) || sampleAgeMs > FLICK_SAMPLE_MS) return 0
  return velocity
}

/** Reduced motion cross-fades. It does not run the spring, so there is no overshoot. */
export function releaseMotion(reducedMotion: boolean): PanelMotion {
  return reducedMotion ? "fade" : "spring"
}

export function springIsUnderdamped(
  stiffness = SPRING_STIFFNESS,
  damping = SPRING_DAMPING,
): boolean {
  return damping < 2 * Math.sqrt(stiffness)
}

/** Semi-implicit step. `dt` is seconds. */
export function springStep(
  state: { x: number; v: number },
  target: number,
  dt: number,
  stiffness = SPRING_STIFFNESS,
  damping = SPRING_DAMPING,
): { x: number; v: number } {
  const accel = -stiffness * (state.x - target) - damping * state.v
  const v = state.v + accel * dt
  const x = state.x + v * dt
  return { x, v }
}
