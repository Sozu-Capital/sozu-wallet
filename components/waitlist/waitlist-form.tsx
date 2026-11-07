"use client"

import type { FormEvent } from "react"
import { ArrowRight, Check, Loader2 } from "lucide-react"

export type WaitlistStatus = "idle" | "submitting" | "done" | "invalid" | "failed"

type WaitlistFormProps = {
  id: string
  tone: "dark" | "light"
  email: string
  company: string
  status: WaitlistStatus
  placeholder: string
  submitLabel: string
  success: string
  message: string | null
  onEmail: (value: string) => void
  onCompany: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

const TONE = {
  dark: {
    success:
      "flex h-12 w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.04] text-sm text-white/85 backdrop-blur-md",
    shell:
      "flex h-12 w-full items-center rounded-full border border-white/15 bg-white/[0.04] pl-5 pr-1 backdrop-blur-md transition-colors focus-within:border-white/40",
    input:
      "min-w-0 flex-1 bg-transparent text-[16px] font-light text-white placeholder:text-white/30 focus:outline-none",
    button:
      "flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-medium text-black transition-opacity disabled:opacity-40",
    alert: "mt-3 h-4 text-xs font-light text-white/60",
  },
  light: {
    success:
      "flex h-12 w-full items-center justify-center gap-2 rounded-full border border-black/15 bg-black/[0.04] text-sm text-black/80",
    shell:
      "flex h-12 w-full items-center rounded-full border border-black/15 bg-black/[0.03] pl-5 pr-1 transition-colors focus-within:border-black/35",
    input:
      "min-w-0 flex-1 bg-transparent text-[16px] font-light text-black placeholder:text-black/35 focus:outline-none",
    button:
      "flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-black px-4 text-sm font-medium text-white transition-opacity disabled:opacity-40",
    alert: "mt-3 h-4 text-xs font-light text-black/55",
  },
} as const

export function WaitlistForm({
  id,
  tone,
  email,
  company,
  status,
  placeholder,
  submitLabel,
  success,
  message,
  onEmail,
  onCompany,
  onSubmit,
}: WaitlistFormProps) {
  const styles = TONE[tone]

  if (status === "done") {
    return (
      <div role="status" className={styles.success}>
        <Check className="h-4 w-4" aria-hidden />
        {success}
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="relative w-full" noValidate>
      <div className={styles.shell}>
        <label htmlFor={id} className="sr-only">
          Email
        </label>
        <input
          id={id}
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => onEmail(event.target.value)}
          placeholder={placeholder}
          className={styles.input}
        />
        <button
          type="submit"
          disabled={status === "submitting" || email.trim().length === 0}
          className={styles.button}
        >
          {status === "submitting" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <>
              {submitLabel}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </>
          )}
        </button>
      </div>
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        value={company}
        onChange={(event) => onCompany(event.target.value)}
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />
      <p role="alert" aria-live="polite" className={styles.alert}>
        {message}
      </p>
    </form>
  )
}
