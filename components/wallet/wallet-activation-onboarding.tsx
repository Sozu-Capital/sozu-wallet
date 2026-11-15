"use client"

import Image from "next/image"
import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { resolveActivationGesture } from "@/lib/onboarding/gesture"
import {
  WALLET_ACTIVATION_SLIDE_COUNT,
  activationCta,
  activationDialogLabel,
  activationSlides,
  type ActivationSlide,
} from "@/lib/onboarding/slides"
import { useWalletLanguage } from "@/lib/wallet-language"

const SLIDE_MS = 420
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)"
const BLACK_FADE_MS = 650
const WALLET_REVEAL_MS = 750
const DRAG_ARM_PX = 10

type Phase = "slides" | "black" | "done"

type WalletActivationOnboardingProps = {
  open: boolean
  activationSettled: boolean
  onExitComplete: () => void
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function placeTrack(el: HTMLDivElement, index: number, offsetPx: number, animate: boolean) {
  const motion = animate && !prefersReducedMotion()
  el.style.transitionProperty = "transform"
  el.style.transitionDuration = motion ? `${SLIDE_MS}ms` : "0ms"
  el.style.transitionTimingFunction = EASE
  el.style.transform = `translate3d(calc(${-index * 100}% + ${offsetPx}px), 0, 0)`
}

function SlideCopy({ slide }: { slide: ActivationSlide }) {
  return (
    <div className="flex min-h-full w-full shrink-0 flex-col items-center justify-center px-8 py-6 text-center">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/45">{slide.step}</p>
      <h1 className="mt-3 max-w-[18rem] text-[1.75rem] font-semibold leading-tight tracking-tight">
        {slide.title}
      </h1>
      <p className="mt-4 max-w-[20rem] text-base leading-relaxed text-white/70">{slide.body}</p>
      {slide.note ? (
        <p className="mt-6 max-w-[18rem] text-sm leading-relaxed text-white/45">{slide.note}</p>
      ) : null}
    </div>
  )
}

/**
 * Full-screen onboarding while the wallet activates.
 *
 * The copy rides one horizontal track. Steps move with translate3d only, so
 * the frame stays on the compositor. A drag follows the finger and snaps; a
 * tap uses the left 35% of the frame to go back and the rest to go forward.
 * The last step opens the wallet from its button, after activation has settled.
 */
export function WalletActivationOnboarding({
  open,
  activationSettled,
  onExitComplete,
}: WalletActivationOnboardingProps) {
  const { language } = useWalletLanguage()
  const slides = activationSlides(language)
  const [phase, setPhase] = useState<Phase>("slides")
  const [slideIndex, setSlideIndex] = useState(0)
  const [exitPending, setExitPending] = useState(false)

  const exitStartedRef = useRef(false)
  const indexRef = useRef(0)
  const trackRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const pointerRef = useRef({
    id: -1,
    startX: 0,
    startY: 0,
    active: false,
    dragging: false,
  })

  const syncTrack = useCallback((index: number, offsetPx: number, animate: boolean) => {
    const el = trackRef.current
    if (!el) return
    placeTrack(el, index, offsetPx, animate)
  }, [])

  const commitIndex = useCallback(
    (next: number) => {
      indexRef.current = next
      setSlideIndex(next)
      syncTrack(next, 0, true)
    },
    [syncTrack],
  )

  const goToSlide = useCallback(
    (next: number) => {
      if (exitStartedRef.current) return
      if (next >= WALLET_ACTIVATION_SLIDE_COUNT) {
        setExitPending(true)
        return
      }
      if (next < 0 || next === indexRef.current) return
      commitIndex(next)
    },
    [commitIndex],
  )

  const startExit = useCallback(() => {
    if (exitStartedRef.current) return
    exitStartedRef.current = true
    setPhase("black")
    const reduced = prefersReducedMotion()
    const wait = reduced ? 0 : BLACK_FADE_MS + WALLET_REVEAL_MS
    window.setTimeout(() => {
      setPhase("done")
      onExitComplete()
    }, wait)
  }, [onExitComplete])

  useEffect(() => {
    if (!open) return
    setPhase("slides")
    indexRef.current = 0
    setSlideIndex(0)
    setExitPending(false)
    exitStartedRef.current = false
    pointerRef.current.active = false
    syncTrack(0, 0, false)
    dialogRef.current?.focus()
  }, [open, syncTrack])

  useEffect(() => {
    if (exitPending && activationSettled) startExit()
  }, [exitPending, activationSettled, startExit])

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    pointerRef.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      active: true,
      dragging: false,
    }
  }, [])

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current
    if (!pointer.active || pointer.id !== event.pointerId || exitStartedRef.current) return

    const dx = event.clientX - pointer.startX
    const dy = event.clientY - pointer.startY
    if (!pointer.dragging) {
      if (Math.abs(dx) < DRAG_ARM_PX && Math.abs(dy) < DRAG_ARM_PX) return
      if (Math.abs(dy) > Math.abs(dx)) {
        pointer.active = false
        return
      }
      pointer.dragging = true
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // The move listener stays on the frame if capture is unavailable.
      }
    }

    const index = indexRef.current
    const atStart = index === 0 && dx > 0
    const atEnd = index === WALLET_ACTIVATION_SLIDE_COUNT - 1 && dx < 0
    syncTrack(index, atStart || atEnd ? dx * 0.28 : dx, false)
  }, [syncTrack])

  const finishPointer = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const pointer = pointerRef.current
      if (!pointer.active || pointer.id !== event.pointerId) return
      pointer.active = false

      const frame = frameRef.current
      const width = frame?.clientWidth || window.innerWidth
      const rect = frame?.getBoundingClientRect()
      const x = rect ? event.clientX - rect.left : event.clientX
      const gesture = resolveActivationGesture({
        dx: event.clientX - pointer.startX,
        dy: event.clientY - pointer.startY,
        x,
        width,
        index: indexRef.current,
        count: WALLET_ACTIVATION_SLIDE_COUNT,
        dragged: pointer.dragging,
      })

      if (gesture === "back") goToSlide(indexRef.current - 1)
      else if (gesture === "forward") goToSlide(indexRef.current + 1)
      else if (pointer.dragging) syncTrack(indexRef.current, 0, true)
    },
    [goToSlide, syncTrack],
  )

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.target instanceof HTMLElement && event.target.closest("button")) {
        if (event.key === "Enter" || event.key === " ") return
      }
      if (event.key === "ArrowRight" || event.key === " " || event.key === "Enter") {
        event.preventDefault()
        goToSlide(indexRef.current + 1)
      } else if (event.key === "ArrowLeft") {
        event.preventDefault()
        goToSlide(indexRef.current - 1)
      }
    },
    [goToSlide],
  )

  if (!open || phase === "done") return null

  const waitingForActivation = exitPending && !activationSettled
  const safeIndex = Math.min(slideIndex, slides.length - 1)
  const cta = activationCta(language, safeIndex === WALLET_ACTIVATION_SLIDE_COUNT - 1)
  const fadeMs = BLACK_FADE_MS

  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 bg-black ease-in-out motion-reduce:transition-none"
        style={{
          opacity: phase === "black" ? 1 : 0,
          transitionProperty: "opacity",
          transitionDuration: `${fadeMs}ms`,
          zIndex: 210,
        }}
      />

      <div
        ref={dialogRef}
        className="fixed inset-0 z-[200] flex touch-manipulation select-none justify-center outline-none"
        role="dialog"
        aria-modal
        aria-label={activationDialogLabel(language)}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onTouchStart={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
        onTouchEnd={(event) => event.stopPropagation()}
      >
        <div
          ref={frameRef}
          className="flex h-dvh w-full max-w-[430px] flex-col bg-black text-white"
        >
          <div className="flex justify-center pt-[max(1.25rem,env(safe-area-inset-top))]">
            <Image
              src="/brand/november-2026/mark.png"
              alt=""
              width={72}
              height={72}
              priority
              className="h-[72px] w-[72px] object-contain"
            />
          </div>

          <div
            className="relative min-h-0 flex-1 overflow-hidden"
            style={{ touchAction: "pan-y" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={finishPointer}
            onPointerCancel={finishPointer}
          >
            <div ref={trackRef} className="flex h-full will-change-transform">
              {slides.map((slide, index) => (
                <section
                  key={slide.step}
                  className="h-full w-full shrink-0 overflow-y-auto"
                  aria-hidden={index !== safeIndex}
                  inert={index !== safeIndex}
                >
                  <SlideCopy slide={slide} />
                </section>
              ))}
            </div>
          </div>

          <p className="sr-only" aria-live="polite">
            {slides[safeIndex]?.step}. {slides[safeIndex]?.title}
          </p>

          <div
            className="px-6"
            style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
          >
            <div className="mb-5 flex justify-center gap-2" aria-hidden>
              {slides.map((slide, dot) => (
                <span
                  key={slide.step}
                  className="h-1.5 w-1.5 rounded-full bg-white motion-reduce:transition-none"
                  style={{
                    opacity: dot === safeIndex ? 1 : 0.28,
                    transform: dot === safeIndex ? "scale(1.35)" : "scale(1)",
                    transitionProperty: "transform, opacity",
                    transitionDuration: `${SLIDE_MS}ms`,
                    transitionTimingFunction: EASE,
                  }}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => goToSlide(safeIndex + 1)}
              aria-label={cta}
              aria-busy={waitingForActivation}
              disabled={waitingForActivation}
              className={cn(
                "h-14 w-full rounded-full bg-white text-base font-semibold text-black",
                "transition-transform duration-150 ease-out active:scale-[0.98]",
                "motion-reduce:transition-none motion-reduce:active:scale-100",
                "disabled:opacity-80",
                waitingForActivation && "animate-pulse",
              )}
            >
              {cta}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
