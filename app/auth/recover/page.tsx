"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { OnboardingForm } from "@/components/ui/onboarding-form"
import { WalletLanguageProvider, useWalletLanguage } from "@/lib/wallet-language"
import { createPasskey } from "@/lib/turnkey/passkeys"

function RecoverPasskey() {
  const params = useSearchParams()
  const token = params.get("token") ?? ""
  const { language } = useWalletLanguage()
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const es = language !== "en"

  async function createKey() {
    if (!token) {
      setError(es ? "Este enlace no es válido." : "This link is not valid.")
      return
    }
    setBusy(true)
    setError("")
    try {
      const challengeResponse = await fetch("/api/auth/recovery/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
      const challenge = await challengeResponse.json()
      if (!challengeResponse.ok) {
        setError(typeof challenge.error === "string" ? challenge.error : "No pudimos continuar.")
        return
      }
      const credential = await createPasskey(
        {
          challenge: challenge.challenge,
          rpId: challenge.rp.id,
          rp: challenge.rp,
          user: challenge.user,
          timeout: challenge.timeout,
          authenticatorSelection: challenge.authenticatorSelection,
        },
        challenge.user.id,
        challenge.user.displayName,
      )
      if (!credential) {
        setError(es ? "No se creó la llave." : "The passkey was not created.")
        return
      }
      let clientPublicKey65b: string | undefined
      try {
        const { extractPasskeyPublicKey65ForStorage } = await import(
          "@/lib/webauthn/extract-attestation-pubkey"
        )
        clientPublicKey65b = extractPasskeyPublicKey65ForStorage(credential)
      } catch {
        clientPublicKey65b = undefined
      }
      const verifyResponse = await fetch("/api/auth/recovery/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          credential,
          challenge: challenge.challenge,
          clientPublicKey65b,
        }),
      })
      const verified = await verifyResponse.json()
      if (!verifyResponse.ok) {
        setError(typeof verified.error === "string" ? verified.error : "No pudimos guardar la llave.")
        return
      }
      if (typeof verified.username === "string") {
        localStorage.setItem("sozu_username", verified.username)
      }
      setDone(true)
      window.location.assign("/home")
    } catch (cause) {
      if (cause instanceof DOMException && (cause.name === "NotAllowedError" || cause.name === "AbortError")) {
        setError(es ? "Cancelaste la llave." : "You cancelled the passkey.")
        return
      }
      setError(es ? "No pudimos crear la llave." : "We couldn't create the passkey.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-black px-4">
      <OnboardingForm
        imageSrc="/onboarding/slide2.webp"
        title={es ? "Nueva llave" : "New passkey"}
        description={
          es
            ? "Esta llave abre la cuenta que ya estaba vinculada a tu correo."
            : "This passkey opens the account already linked to your email."
        }
        buttonText={busy ? (es ? "Creando…" : "Creating…") : es ? "Crear llave" : "Create passkey"}
        hideInput
        isSubmitting={busy}
        submitDisabled={done || !token}
        onSubmit={() => void createKey()}
        hint={error ? <p className="text-[11px] text-amber-400">{error}</p> : null}
      />
    </div>
  )
}

export default function RecoverAccountPage() {
  return (
    <WalletLanguageProvider>
      <Suspense>
        <RecoverPasskey />
      </Suspense>
    </WalletLanguageProvider>
  )
}
