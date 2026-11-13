import { useRef, useCallback } from "react"
import { releaseVelocity } from "@/lib/shell/panel-motion"

const AXIS_LOCK_RATIO = 1.5

export type PanelGesture = {
  dx: number
  velocity: number
}

export type PanelSwipeHandlers = {
  onTouchStart: (e: React.TouchEvent) => void
  onTouchMove: (e: React.TouchEvent) => void
  onTouchEnd: (e: React.TouchEvent) => void
  onMouseDown: (e: React.MouseEvent) => void
  onMouseMove: (e: React.MouseEvent) => void
  onMouseUp: (e: React.MouseEvent) => void
  onMouseLeave: (e: React.MouseEvent) => void
  onTouchCancel: () => void
}

export function useHorizontalPanelSwipe({
  onDrag,
  onRelease,
  disabled = false,
}: {
  onDrag: (dx: number) => void
  onRelease: (gesture: PanelGesture) => void
  disabled?: boolean
}): PanelSwipeHandlers {
  const startX = useRef<number | null>(null)
  const startY = useRef<number | null>(null)
  const lastX = useRef<number | null>(null)
  const lastT = useRef<number | null>(null)
  const velocity = useRef(0)
  const lockedAxis = useRef<"horizontal" | "vertical" | null>(null)
  const isDragging = useRef(false)

  const reset = useCallback(() => {
    startX.current = null
    startY.current = null
    lastX.current = null
    lastT.current = null
    velocity.current = 0
    lockedAxis.current = null
    isDragging.current = false
  }, [])

  const sample = useCallback((x: number, now: number) => {
    if (lastX.current !== null && lastT.current !== null) {
      const dt = now - lastT.current
      if (dt > 0) velocity.current = (x - lastX.current) / dt
    }
    lastX.current = x
    lastT.current = now
  }, [])

  const finish = useCallback((canceled = false) => {
    const horizontal = lockedAxis.current === "horizontal"
    const dx =
      horizontal && startX.current !== null && lastX.current !== null
        ? lastX.current - startX.current
        : 0
    const sampleAge =
      lastT.current === null ? Number.POSITIVE_INFINITY : performance.now() - lastT.current
    const agedVelocity =
      canceled || !horizontal ? 0 : releaseVelocity(velocity.current, sampleAge)
    reset()
    onRelease({ dx, velocity: agedVelocity })
  }, [onRelease, reset])

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || e.touches.length !== 1) return
      const now = performance.now()
      startX.current = e.touches[0].clientX
      startY.current = e.touches[0].clientY
      lastX.current = e.touches[0].clientX
      lastT.current = now
      velocity.current = 0
      lockedAxis.current = null
    },
    [disabled],
  )

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || startX.current === null || startY.current === null) return
      const x = e.touches[0].clientX
      const dx = x - startX.current
      const dy = e.touches[0].clientY - startY.current
      sample(x, performance.now())
      if (!lockedAxis.current && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        lockedAxis.current =
          Math.abs(dx) > Math.abs(dy) * AXIS_LOCK_RATIO ? "horizontal" : "vertical"
      }
      if (lockedAxis.current === "horizontal") {
        e.preventDefault()
        onDrag(dx)
      }
    },
    [disabled, onDrag, sample],
  )

  const onTouchEnd = useCallback(() => {
    if (startX.current === null) return
    finish()
  }, [finish])

  const onTouchCancel = useCallback(() => {
    if (startX.current === null) return
    finish(true)
  }, [finish])

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled || e.button !== 0) return
      const now = performance.now()
      startX.current = e.clientX
      startY.current = e.clientY
      lastX.current = e.clientX
      lastT.current = now
      velocity.current = 0
      lockedAxis.current = null
      isDragging.current = true
    },
    [disabled],
  )

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (disabled || !isDragging.current || startX.current === null || startY.current === null) return
      const dx = e.clientX - startX.current
      const dy = e.clientY - startY.current
      sample(e.clientX, performance.now())
      if (!lockedAxis.current && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        lockedAxis.current =
          Math.abs(dx) > Math.abs(dy) * AXIS_LOCK_RATIO ? "horizontal" : "vertical"
      }
      if (lockedAxis.current === "horizontal") onDrag(dx)
    },
    [disabled, onDrag, sample],
  )

  const onMouseUp = useCallback(() => {
    if (!isDragging.current) return
    finish()
  }, [finish])

  const onMouseLeave = useCallback(() => {
    if (!isDragging.current) return
    finish()
  }, [finish])

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
    onTouchCancel,
  }
}
