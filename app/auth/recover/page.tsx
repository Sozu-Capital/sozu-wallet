"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { Button } from "@/components/ui/button"
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
      <div className="w-full max-w-sm rounded-lg border border-white/10 bg-black/95 p-6 text-white">
        <div className="space-y-8 pt-1 pb-2">
          <div className="space-y-1 text-center">
            <p className="text-[15px] font-light tracking-wide text-white/90">
              {es ? "Nueva llave" : "New passkey"}
            </p>
            <p className="text-[13px] font-extralight tracking-wide text-white/55">
              {es
                ? "Esta llave abre la cuenta que ya estaba vinculada a tu correo."
                : "This passkey opens the account already linked to your email."}
            </p>
          </div>
          {error ? <p className="text-center text-[11px] text-amber-500/90">{error}</p> : null}
          <Button
            type="button"
            onClick={() => void createKey()}
            disabled={busy || done || !token}
            className="h-11 w-full rounded-full bg-white/95 text-sm font-normal tracking-widest text-black hover:bg-white disabled:opacity-40"
          >
            {busy ? (es ? "Creando…" : "Creating…") : es ? "Crear llave" : "Create passkey"}
          </Button>
        </div>
      </div>
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
