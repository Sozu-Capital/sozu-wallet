"use client"

import { motion } from "framer-motion"

const EASE = [0.22, 1, 0.36, 1] as const

const LINE_CLASS =
  "waitlist-manifesto-line m-0 max-w-[22ch] text-center text-[clamp(2.15rem,5.6vw,4.15rem)] font-light leading-[1.14] tracking-[-0.03em] text-black"

/** Last line is the page's only h1. The rest are paragraphs, in reading order. */
export function WaitlistManifesto({ lines }: { lines: readonly string[] }) {
  return (
    <div>
      {lines.map((line, index) => {
        const heading = index === lines.length - 1
        const Tag = heading ? motion.h1 : motion.p
        return (
          <div
            key={line}
            className="mx-auto flex w-full max-w-3xl items-center justify-center px-6"
            style={{ minHeight: "calc(var(--sozu-app-height, 100lvh) * 0.42)" }}
          >
            <Tag
              className={LINE_CLASS}
              initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: false, amount: 0.7 }}
              transition={{ duration: 0.6, ease: EASE }}
            >
              {line}
            </Tag>
          </div>
        )
      })}
    </div>
  )
}
