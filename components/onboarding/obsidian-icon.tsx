"use client"

import { useId } from "react"
import { cn } from "@/lib/utils"

type ObsidianIconProps = {
  name?: "tag"
  size?: number
  className?: string
  label?: string
}

export function ObsidianIcon({ name = "tag", size = 64, className, label }: ObsidianIconProps) {
  const id = useId().replace(/:/g, "")
  const radius = Math.round(size * 0.295)

  return (
    <div
      className={cn("sozu-obsidian relative shrink-0", className)}
      style={{ width: size, height: size, borderRadius: radius }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <radialGradient id={`${id}-ember`} cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#FFB592" />
            <stop offset="55%" stopColor="#E0603A" />
            <stop offset="100%" stopColor="#A9401E" />
          </radialGradient>
        </defs>
        {name === "tag" ? <TagGlyph emberId={`${id}-ember`} /> : null}
      </svg>
    </div>
  )
}

function TagGlyph({ emberId }: { emberId: string }) {
  return (
    <g>
      <path
        d="M46 40h28c6 0 10 4 10 10v22c0 6-4 10-10 10H52l-12-12V50c0-6 4-10 10-10z"
        fill="none"
        stroke="#070605"
        strokeOpacity="0.8"
        strokeWidth="3.5"
        strokeLinejoin="round"
        transform="translate(0 1.1)"
      />
      <path
        d="M46 40h28c6 0 10 4 10 10v22c0 6-4 10-10 10H52l-12-12V50c0-6 4-10 10-10z"
        fill="none"
        stroke="#EDEAE1"
        strokeWidth="3.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M54 56h22M54 66h14" stroke="#EDEAE1" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="48" cy="76" r="3.6" fill={`url(#${emberId})`} />
    </g>
  )
}
