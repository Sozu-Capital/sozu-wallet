"use client"

import { useState } from "react"
import { AccountAccessCard, accountButtonClass, accountFieldClass } from "@/components/auth/account-access-card"
import { RECOVERY_START_MESSAGE, normalizeRecoveryEmail } from "@/lib/auth/recovery-email"
import { useWalletLanguage } from "@/lib/wallet-language"

const COPY = {
  es: {
    title: "Recuperar mi cuenta",
    placeholder: "Correo",
    button: "Enviar enlace",
    invalid: "Escribí un correo válido.",
    sending: "Enviando…",
    back: "Volver",
    failed: "No pudimos enviar el correo. Intentá de nuevo.",
  },
  en: {
    title: "Recover my account",
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
    <AccountAccessCard
      title={copy.title}
      footer={
        language === "en"
          ? "If an account uses this email, you'll get a link to create a new passkey."
          : "Si hay una cuenta con este correo, te llega un enlace para crear una llave nueva."
      }
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={async (event) => {
          event.preventDefault()
          const normalized = normalizeRecoveryEmail(email)
          if (!normalized) {
            setError(copy.invalid)
            return
          }
          setBusy(true)
          setError("")
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
        }}
      >
        <input
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          placeholder={copy.placeholder}
          onChange={(event) => {
            setEmail(event.target.value)
            setError("")
            setSent("")
          }}
          className={accountFieldClass}
          aria-label={copy.placeholder}
        />
        {error ? <p className="px-1 text-sm text-red-300">{error}</p> : null}
        {sent ? <p className="px-1 text-sm leading-relaxed text-white/70">{sent}</p> : null}
        <button type="submit" disabled={busy} className={accountButtonClass}>
          {busy ? copy.sending : copy.button}
        </button>
        <button type="button" onClick={onBack} className="h-10 text-sm text-white/45 hover:text-white/70">
          {copy.back}
        </button>
      </form>
    </AccountAccessCard>
  )
}
