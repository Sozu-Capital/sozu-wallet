"use client"

import dynamic from "next/dynamic"
import { useEffect, useState, type FormEvent } from "react"
import { ArrowRight, Check, Loader2 } from "lucide-react"
import { RotatingStatements } from "@/components/waitlist/rotating-statements"
import { signalBootstrapReady } from "@/lib/app-ready"
import type { WaitlistLocale } from "@/lib/waitlist/signup"

const WaitlistShader = dynamic(
  () => import("@/components/waitlist/waitlist-shader").then((mod) => mod.WaitlistShader),
  { ssr: false },
)

/** Same key the wallet uses, so a visitor's language carries over once the app reopens. */
const LANGUAGE_STORAGE_KEY = "sozu_app_language:v2"

const COPY = {
  es: {
    statements: [
      "Despierta...",
      "Dólares digitales en tu bolsillo.",
      "Paga a cualquiera con un toque.",
      "Tus llaves. Tu dinero.",
      "Los primeros ganan.",
    ],
    placeholder: "tu@correo.com",
    submit: "Unirme",
    success: "Estás dentro.",
    invalid: "Revisa tu correo.",
    failed: "No pudimos guardarlo. Intenta de nuevo.",
  },
  en: {
    statements: [
      "Wake up...",
      "Digital dollars in your pocket.",
      "Pay anyone with a tap.",
      "Your keys. Your money.",
      "Early users get rewarded.",
    ],
    placeholder: "you@email.com",
    submit: "Join",
    success: "You're in.",
    invalid: "Check your email.",
    failed: "We couldn't save it. Try again.",
  },
} as const satisfies Record<WaitlistLocale, { statements: readonly string[] } & Record<string, unknown>>

type Status = "idle" | "submitting" | "done" | "invalid" | "failed"

export function WaitlistScreen() {
  const [locale, setLocale] = useState<WaitlistLocale>("es")
  const [email, setEmail] = useState("")
  const [company, setCompany] = useState("")
  const [status, setStatus] = useState<Status>("idle")
  const t = COPY[locale]

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
      if (stored === "en" || stored === "es") setLocale(stored)
    } catch {
      // private browsing
    }
    signalBootstrapReady()
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  function changeLocale(next: WaitlistLocale) {
    setLocale(next)
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, next)
    } catch {
      // private browsing
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (status === "submitting") return
    setStatus("submitting")
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale, company }),
      })
      if (response.ok) {
        setStatus("done")
        return
      }
      setStatus(response.status === 400 ? "invalid" : "failed")
    } catch {
      setStatus("failed")
    }
  }

  const message = status === "invalid" ? t.invalid : status === "failed" ? t.failed : null

  return (
    <main className="fixed inset-0 z-[1] flex flex-col items-center justify-center overflow-hidden bg-black text-white">
      <WaitlistShader />

      <div className="absolute right-0 top-0 z-[2] flex gap-1 p-[max(1rem,env(safe-area-inset-top))] text-[11px] font-light tracking-[0.14em]">
        {(["es", "en"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => changeLocale(option)}
            aria-pressed={locale === option}
            className={`rounded-full px-2.5 py-1 uppercase transition-colors ${
              locale === option ? "text-white" : "text-white/45 hover:text-white/80"
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="relative z-[2] flex w-full max-w-sm flex-col items-center px-6 text-center">
        <img
          src="/brand/november-2026/mark.png"
          alt="Sozu"
          width={192}
          height={192}
          className="h-40 w-40 -translate-x-[2%] translate-y-[7%] object-contain sm:h-48 sm:w-48"
        />

        <div className="mt-6">
          <RotatingStatements statements={t.statements} />
        </div>
        {status === "done" ? (
          <div
            role="status"
            className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.04] text-sm text-white/85 backdrop-blur-md"
          >
            <Check className="h-4 w-4" aria-hidden />
            {t.success}
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 w-full" noValidate>
            <div className="flex h-12 w-full items-center rounded-full border border-white/15 bg-white/[0.04] pl-5 pr-1 backdrop-blur-md transition-colors focus-within:border-white/40">
              <label htmlFor="waitlist-email" className="sr-only">
                Email
              </label>
              <input
                id="waitlist-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  if (status === "invalid" || status === "failed") setStatus("idle")
                }}
                placeholder={t.placeholder}
                className="min-w-0 flex-1 bg-transparent text-[16px] font-light text-white placeholder:text-white/30 focus:outline-none"
              />
              <button
                type="submit"
                disabled={status === "submitting" || email.trim().length === 0}
                className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-medium text-black transition-opacity disabled:opacity-40"
              >
                {status === "submitting" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <>
                    {t.submit}
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
              onChange={(event) => setCompany(event.target.value)}
              className="absolute -left-[9999px] h-0 w-0 opacity-0"
            />
            <p role="alert" aria-live="polite" className="mt-3 h-4 text-xs font-light text-white/60">
              {message}
            </p>
          </form>
        )}
      </div>

      <p className="absolute bottom-0 left-0 right-0 z-[2] pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center text-[10px] font-extralight tracking-[0.3em] text-white/50">
        SOZU CAPITAL
      </p>
    </main>
  )
}
