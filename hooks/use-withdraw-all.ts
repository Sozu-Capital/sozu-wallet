"use client"

/**
 * Withdraw-all: preview (exact balance + destination checks) -> confirm -> build -> passkey sign ->
 * idempotent submit. One idempotency key per confirm screen; a new attempt after a failure gets a new key.
 *
 * Phases: form -> previewing -> confirm -> building -> signing -> submitting -> (onSuccess)
 *                                                                          \-> error
 */

import { useCallback, useRef, useState } from "react"
import { formatAddress, getUserId } from "@/lib/wallet-utils"
import { getSenderDisplayLabel, type PaymentReceipt } from "@/lib/payment/payment-receipt"
import type { PreparedPasskeyBuild } from "@/lib/stellar/smartAccounts/sign-prepared-build"

export type WithdrawPhase = "form" | "previewing" | "confirm" | "building" | "signing" | "submitting" | "error"

export type WithdrawPreview = {
  address: string
  kind: "classic" | "muxed" | "contract"
  baseAddress: string
  transferTo: string
  memoId: string | null
  amountMinor: string
  amountDisplay: string
  assetCode: string
  network: "testnet" | "mainnet"
}

const IN_PROGRESS_POLL_MS = 2000
const IN_PROGRESS_MAX_POLLS = 30

function newIdempotencyKey(): string {
  return crypto.randomUUID()
}

async function postJson(path: string, body: unknown): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { status: res.status, data }
}

function codeOf(data: Record<string, unknown>): string {
  return typeof data.code === "string" ? data.code : "unknown"
}

export function useWithdrawAll(onSuccess?: (receipt: PaymentReceipt) => void) {
  const [phase, setPhase] = useState<WithdrawPhase>("form")
  const [address, setAddress] = useState("")
  const [memo, setMemo] = useState("")
  const [preview, setPreview] = useState<WithdrawPreview | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const idempotencyKeyRef = useRef<string | null>(null)
  const busyRef = useRef(false)

  const reset = useCallback(() => {
    setPhase("form")
    setAddress("")
    setMemo("")
    setPreview(null)
    setErrorCode(null)
    idempotencyKeyRef.current = null
    busyRef.current = false
  }, [])

  const backToForm = useCallback(() => {
    setPhase("form")
    setPreview(null)
    setErrorCode(null)
    idempotencyKeyRef.current = null
  }, [])

  const requestPreview = useCallback(async () => {
    if (busyRef.current) return
    busyRef.current = true
    setErrorCode(null)
    setPhase("previewing")
    try {
      const { status, data } = await postJson("/api/wallet/withdraw/preview", { address, memo })
      if (status !== 200) {
        setErrorCode(codeOf(data))
        setPhase("form")
        return
      }
      setPreview(data as unknown as WithdrawPreview)
      idempotencyKeyRef.current = newIdempotencyKey()
      setPhase("confirm")
    } catch {
      setErrorCode("destination_check_failed")
      setPhase("form")
    } finally {
      busyRef.current = false
    }
  }, [address, memo])

  const confirm = useCallback(async () => {
    if (busyRef.current || !preview) return
    busyRef.current = true
    const idempotencyKey = idempotencyKeyRef.current ?? newIdempotencyKey()
    idempotencyKeyRef.current = idempotencyKey
    setErrorCode(null)

    const fail = (code: string) => {
      if (code !== "submit_pending") idempotencyKeyRef.current = null
      setErrorCode(code)
      setPhase("error")
    }

    try {
      setPhase("building")
      const built = await postJson("/api/wallet/withdraw/build", {
        address,
        memo,
        amountMinor: preview.amountMinor,
      })
      if (built.status === 409 && built.data.code === "balance_changed") {
        setPreview(built.data as unknown as WithdrawPreview)
        idempotencyKeyRef.current = newIdempotencyKey()
        setErrorCode("balance_changed")
        setPhase("confirm")
        return
      }
      const build = built.data.build as PreparedPasskeyBuild | undefined
      if (built.status !== 200 || !build) return fail(codeOf(built.data))

      setPhase("signing")
      let signedEnvelopeXdr: string
      try {
        if (build.signMethod === "smart_g_signer") {
          const { signSorobanUsdcWithGSigner } = await import("@/lib/stellar/smartAccounts/signSorobanTransferG")
          const { getStellarConfig } = await import("@/lib/turnkey/config")
          const { Networks } = await import("@stellar/stellar-sdk")
          const { getCurrentCredentialId } = await import("@/lib/storage/key-utils")
          const userId = getUserId()
          const credentialId = build.ozCredentialId ?? (await getCurrentCredentialId())
          const signerPublicKey = build.signerPublicKey
          if (!userId || !credentialId || !signerPublicKey) return fail("sign_failed")
          const network = getStellarConfig().network
          signedEnvelopeXdr = await signSorobanUsdcWithGSigner({
            unsignedXdr: build.unsignedXdr,
            signerPublicKey,
            credentialId,
            userId,
            networkPassphrase: network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
          })
        } else {
          const { signPreparedBuildWithPasskey } = await import("@/lib/stellar/smartAccounts/sign-prepared-build")
          signedEnvelopeXdr = await signPreparedBuildWithPasskey(build)
        }
      } catch (err) {
        console.warn("[withdraw-all] passkey signing failed:", err)
        return fail("sign_failed")
      }

      setPhase("submitting")
      const submitBody = { signedEnvelopeXdr, idempotencyKey, address, memo, amountMinor: preview.amountMinor }
      let submitted = await postJson("/api/wallet/withdraw/submit", submitBody)
      const stillRunning = (status: number, code: unknown) =>
        (status === 409 && code === "IDEMPOTENCY_IN_PROGRESS") || (status === 502 && code === "submit_pending")
      for (let i = 0; stillRunning(submitted.status, submitted.data.code) && i < IN_PROGRESS_MAX_POLLS; i++) {
        await new Promise((r) => setTimeout(r, IN_PROGRESS_POLL_MS))
        submitted = await postJson("/api/wallet/withdraw/submit", submitBody)
      }
      const hash = submitted.data.transactionHash
      if (submitted.status !== 200 || typeof hash !== "string" || !hash) {
        if (submitted.status === 409) return fail("submit_pending")
        return fail(codeOf(submitted.data))
      }

      onSuccess?.({
        amount: Number(preview.amountDisplay),
        currency: preview.assetCode,
        fromLabel: getSenderDisplayLabel(),
        toLabel: formatAddress(preview.address, 6, 6),
        toAddress: preview.address,
        transactionHash: hash,
        network: preview.network,
        memo: preview.memoId,
        completedAt: new Date().toISOString(),
      })
      reset()
    } catch (err) {
      console.error("[withdraw-all] error:", err)
      fail("unknown")
    } finally {
      busyRef.current = false
    }
  }, [address, memo, preview, onSuccess, reset])

  return {
    phase,
    address,
    memo,
    preview,
    errorCode,
    setAddress,
    setMemo,
    requestPreview,
    confirm,
    backToForm,
    reset,
  }
}
