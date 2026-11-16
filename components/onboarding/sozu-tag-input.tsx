"use client"

import { formatSozuTagLabel } from "@/lib/payment/sozu-tag-lookup"
import { cn } from "@/lib/utils"
import type { TagStatus } from "@/lib/onboarding/sozu-tag"

export type SozuTagInputProps = {
  value: string
  onValueChange: (tag: string) => void
  status: TagStatus
  label: string
  message?: string
  rules?: string
  filterHint?: string
  suggestions?: string[]
  tryLabel?: string
  signInLabel?: string
  retryLabel?: string
  clearLabel: string
  previewCaption?: string
  onSubmit?: () => void
  onRetry?: () => void
  onSignIn?: () => void
  onSelectSuggestion?: (tag: string) => void
  onFocus?: () => void
  onBlur?: () => void
  autoFocus?: boolean
  shake?: boolean
  className?: string
}

export function SozuTagInput({
  value,
  onValueChange,
  status,
  label,
  message,
  rules,
  filterHint,
  suggestions = [],
  tryLabel,
  signInLabel,
  retryLabel,
  clearLabel,
  previewCaption,
  onSubmit,
  onRetry,
  onSignIn,
  onSelectSuggestion,
  onFocus,
  onBlur,
  autoFocus,
  shake = false,
  className,
}: SozuTagInputProps) {
  const describedBy = ["sozu-tag-helper", status === "invalid" ? "" : "sozu-tag-rules"].filter(Boolean).join(" ")
  const showRules = status === "idle" || status === "typing" || status === "checking" || status === "error"
  const helperTone = status === "invalid" ? "alert" : "status"

  return (
    <div className={cn("w-full", className)}>
      <label htmlFor="sozu-tag" className="sr-only">
        {label}
      </label>
      <div
        className={cn(
          "sozu-field flex h-[60px] items-center rounded-2xl pl-[18px] pr-2",
          status === "invalid" ? "sozu-field-error" : status === "idle" ? "" : "sozu-field-focus",
          shake && status === "invalid" && "sozu-shake",
        )}
      >
        <span aria-hidden className="sozu-serif mr-1 text-[30px] leading-none text-[var(--sozu-text-subtle)]">
          $
        </span>
        <input
          id="sozu-tag"
          value={value}
          maxLength={30}
          autoFocus={autoFocus}
          inputMode="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="username"
          enterKeyHint="next"
          aria-describedby={describedBy}
          aria-invalid={status === "invalid" || undefined}
          onChange={(event) => onValueChange(event.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              onSubmit?.()
            }
          }}
          className="h-full min-w-0 flex-1 bg-transparent text-[20px] font-medium tracking-[-0.01em] text-[var(--sozu-text-primary)] caret-[var(--sozu-ember)] outline-none"
        />
        <Trailing status={status} clearLabel={clearLabel} onClear={() => onValueChange("")} />
      </div>

      <div className="mt-3 min-h-5 text-center">
        <p
          id="sozu-tag-helper"
          role={helperTone}
          aria-live={status === "invalid" ? "assertive" : "polite"}
          className={cn(
            "text-[13px] leading-[18px]",
            status === "invalid" ? "text-[var(--sozu-text-danger)]" : "text-[var(--sozu-text-secondary)]",
          )}
        >
          {status === "available" ? (
            <span className="inline-flex items-center gap-1.5">
              <EmberTick />
              {message}
            </span>
          ) : null}
          {status === "checking" || status === "invalid" || status === "error" ? message : null}
          {status === "taken" ? (
            <>
              {message}{" "}
              <button
                type="button"
                onClick={onSignIn}
                className="font-medium text-[var(--sozu-text-secondary)] underline decoration-[#5A5852] underline-offset-4"
              >
                {signInLabel}
              </button>
            </>
          ) : null}
          {status === "error" && onRetry ? (
            <>
              {" "}
              <button
                type="button"
                onClick={onRetry}
                className="font-medium text-[var(--sozu-text-muted)] underline decoration-[#5A5852] underline-offset-4"
              >
                {retryLabel}
              </button>
            </>
          ) : null}
        </p>
      </div>

      <div className="mt-3">
        {status === "available" && previewCaption ? (
          <TagPreview tag={value} caption={previewCaption} />
        ) : null}
        {status === "taken" && suggestions.length > 0 ? (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-[12px] text-[var(--sozu-text-subtle)]">{tryLabel}</span>
            {suggestions.map((tag) => (
              <button
                key={tag}
                type="button"
                aria-label={`${tryLabel} ${formatSozuTagLabel(tag)}`}
                onClick={() => onSelectSuggestion?.(tag)}
                className="inline-flex h-9 items-center rounded-full border-[1.5px] border-[var(--sozu-line-field)] bg-[var(--sozu-surface-1)] px-3.5 text-[14px] font-medium text-[var(--sozu-text-secondary)] transition-transform active:scale-[0.97]"
              >
                <span className="mr-0.5 text-[var(--sozu-text-subtle)]">$</span>
                {tag}
              </button>
            ))}
          </div>
        ) : null}
        {status === "invalid" && filterHint ? (
          <p className="text-center text-[12px] leading-4 text-[var(--sozu-text-subtle)]">{filterHint}</p>
        ) : null}
        {showRules ? (
          <p id="sozu-tag-rules" className="text-center text-[13px] leading-[18px] text-[var(--sozu-text-muted)]">
            {rules}
          </p>
        ) : (
          <p id="sozu-tag-rules" className="sr-only">
            {rules}
          </p>
        )}
      </div>
    </div>
  )
}

