"use client"

import { useEffect, useState } from "react"
import { WalletActivationOnboarding } from "@/components/wallet/wallet-activation-onboarding"
import { WalletLanguageProvider, useWalletLanguage } from "@/lib/wallet-language"

function Screen() {
  const { setLanguage } = useWalletLanguage()
  const [open, setOpen] = useState(true)

  useEffect(() => {
    const lang = new URLSearchParams(window.location.search).get("lang")
    if (lang === "en" || lang === "es") setLanguage(lang)
  }, [setLanguage])

  if (!open) {
    return (
      <div className="sozu-night flex min-h-dvh items-center justify-center">
        <button
          type="button"
          className="sozu-paper-button h-14 rounded-2xl px-8 text-base font-medium"
          onClick={() => setOpen(true)}
        >
          Ver de nuevo
        </button>
      </div>
    )
  }

  return (
    <WalletActivationOnboarding
      open
      activationSettled
      intent="signup"
      onExitComplete={() => setOpen(false)}
      onCreateAccount={() => setOpen(false)}
    />
  )
}

/** One onboarding flow: SozuTag, then the welcome slides. */
export default function OnboardingPreviewPage() {
  return (
    <WalletLanguageProvider>
      <Screen />
    </WalletLanguageProvider>
  )
}
