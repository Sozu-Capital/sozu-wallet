"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"

const HOLD_MS = 2600
const LAST_HOLD_MS = 4500

/**
 * Cycles statements, each fading up into place.
 * Visual only — the waitlist page has a single h1 in the manifesto.
 * Reduced motion holds the last line.
 */
export function RotatingStatements({ statements }: { statements: readonly string[] }) {
  const finalStatement = statements[statements.length - 1] ?? ""
  const reducedMotion = useReducedMotion()
  const [index, setIndex] = useState(0)
  // useReducedMotion is null on the server and a boolean on the client.
  // Branching the first paint on it mismatches hydration, so wait a frame.
  const [motionReady, setMotionReady] = useState(false)

  useEffect(() => {
    setMotionReady(true)
  }, [])

  useEffect(() => {
    setIndex(0)
  }, [statements])

  const holdLast = motionReady && reducedMotion === true

  useEffect(() => {
    if (!motionReady || holdLast) return
    const isLast = index === statements.length - 1
    const timer = setTimeout(
      () => setIndex((i) => (i + 1) % statements.length),
      isLast ? LAST_HOLD_MS : HOLD_MS,
    )
    return () => clearTimeout(timer)
  }, [holdLast, index, motionReady, statements.length])

  const visible = holdLast ? finalStatement : (statements[index] ?? "")

  return (
    <div
      aria-hidden
      className="relative flex min-h-[2em] items-center justify-center text-xl font-light tracking-tight text-white sm:text-2xl"
    >
      {holdLast ? (
        <span>{finalStatement}</span>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={visible}
            initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            {visible}
          </motion.span>
        </AnimatePresence>
      )}
    </div>
  )
}
