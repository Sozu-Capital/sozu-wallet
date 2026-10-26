"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { HapticProbe } from "@/components/faucet/haptic-probe"
import { isClientAuthed } from "@/lib/client-auth-gate"
import { NFC_USDC_DROP_PATH } from "@/lib/faucet/nfc-usdc-drop"
import {
  fundViaSozuFaucet,
  type SozuFaucetFundResult,
} from "@/lib/stellar/sozu-faucet-fund"

const AUTH_HOP = `/auth?redirect=${encodeURIComponent(NFC_USDC_DROP_PATH)}`

let inflight: Promise<SozuFaucetFundResult> | null = null

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function claimWhenWalletExists(): Promise<SozuFaucetFundResult> {
  let last: SozuFaucetFundResult = {
    ok: false,
    error: "The wallet is not ready yet.",
    reason: "wallet_missing",
  }
  for (let attempt = 0; attempt < 4; attempt += 1) {
    last = await fundViaSozuFaucet()
    if (last.ok || last.reason !== "wallet_missing") return last
    await sleep(1500)
  }
  return last
}

function startClaim(): Promise<SozuFaucetFundResult> {
  if (!inflight) {
    inflight = claimWhenWalletExists().catch((error: unknown) => {
      inflight = null
      throw error
    })
  }
  return inflight
}

export function resetNfcUsdcClaimForRetry() {
  inflight = null
}

export function NfcUsdcDrop() {
  const hapticTest = useSearchParams().get("haptic") === "1"
  if (hapticTest) return <HapticProbe />
  return <NfcUsdcClaim />
}

function NfcUsdcClaim() {
  const router = useRouter()
  const [result, setResult] = useState<SozuFaucetFundResult | null>(null)
  const [failed, setFailed] = useState<string | null>(null)

  useEffect(() => {
    if (!isClientAuthed()) {
      router.replace(AUTH_HOP)
      return
    }
    let active = true
    startClaim()
      .then((next) => {
        if (active) setResult(next)
      })
      .catch((error: unknown) => {
        if (!active) return
        setFailed(error instanceof Error ? error.message : "The claim stopped.")
      })
    return () => {
      active = false
    }
  }, [router])

  const retry = () => {
    setFailed(null)
    setResult(null)
    resetNfcUsdcClaimForRetry()
    startClaim()
      .then(setResult)
      .catch((error: unknown) => {
        setFailed(error instanceof Error ? error.message : "The claim stopped.")
      })
  }

  const error = failed ?? (result && !result.ok ? result.error : null)
  const done = result?.ok === true

  return (
    <main className="fixed inset-0 flex items-center justify-center bg-black px-6 text-center text-white">
      <div className="w-full max-w-sm">
        <p className="text-sm text-white/60">Get 100 testnet USDC</p>
        <p className="mt-4 text-5xl font-semibold tracking-tight">
          {done ? result.amount : 100}
        </p>
        <p className="mt-2 text-sm text-white/60">testnet USDC</p>
        <p className="mt-8 text-sm text-white/80" role="status">
          {error
            ? error
            : done
              ? "It is in this Sozu Wallet."
              : "Claiming from Sozu Faucet"}
        </p>
        {done ? (
          <Link
            href="/home"
            className="mt-8 inline-flex rounded-full bg-white px-6 py-3 text-sm font-medium text-black"
          >
            Open wallet
          </Link>
        ) : null}
        {error ? (
          <button
            type="button"
            className="mt-8 rounded-full border border-white/30 px-6 py-3 text-sm"
            onClick={retry}
          >
            Try again
          </button>
        ) : null}
      </div>
    </main>
  )
}
