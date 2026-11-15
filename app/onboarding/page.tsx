"use client"

import { useEffect, useState } from "react"
import { WalletActivationOnboarding } from "@/components/wallet/wallet-activation-onboarding"
import { WalletLanguageProvider, useWalletLanguage } from "@/lib/wallet-language"

function Screens() {
  const { setLanguage } = useWalletLanguage()
  const [open, setOpen] = useState(true)
  const [activationSettled, setActivationSettled] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const lang = params.get("lang")
    if (lang === "en" || lang === "es") setLanguage(lang)
    if (params.get("wait") !== "1") return
    setActivationSettled(false)
    const timer = window.setTimeout(() => setActivationSettled(true), 8000)
    return () => window.clearTimeout(timer)
  }, [setLanguage, open])

  if (!open) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-black">
        <button
          type="button"
          className="h-14 rounded-full bg-white px-8 text-base font-semibold text-black"
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
      activationSettled={activationSettled}
      onExitComplete={() => setOpen(false)}
    />
  )
}

/** Public copy QA for the activation screens. Middleware already allows /onboarding. */
export default function OnboardingPreviewPage() {
  return (
    <WalletLanguageProvider>
      <Screens />
    </WalletLanguageProvider>
  )
}
