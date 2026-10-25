"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { motion } from "framer-motion"
import {
  airdropContactDurationMs,
  hapticAirdropContact,
} from "@/lib/haptics/web-haptics"
import {
  MOBILE_MAX_PIXEL_COUNT,
  MOBILE_MIN_PIXEL_RATIO,
} from "@/lib/shader/mobile-shader-config"

const GrainGradient = dynamic(
  () => import("@paper-design/shaders-react").then((mod) => mod.GrainGradient),
  { ssr: false },
)

const WASH_COLORS = [
  "hsl(40, 100%, 58%)",
  "hsl(28, 100%, 50%)",
  "hsl(18, 100%, 42%)",
  "hsl(12, 85%, 22%)",
]

/** Orange dots only. Golden-angle spread so they don't stack. */
const DOTS = Array.from({ length: 48 }, (_, i) => {
  const angle = (i * 137.5 * Math.PI) / 180
  const dist = 14 + (i % 7) * 6.5
  return {
    x: `${Math.cos(angle) * dist}vw`,
    y: `${Math.sin(angle) * dist * 0.9}vh`,
    delay: (i % 12) * 0.012,
    size: 4 + (i % 5),
    color: `hsl(${20 + (i % 6) * 4}, 100%, ${50 + (i % 4) * 5}%)`,
  }
})

type Phase = "idle" | "filling" | "sent"

/**
 * Tap test for the claim shake and the orange fill. Does not call the faucet.
 * Open /get/usdc?haptic=1 in Chrome on the Android and tap once.
 */
export function HapticProbe() {
  const [canVibrate, setCanVibrate] = useState<boolean | null>(null)
  const [phase, setPhase] = useState<Phase>("idle")
  const [fillKey, setFillKey] = useState(0)
  const [grow, setGrow] = useState(0)
  const [accepted, setAccepted] = useState<boolean | null>(null)
  const timer = useRef(0)
  const switchRef = useRef<HTMLInputElement>(null)
  const fillMs = airdropContactDurationMs()

  useEffect(() => {
    setCanVibrate(typeof navigator.vibrate === "function")
    switchRef.current?.setAttribute("switch", "")
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
      try {
        navigator.vibrate?.(0)
      } catch {
        /* ignore */
      }
    }
  }, [])

  const start = () => {
    if (phase === "filling") return
    if (timer.current) window.clearTimeout(timer.current)
    setFillKey((key) => key + 1)
    setGrow(0)
    setAccepted(hapticAirdropContact())
    setPhase("filling")
    const started = performance.now()
    const tick = () => {
      const t = Math.min(1, (performance.now() - started) / fillMs)
      const eased = t * t * (3 - 2 * t)
      setGrow(eased)
      if (t < 1) timer.current = window.setTimeout(tick, 32)
      else {
        timer.current = 0
        setPhase("sent")
      }
    }
    timer.current = window.setTimeout(tick, 32)
  }

  const status =
    phase === "filling"
      ? "Sending"
      : phase === "sent"
        ? "Sent"
        : accepted === false && canVibrate
          ? "The browser ignored the shake. Tap again."
          : canVibrate === false
            ? "Put your finger on the button. This browser can tick once."
            : "Tap once. Orange rises over the screen while the phone shakes."

  return (
    <main className="fixed inset-0 z-10 overflow-hidden bg-black text-center text-white">
      <OrangeRise grow={grow} speed={phase === "sent" ? 0.42 : 0.18} />

      {phase === "sent" ? <SentGrains key={fillKey} /> : null}

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6">
        <p className="text-sm text-white/70">Haptic test</p>
        <p className="mt-4 text-5xl font-semibold tracking-tight">100</p>
        <p className="mt-2 text-sm text-white/70">testnet USDC</p>
        <p className="mt-8 text-sm text-white/90" role="status">
          {status}
        </p>
        {phase !== "filling" ? (
          canVibrate === false ? (
            <label className="relative mt-8 inline-flex overflow-hidden rounded-full bg-white px-6 py-3 text-sm font-medium text-black">
              <span>{phase === "sent" ? "Again" : "Feel the claim"}</span>
              <input
                ref={switchRef}
                type="checkbox"
                aria-label="Feel the claim"
                onChange={start}
                className="absolute inset-0 m-0 h-full w-full cursor-pointer opacity-[0.02]"
                style={{ appearance: "auto", WebkitAppearance: "auto" }}
              />
            </label>
          ) : (
            <button
              type="button"
              disabled={canVibrate === null}
              onClick={start}
              className="mt-8 inline-flex rounded-full bg-white px-6 py-3 text-sm font-medium text-black disabled:opacity-40"
            >
              {phase === "sent" ? "Again" : "Feel the claim"}
            </button>
          )
        ) : null}
      </div>
    </main>
  )
}

function OrangeRise({ grow, speed }: { grow: number; speed: number }) {
  const reveal = Math.min(100, Math.max(0, grow * 100))

  return (
    <div
      aria-hidden
      data-rise=""
      className="pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden"
      style={{ height: `${reveal}%` }}
    >
      <div className="absolute inset-x-0 bottom-0 h-[100dvh]">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, hsl(16, 95%, 42%) 0%, hsl(28, 100%, 50%) 42%, hsl(18, 80%, 18%) 78%, #000 100%)",
          }}
        />
        <GrainGradient
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          colorBack="hsl(0, 0%, 0%)"
          shape="blob"
          scale={1.2}
          offsetX={0}
          offsetY={0.15}
          rotation={90}
          softness={0.8}
          intensity={0.66}
          noise={0.2}
          speed={speed}
          minPixelRatio={MOBILE_MIN_PIXEL_RATIO}
          maxPixelCount={MOBILE_MAX_PIXEL_COUNT}
          colors={WASH_COLORS}
        />
      </div>
      {reveal < 98 ? (
        <div
          className="absolute inset-x-0 top-0 h-24"
          style={{ background: "linear-gradient(to bottom, #000, transparent)" }}
        />
      ) : null}
    </div>
  )
}

function SentGrains() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden>
      {DOTS.map((dot, index) => (
        <motion.span
          key={index}
          className="absolute left-1/2 top-[46%] rounded-full"
          style={{
            width: dot.size,
            height: dot.size,
            marginLeft: -dot.size / 2,
            marginTop: -dot.size / 2,
            background: dot.color,
          }}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0.3 }}
          animate={{
            x: dot.x,
            y: dot.y,
            opacity: [0, 1, 1, 0],
            scale: [0.3, 1, 1],
          }}
          transition={{
            duration: 1.7,
            delay: dot.delay,
            ease: [0.16, 1, 0.3, 1],
          }}
        />
      ))}
    </div>
  )
}
