"use client"

import { useEffect, useState } from "react"
import { ItemPageView } from "@/components/merch/item-page-view"
import { isClientAuthed } from "@/lib/client-auth-gate"
import type { MerchNetwork } from "@/lib/merch/catalog"
import { decideBuy, ordinaryUsdcFromBalance, parsePriceUsdc } from "@/lib/merch/buy-gate"
import { buildItemPageModel } from "@/lib/merch/item-page"
import type { MerchLanguage } from "@/lib/merch/copy"
import { isPilotMainnet } from "@/lib/pilot/pilot-mainnet"
import type { PreparedPasskeyBuild } from "@/lib/stellar/smartAccounts/sign-prepared-build"

const LANGUAGE_KEY = "sozu_app_language:v2"

async function signMerchBuild(build: PreparedPasskeyBuild): Promise<string> {
  if (build.signMethod === "smart_g_signer") {
    const { signSorobanUsdcWithGSigner } = await import("@/lib/stellar/smartAccounts/signSorobanTransferG")
    const { getStellarConfig } = await import("@/lib/turnkey/config")
    const { Networks } = await import("@stellar/stellar-sdk")
    const { getCurrentCredentialId } = await import("@/lib/storage/key-utils")
    const { getUserId } = await import("@/lib/wallet-utils")
    const userId = getUserId()
    const credentialId = build.ozCredentialId ?? (await getCurrentCredentialId())
    const signerPublicKey = build.signerPublicKey
    if (!userId || !credentialId || !signerPublicKey) throw new Error("sign_failed")
    const network = getStellarConfig().network
    return signSorobanUsdcWithGSigner({
      unsignedXdr: build.unsignedXdr,
      signerPublicKey,
      credentialId,
      userId,
      networkPassphrase: network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
    })
  }
  const { signPreparedBuildWithPasskey } = await import("@/lib/stellar/smartAccounts/sign-prepared-build")
  return signPreparedBuildWithPasskey(build)
}

function readLanguage(): MerchLanguage {
  try {
    const stored = localStorage.getItem(LANGUAGE_KEY)
    return stored === "en" ? "en" : "es"
  } catch {
    return "es"
  }
}

export function ItemPage({
  slug,
  name,
  imagePath,
  priceUsdc,
  network,
  remaining,
}: {
  slug: string
  name: string
  imagePath: string
  priceUsdc: string | null
  network: MerchNetwork
  remaining: number | null
}) {
  const [language, setLanguage] = useState<MerchLanguage>("es")
  const [hasSession, setHasSession] = useState(false)
  const [ordinaryUsdc, setOrdinaryUsdc] = useState<number | null>(null)
  const [balanceKnown, setBalanceKnown] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setLanguage(readLanguage())
  }, [])

  useEffect(() => {
    const authed = isClientAuthed()
    setHasSession(authed)
    if (!authed) {
      setBalanceKnown(false)
      setOrdinaryUsdc(null)
      return
    }

    let cancelled = false
    void fetch("/api/wallet/stellar/balance", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { displayWalletUsdc?: unknown } | null) => {
        if (cancelled) return
        const ordinary = payload ? ordinaryUsdcFromBalance(payload) : null
        setOrdinaryUsdc(ordinary)
        setBalanceKnown(ordinary != null)
      })
      .catch(() => {
        if (!cancelled) setBalanceKnown(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const model = buildItemPageModel({
    item: { name, imagePath, priceUsdc, network },
    language,
    remaining,
  })

  async function confirmBuy() {
    if (submitting) return
    setSubmitting(true)
    setNotice(null)
    const storageKey = `merch-attempt:${slug}`
    let attemptId = ""
    try {
      attemptId = sessionStorage.getItem(storageKey) ?? ""
    } catch {
      attemptId = ""
    }
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(attemptId)) {
      attemptId = crypto.randomUUID()
      try {
        sessionStorage.setItem(storageKey, attemptId)
      } catch {
        // private browsing: the attempt id still rides on this confirm
      }
    }

    const post = (signedEnvelopeXdr?: string) =>
      fetch("/api/merch/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, attemptId, signedEnvelopeXdr }),
      })

    try {
      const response = await post()
      const data = (await response.json().catch(() => ({}))) as {
        code?: string
        build?: PreparedPasskeyBuild
        order?: { status?: string; paymentHash?: string | null; failureReason?: string | null }
      }
      if (data.code === "merch_address_unrecorded") {
        setNotice(
          language === "en"
            ? "The merch address is not recorded yet."
            : "La dirección de pago todavía no está registrada.",
        )
        return
      }
      if (data.code === "price_unrecorded") {
        setNotice(
          language === "en" ? "The price is not recorded yet." : "El precio todavía no está registrado.",
        )
        return
      }
      if (data.build && data.order?.status === "awaiting_payment") {
        const signedEnvelopeXdr = await signMerchBuild(data.build)
        const confirmed = await post(signedEnvelopeXdr)
        const paid = (await confirmed.json().catch(() => ({}))) as typeof data
        if (paid.order?.status === "paid" && paid.order.paymentHash) {
          setNotice(paid.order.paymentHash)
          return
        }
        if (paid.order?.status === "failed") {
          try {
            sessionStorage.removeItem(storageKey)
          } catch {
            // ignore
          }
          setNotice(paid.order.failureReason ?? (language === "en" ? "Payment failed." : "El pago falló."))
          return
        }
        setNotice(language === "en" ? "Could not start the payment." : "No se pudo iniciar el pago.")
        return
      }
      if (data.order?.status === "paid" && data.order.paymentHash) {
        setNotice(data.order.paymentHash)
        return
      }
      if (data.order?.status === "failed") {
        try {
          sessionStorage.removeItem(storageKey)
        } catch {
          // ignore
        }
        setNotice(data.order.failureReason ?? (language === "en" ? "Payment failed." : "El pago falló."))
        return
      }
      if (!response.ok) {
        setNotice(language === "en" ? "Could not start the payment." : "No se pudo iniciar el pago.")
      }
    } catch {
      setNotice(language === "en" ? "Could not start the payment." : "No se pudo iniciar el pago.")
    } finally {
      setSubmitting(false)
    }
  }

  const gate = decideBuy({
    hasSession,
    balanceKnown,
    slug,
    language,
    itemNetwork: network,
    walletNetwork: isPilotMainnet() ? "mainnet" : "testnet",
    priceUsdc: parsePriceUsdc(priceUsdc),
    ordinaryUsdc,
  })

  return (
    <ItemPageView
      model={model}
      gate={gate}
      notice={notice}
      onBuy={gate.kind === "allow" && !model.soldOut ? () => void confirmBuy() : undefined}
    />
  )
}
