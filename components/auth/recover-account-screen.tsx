"use client"

import { useState } from "react"
import { OnboardingForm } from "@/components/ui/onboarding-form"
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

export function RecoverAccountScreen({ onBack }: { onBack: () => void }) {
  const { language } = useWalletLanguage()
  const copy = COPY[language] ?? COPY.es
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [sent, setSent] = useState("")
  const [busy, setBusy] = useState(false)

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 backdrop-blur-md">
      <OnboardingForm
        imageSrc="/onboarding/slide2.webp"
        title={copy.title}
        description={copy.description}
        inputPlaceholder={copy.placeholder}
        inputType="email"
        inputMode="email"
        autoComplete="email"
        buttonText={busy ? copy.sending : copy.button}
        value={email}
        onValueChange={(next) => {
          setEmail(next)
          setError("")
          setSent("")
        }}
        isSubmitting={busy}
        onSubmit={(value) => {
          const normalized = normalizeRecoveryEmail(value)
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
        }}
        hint={
          error ? (
            <p className="text-[11px] text-amber-400">{error}</p>
          ) : sent ? (
            <p className="text-[13px] leading-relaxed text-muted-foreground">{sent}</p>
          ) : null
        }
        footer={
          <button
            type="button"
            onClick={onBack}
            className="w-full text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
          >
            {copy.back}
          </button>
        }
      />
    </div>
  )
}
