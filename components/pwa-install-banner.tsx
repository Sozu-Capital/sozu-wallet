"use client"

import { X } from "lucide-react"
import { animate, motion, useMotionValue } from "framer-motion"
import { useRef, type PointerEvent as ReactPointerEvent } from "react"

/** Upward travel that dismisses even as a slow drag. */
const DISMISS_DISTANCE_PX = 28
/** Short flick still dismisses when it leaves the finger quickly. */
const FLICK_DISTANCE_PX = 12
const FLICK_VELOCITY_PX_PER_S = 650
/** Movement below this stays a tap so the install and close buttons still click. */
const TAP_SLOP_PX = 8

type Gesture = {
  id: number
  startY: number
  lastY: number
  lastT: number
  velocity: number
  captured: boolean
}

type PwaInstallBannerProps = {
  subtitle: string
  actionLabel: string
  closeLabel: string
  onAction: () => void
  onDismiss: () => void
}

export function PwaInstallBanner({
  subtitle,
  actionLabel,
  closeLabel,
  onAction,
  onDismiss,
}: PwaInstallBannerProps) {
  const y = useMotionValue(0)
  const gesture = useRef<Gesture | null>(null)
  const suppressClick = useRef(false)

  function settle(clientY: number, timeStamp: number) {
    const current = gesture.current
    if (!current) return
    gesture.current = null

    const offsetY = clientY - current.startY
    if (Math.abs(offsetY) > TAP_SLOP_PX) suppressClick.current = true

    // A finger that paused before release is a drag, not a flick.
    const velocity = timeStamp - current.lastT > 50 ? 0 : current.velocity
    const flicked =
      offsetY <= -FLICK_DISTANCE_PX && velocity <= -FLICK_VELOCITY_PX_PER_S
    const dragged = offsetY <= -DISMISS_DISTANCE_PX
    if (flicked || dragged) {
      onDismiss()
      return
    }

    void animate(y, 0, { type: "spring", stiffness: 720, damping: 40, mass: 0.45 })
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    suppressClick.current = false
    y.stop()
    gesture.current = {
      id: event.pointerId,
      startY: event.clientY,
      lastY: event.clientY,
      lastT: event.timeStamp,
      velocity: 0,
      captured: false,
    }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const current = gesture.current
    if (!current || event.pointerId !== current.id) return

    const offsetY = event.clientY - current.startY
    const dt = event.timeStamp - current.lastT
    if (dt > 0) {
      const instant = ((event.clientY - current.lastY) / dt) * 1000
      current.velocity = current.velocity * 0.35 + instant * 0.65
    }
    current.lastY = event.clientY
    current.lastT = event.timeStamp

    if (!current.captured && Math.abs(offsetY) >= TAP_SLOP_PX) {
      current.captured = true
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Pointer already ended. Moves that still hit the banner keep tracking.
      }
    }
    if (!current.captured) return

    // 1:1 with the finger on the way up. A little resistance downward.
    y.set(offsetY < 0 ? offsetY : offsetY * 0.18)
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!gesture.current || event.pointerId !== gesture.current.id) return
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    } catch {
      // Capture was already released.
    }
    settle(event.clientY, event.timeStamp)
  }

  function onPointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    if (!gesture.current || event.pointerId !== gesture.current.id) return
    settle(gesture.current.lastY, event.timeStamp)
  }

  return (
    <motion.div
      initial={{ y: "-110%", opacity: 0 }}
      animate={{
        y: 0,
        opacity: 1,
        transition: { type: "spring", damping: 28, stiffness: 320, delay: 1.2 },
      }}
      exit={{
        y: "-120%",
        opacity: 0,
        transition: { duration: 0.16, ease: [0.4, 0, 1, 1] },
      }}
      className="fixed left-3 right-3 z-[60]"
      style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
    >
      <motion.div
        style={{
          y,
          background: "rgba(18, 18, 20, 0.82)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          touchAction: "none",
        }}
        className="touch-none select-none rounded-2xl border border-white/[0.10] py-2.5 pl-3.5 pr-1.5"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onDragStart={(event) => event.preventDefault()}
        onClickCapture={(event) => {
          if (!suppressClick.current) return
          suppressClick.current = false
          event.preventDefault()
          event.stopPropagation()
        }}
      >
        <div className="flex items-center gap-3">
          <img
            src="/icons/sozu_icon_192.png"
            alt=""
            draggable={false}
            className="pointer-events-none h-11 w-11 shrink-0 rounded-[22%] object-cover"
          />

          <div className="flex min-w-0 flex-1 flex-col">
            <p className="text-[13px] font-semibold leading-tight text-white">Sozu</p>
            <p className="mt-0.5 text-[11px] leading-tight text-white/45">{subtitle}</p>
          </div>

          <button
            type="button"
            onClick={onAction}
            className="shrink-0 touch-manipulation rounded-full bg-white px-3.5 py-1.5 text-[12px] font-semibold text-black transition-transform hover:bg-white/90 active:scale-95"
          >
            {actionLabel}
          </button>

          <button
            type="button"
            onClick={onDismiss}
            aria-label={closeLabel}
            className="-my-2 flex h-14 w-14 shrink-0 touch-manipulation items-center justify-center rounded-full text-white/80 active:bg-white/10"
          >
            <span className="pointer-events-none flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.12]">
              <X className="h-5 w-5" strokeWidth={2.25} />
            </span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
