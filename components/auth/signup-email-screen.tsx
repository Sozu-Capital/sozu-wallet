"use client"

import { useState } from "react"
import { AccountAccessCard, accountButtonClass, accountFieldClass } from "@/components/auth/account-access-card"
import { normalizeRecoveryEmail } from "@/lib/auth/recovery-email"
import { useWalletLanguage } from "@/lib/wallet-language"

const COPY = {
  es: {
    title: "Sozu",
    placeholder: "Correo",
    button: "Crear cuenta",
    footer: "Este correo se usa para recuperar tu cuenta si perdés el dispositivo.",
    invalid: "Escribí un correo válido.",
    back: "Volver",
  },
  en: {
    title: "Sozu",
    placeholder: "Email",
    button: "Create account",
    footer: "This email is used to recover your account if you lose this device.",
    invalid: "Enter a valid email.",
    back: "Back",
  },
} as const

export function SignupEmailScreen({
  onContinue,
  onBack,
}: {
  onContinue: (email: string) => void
  onBack: () => void
}) {
  const { language } = useWalletLanguage()
  const copy = COPY[language] ?? COPY.es
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")

  return (
    <AccountAccessCard title={copy.title} footer={copy.footer}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          const normalized = normalizeRecoveryEmail(email)
          if (!normalized) {
            setError(copy.invalid)
            return
          }
          onContinue(normalized)
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
          }}
          className={accountFieldClass}
          aria-label={copy.placeholder}
        />
        {error ? <p className="px-1 text-sm text-red-300">{error}</p> : null}
        <button type="submit" className={accountButtonClass}>
          {copy.button}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="h-10 text-sm text-white/45 hover:text-white/70"
        >
          {copy.back}
        </button>
      </form>
    </AccountAccessCard>
  )
}
