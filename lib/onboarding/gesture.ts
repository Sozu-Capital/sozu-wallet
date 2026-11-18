export type ActivationGesture = "back" | "forward" | "ignore"

const TAP_SLOP_PX = 12
const BACK_ZONE = 0.35

/**
 * Commit a horizontal drag once it clearly beats a tap and a vertical scroll.
 * The threshold shrinks on narrow phones and never asks for more than 56px.
 */
export function activationDragThreshold(width: number): number {
  return Math.min(56, Math.max(36, width * 0.18))
}

/**
 * Turn a pointer gesture on the onboarding frame into one step.
 * The last screen does not advance from a tap or a drag — only its button does.
 */
export function resolveActivationGesture(input: {
  dx: number
  dy: number
  x: number
  width: number
  index: number
  count: number
  dragged: boolean
}): ActivationGesture {
  const { dx, dy, x, width, index, count, dragged } = input
  const last = count - 1

  if (dragged) {
    const horizontal = Math.abs(dx) > Math.abs(dy) && Math.abs(dx) >= activationDragThreshold(width)
    if (!horizontal) return "ignore"
    if (dx < 0 && index < last) return "forward"
    if (dx > 0 && index > 0) return "back"
    return "ignore"
  }

  if (Math.abs(dx) > TAP_SLOP_PX || Math.abs(dy) > TAP_SLOP_PX) return "ignore"
  if (x < width * BACK_ZONE) return index > 0 ? "back" : "ignore"
  if (index < last) return "forward"
  return "ignore"
}