function Trailing({
  status,
  clearLabel,
  onClear,
}: {
  status: TagStatus
  clearLabel: string
  onClear: () => void
}) {
  if (status === "checking") {
    return (
      <span className="flex h-11 w-11 items-center justify-center text-[var(--sozu-text-muted)]" aria-hidden>
        <svg width="18" height="18" viewBox="0 0 18 18" className="animate-spin motion-reduce:animate-none">
          <circle cx="9" cy="9" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.35" />
          <path d="M9 2.5a6.5 6.5 0 0 1 6.5 6.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
    )
  }

  if (status === "available") {
    return (
      <span className="flex h-11 w-11 items-center justify-center" aria-hidden>
        <svg width="22" height="22" viewBox="0 0 22 22">
          <circle cx="11" cy="11" r="10" fill="#E8E6DE" />
          <path
            d="M6.5 11.2 9.4 14.1 15.5 8"
            fill="none"
            stroke="#1A1917"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="sozu-check-draw"
          />
        </svg>
      </span>
    )
  }

  if (status === "taken" || status === "invalid") {
    return (
      <button
        type="button"
        aria-label={clearLabel}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onClear}
        className="flex h-11 w-11 items-center justify-center text-[var(--sozu-text-secondary)]"
      >
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
          <path d="M7 7l8 8M15 7l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    )
  }

  return <span className="w-11" />
}

function EmberTick() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <path
        d="M2.5 7.2 5.4 10.1 11.5 4"
        fill="none"
        stroke="#E0603A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TagPreview({ tag, caption }: { tag: string; caption: string }) {
  return (
    <div
      aria-hidden
      className="flex h-[52px] items-center gap-3 rounded-2xl border-[1.5px] border-[var(--sozu-line-field)] bg-[var(--sozu-surface-field)] px-3.5"
    >
      <span className="sozu-obsidian flex h-[30px] w-[30px] shrink-0 items-center justify-center overflow-hidden rounded-full">
        {/* The November mark is the official S. The PNG is the source; it is not redrawn. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/november-2026/mark.png" alt="" className="h-10 w-10 max-w-none object-contain" />
      </span>
      <span className="min-w-0 text-left">
        <span className="block text-[15px] font-medium leading-5 text-[var(--sozu-text-primary)]">
          {formatSozuTagLabel(tag)}
        </span>
        <span className="block truncate text-[12px] leading-4 text-[var(--sozu-text-muted)]">{caption}</span>
      </span>
    </div>
  )
}
