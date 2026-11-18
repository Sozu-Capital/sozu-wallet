"use client"

/**
 * NFC claim. Black screen, one message, one button.
 * The claim still goes through /api/faucets/[slug]/claim.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { isClientAuthed } from "@/lib/client-auth-gate"
import { FAUCET_TAP_PATH } from "@/lib/faucet/tap-path"
import { getFaucetTexts, readFaucetLanguage } from "@/lib/faucet/texts"
import type { FaucetClaimResponse, FaucetStatusResponse } from "@/lib/faucet/types"

const FAUCET_RETURN_KEY = "sozu_faucet_return"

type Phase =
  | "loading"
  | "unauthenticated"
  | "available"
  | "claiming"
  | "success"
  | "empty"
  | "global_cooldown"
  | "user_cooldown"
  | "inactive"
  | "not_found"
  | "error"

type Action =
  | { kind: "create" | "claim" | "retry"; label: string }
  | { kind: "wallet"; label: string; href: "/home" }

function lines(...parts: Array<string | false | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part)).join("\n\n")
}

export function FaucetClaimExperience({ slug }: { slug: string }) {
  const router = useRouter()
  const t = useMemo(() => getFaucetTexts(readFaucetLanguage()), [])

  const [phase, setPhase] = useState<Phase>("loading")
  const [status, setStatus] = useState<FaucetStatusResponse | null>(null)
  const [nextAvailableAt, setNextAvailableAt] = useState<string | null>(null)
  const [claimedAmount, setClaimedAmount] = useState<number | null>(null)
  const [countdown, setCountdown] = useState("")
  const claimingRef = useRef(false)

  const applyAvailability = useCallback((data: FaucetStatusResponse) => {
    setStatus(data)
    setNextAvailableAt(data.availability.nextAvailableAt ?? null)
    if (data.faucet.status !== "active") {
      setPhase("inactive")
      return
    }
    if (data.availability.available) {
      setPhase("available")
      return
    }
    switch (data.availability.reason) {
      case "empty_today":
      case "insufficient_vault":
      case "pilot_cap":
      case "pilot_contract_required":
        setPhase("empty")
        break
      case "global_cooldown":
        setPhase("global_cooldown")
        break
      case "user_cooldown":
        setPhase("user_cooldown")
        break
      default:
        setPhase("inactive")
    }
  }, [])

  const fetchStatus = useCallback(async () => {
    const res = await fetch(`/api/faucets/${encodeURIComponent(slug)}/status`, {
      cache: "no-store",
    })
    if (res.status === 404) {
      setPhase("not_found")
      return
    }
    if (!res.ok) throw new Error(`status ${res.status}`)
    const data = (await res.json()) as FaucetStatusResponse
    if (!isClientAuthed()) {
      setStatus(data)
      setPhase("unauthenticated")
      return
    }
    applyAvailability(data)
  }, [slug, applyAvailability])

  useEffect(() => {
    try {
      sessionStorage.removeItem(FAUCET_RETURN_KEY)
    } catch {
      /* private browsing */
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchStatus().catch(() => {
      if (!cancelled) setPhase("error")
    })
    return () => {
      cancelled = true
    }
  }, [fetchStatus])

  useEffect(() => {
    if (!nextAvailableAt) return
    const target = new Date(nextAvailableAt).getTime()
    const tick = () => {
      const diff = target - Date.now()
      if (diff <= 0) {
        setCountdown("")
        fetchStatus().catch(() => {})
        return
      }
      const totalMin = Math.ceil(diff / 60_000)
      const h = Math.floor(totalMin / 60)
      const m = totalMin % 60
      setCountdown(
        h > 0 ? `${h} ${t.hoursShort} ${m} ${t.minutesShort}` : `${m} ${t.minutesShort}`,
      )
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [nextAvailableAt, fetchStatus, t])

  const goCreateWallet = useCallback(() => {
    try {
      sessionStorage.setItem(FAUCET_RETURN_KEY, FAUCET_TAP_PATH)
    } catch {
      /* private browsing */
    }
    router.push(`/auth?redirect=${encodeURIComponent(FAUCET_TAP_PATH)}`)
  }, [router])

  const handleClaim = useCallback(async () => {
    if (claimingRef.current) return
    claimingRef.current = true
    setPhase("claiming")
    try {
      const res = await fetch(`/api/faucets/${encodeURIComponent(slug)}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = (await res.json()) as FaucetClaimResponse
      if (data.success) {
        setClaimedAmount(data.amount)
        setPhase("success")
        return
      }
      setNextAvailableAt(data.nextAvailableAt ?? null)
      switch (data.reason) {
        case "empty_today":
        case "insufficient_vault":
        case "pilot_cap":
        case "pilot_contract_required":
          setPhase("empty")
          break
        case "global_cooldown":
          setPhase("global_cooldown")
          break
        case "user_cooldown":
          setPhase("user_cooldown")
          break
        case "inactive":
        case "mainnet_refused":
        case "pilot_slug":
          setPhase("inactive")
          break
        default:
          setPhase("error")
      }
    } catch {
      setPhase("error")
    } finally {
      claimingRef.current = false
    }
  }, [slug])

  const amount = claimedAmount ?? status?.faucet.claimAmount ?? 1
  const wait = countdown || "…"

  const message = (() => {
    switch (phase) {
      case "loading":
        return t.loadingLabel
      case "unauthenticated":
        return lines(t.noWalletTitle, t.noWalletBody)
      case "available":
        return lines(t.availableTitle, t.availableBody)
      case "claiming":
        return lines(t.claimingTitle, t.claimingBody)
      case "success":
        return lines(t.successTitle, t.successAmount(amount), t.successReceived, t.successBody)
      case "empty":
        return lines(t.emptyTitle, t.emptyBody, countdown)
      case "global_cooldown":
        return lines(t.globalCooldownTitle, t.globalCooldownBody, wait)
      case "user_cooldown":
        return lines(t.userCooldownTitle, t.userCooldownBody, wait)
      case "inactive":
        return lines(t.inactiveTitle, t.inactiveBody)
      case "not_found":
        return lines(t.notFoundTitle, t.notFoundBody)
      case "error":
        return lines(t.errorTitle, t.errorBody)
    }
  })()

  const action: Action | null = (() => {
    switch (phase) {
      case "unauthenticated":
        return { kind: "create", label: t.createWalletCta }
      case "available":
        return { kind: "claim", label: t.claimCta }
      case "claiming":
        return { kind: "claim", label: t.claimingTitle }
      case "success":
        return { kind: "wallet", label: t.viewWalletCta, href: "/home" }
      case "error":
        return { kind: "retry", label: t.retryCta }
      default:
        return null
    }
  })()

  const onClick = () => {
    if (!action || action.kind === "wallet" || phase === "claiming") return
    if (action.kind === "create") goCreateWallet()
    else if (action.kind === "claim") void handleClaim()
    else {
      setPhase("loading")
      fetchStatus().catch(() => setPhase("error"))
    }
  }

  const buttonClass =
    "block w-full bg-white py-4 text-center text-base font-medium text-black disabled:opacity-60"

  return (
    <main className="fixed inset-0 flex flex-col bg-black text-white">
      <div className="flex flex-1 items-center justify-center px-6">
        <p className="max-w-sm whitespace-pre-line text-center text-base leading-relaxed">
          {message}
        </p>
      </div>
      {action ? (
        <div className="px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {action.kind === "wallet" ? (
            <Link href={action.href} className={buttonClass}>
              {action.label}
            </Link>
          ) : (
            <button
              type="button"
              className={buttonClass}
              disabled={phase === "claiming"}
              onClick={onClick}
            >
              {action.label}
            </button>
          )}
        </div>
      ) : null}
    </main>
  )
}
