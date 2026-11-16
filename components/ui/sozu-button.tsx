"use client"

import type { ButtonHTMLAttributes, ReactNode } from "react"
import { cn } from "@/lib/utils"
import { useAppHaptics } from "@/hooks/use-app-haptics"

type SozuButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "paper" | "quiet"
  loading?: boolean
  icon?: ReactNode
}

export function SozuButton({
  variant = "paper",
  loading = false,
  icon,
  className,
  children,
  disabled,
  onClick,
  type = "button",
  ...props
}: SozuButtonProps) {
  const { play } = useAppHaptics()
  const unavailable = Boolean(disabled) || loading

  return (
    <button
      type={type}
      aria-disabled={unavailable || undefined}
      aria-busy={loading || undefined}
      onClick={(event) => {
        if (unavailable) {
          event.preventDefault()
          return
        }
        if (variant === "paper") play()
        onClick?.(event)
      }}
      className={cn(
        "relative flex h-[54px] w-full items-center justify-center gap-2.5 rounded-2xl px-5",
        "text-[16px] font-medium tracking-[-0.015em]",
        "transition-transform duration-150 ease-out active:scale-[0.97]",
        "motion-reduce:transition-none motion-reduce:active:scale-100",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9C6BC] focus-visible:ring-offset-2 focus-visible:ring-offset-[#161513]",
        variant === "paper" && !unavailable && "sozu-paper-button",
        unavailable &&
          "border-[1.5px] border-[var(--sozu-line-field)] bg-[var(--sozu-surface-disabled)] text-[var(--sozu-text-secondary)]",
        className,
      )}
      {...props}
    >
      {loading ? <span className="sr-only">{children}</span> : null}
      {!loading && icon}
      <span className={loading ? "invisible" : undefined}>{children}</span>
      {loading ? (
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
          <StepSpinner />
        </span>
      ) : null}
    </button>
  )
}

export function SozuTextButton({
  className,
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { size?: "md" | "sm" }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-11 items-center justify-center px-3 underline decoration-[#5A5852] underline-offset-4",
        "text-[var(--sozu-text-secondary)] transition-opacity active:opacity-70",
        "focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9C6BC]",
        "disabled:text-[var(--sozu-text-subtle)] disabled:no-underline",
        size === "md" ? "text-[15px] font-medium" : "text-[13px] font-medium",
        className,
      )}
      {...props}
    />
  )
}

function StepSpinner() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" className="animate-spin motion-reduce:animate-none" aria-hidden>
      <g fill="currentColor">
        {Array.from({ length: 8 }, (_, index) => {
          const angle = index * 45
          return (
            <rect
              key={angle}
              x="8"
              y="1.2"
              width="2"
              height="4.2"
              rx="1"
              opacity={0.25 + index * 0.1}
              transform={`rotate(${angle} 9 9)`}
            />
          )
        })}
      </g>
    </svg>
  )
}
