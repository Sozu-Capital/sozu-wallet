"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RECOVERY_START_MESSAGE, normalizeRecoveryEmail } from "@/lib/auth/recovery-email"
import { useWalletLanguage } from "@/lib/wallet-language"

const COPY = {
  es: {
    title: "Recuperar mi cuenta",
    description: "Si hay una cuenta con este correo, te llega un enlace para crear una llave nueva.",
    placeholder: "Correo",
    button: "Enviar enlace",
    invalid: "Escribí un correo válido.",
    sending: "Enviando…",
    back: "Volver",
    failed: "No pudimos enviar el correo. Intentá de nuevo.",
  },
  en: {
    title: "Recover my account",
    description: "If an account uses this email, you'll get a link to create a new passkey.",
    placeholder: "Email",
    button: "Send link",
    invalid: "Enter a valid email.",
    sending: "Sending…",
    back: "Back",
    failed: "We couldn't send the email. Try again.",
  },
} as const

const fieldClass =
  "h-11 rounded-none border-0 border-b border-b-white/15 bg-transparent px-0 text-center text-lg font-light tracking-[0.15em] text-white placeholder:text-white/25 focus-visible:border-b-white/40 focus-visible:ring-0"

export function RecoverAccountScreen({ onBack }: { onBack: () => void }) {
  const { language } = useWalletLanguage()
  const copy = COPY[language] ?? COPY.es
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [sent, setSent] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = () => {
    const normalized = normalizeRecoveryEmail(email)
    if (!normalized) {
      setError(copy.invalid)
      return
    }
    setBusy(true)
    setError("")
    void (async () => {
      try {
        const response = await fetch("/api/auth/recovery/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalized }),
        })
        const data = (await response.json().catch(() => ({}))) as { message?: string; error?: string }
        if (!response.ok) {
          setError(typeof data.error === "string" ? data.error : copy.failed)
          return
        }
        setSent(typeof data.message === "string" ? data.message : RECOVERY_START_MESSAGE)
      } catch {
        setError(copy.failed)
      } finally {
        setBusy(false)
      }
    })()
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 backdrop-blur-md">
      <div className="w-full max-w-sm rounded-lg border border-white/10 bg-black/95 p-6 text-white shadow-none">
        <div className="space-y-8 pt-1 pb-2">
          <div className="space-y-1 text-center">
            <p className="text-[15px] font-light tracking-wide text-white/90">{copy.title}</p>
            <p className="text-[13px] font-extralight tracking-wide text-white/55">{copy.description}</p>
          </div>
          <div className="space-y-3">
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
                setError("")
                setSent("")
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  submit()
                }
              }}
              placeholder={copy.placeholder}
              className={fieldClass}
              autoFocus
            />
            {error ? <p className="text-center text-[11px] text-amber-500/90">{error}</p> : null}
            {sent ? <p className="text-center text-[13px] leading-relaxed text-white/55">{sent}</p> : null}
          </div>
          <Button
            type="button"
            onClick={submit}
            disabled={busy}
            className="h-11 w-full rounded-full bg-white/95 text-sm font-normal tracking-widest text-black hover:bg-white disabled:opacity-40"
          >
            {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : copy.button}
          </Button>
          <button
            type="button"
            onClick={onBack}
            className="w-full text-[10px] tracking-[0.2em] uppercase text-white/30 hover:text-white/45"
          >
            {copy.back}
          </button>
        </div>
      </div>
    </div>
  )
}
