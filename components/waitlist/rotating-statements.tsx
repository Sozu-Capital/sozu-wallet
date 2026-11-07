"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"

const HOLD_MS = 2600
const LAST_HOLD_MS = 4500

/**
 * Headline that cycles through statements, each fading up into place.
 * The last statement is the one screen readers get and the one shown under reduced motion.
 */
export function RotatingStatements({ statements }: { statements: readonly string[] }) {
  const finalStatement = statements[statements.length - 1] ?? ""
  const reducedMotion = useReducedMotion()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
  }, [statements])

  useEffect(() => {
    if (reducedMotion) return
    const isLast = index === statements.length - 1
    const timer = setTimeout(
      () => setIndex((i) => (i + 1) % statements.length),
      isLast ? LAST_HOLD_MS : HOLD_MS,
    )
    return () => clearTimeout(timer)
  }, [index, reducedMotion, statements.length])

  const visible = reducedMotion ? finalStatement : (statements[index] ?? "")

  return (
    <h1 className="relative flex min-h-[2em] items-center justify-center text-xl font-light tracking-tight text-white sm:text-2xl">
      <span className="sr-only">{finalStatement}</span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={visible}
          aria-hidden
          initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          {visible}
        </motion.span>
      </AnimatePresence>
    </h1>
  )
}
