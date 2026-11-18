"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { getWalletTexts, type WalletLanguage } from "@/lib/wallet-texts"
import { readOfflineBalanceLocal, type OfflineBalanceRecord } from "@/lib/offline/offline-balance"

const LANGUAGE_KEY = "sozu_app_language:v2"

function readLanguage(): WalletLanguage {
  try {
    const stored = localStorage.getItem(LANGUAGE_KEY)
    if (stored === "en" || stored === "es") return stored
  } catch {
    /* private mode */
  }
  return "es"
}

function shortAccount(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`
}

function formatUsdc(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Opens on top of the lock screen and the signed-in wallet when the phone
 * has no internet. The figure is the last USDC total saved on this device.
 */
export function OfflineBalanceWindow() {
  const [mounted, setMounted] = useState(false)
  const [offline, setOffline] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [record, setRecord] = useState<OfflineBalanceRecord | null>(null)
  const [language, setLanguage] = useState<WalletLanguage>("es")

  useEffect(() => {
    setMounted(true)
    setLanguage(readLanguage())

    const sync = () => {
      const isOffline = navigator.onLine === false
      setOffline(isOffline)
      if (!isOffline) setDismissed(false)
      if (isOffline) setRecord(readOfflineBalanceLocal())
    }

    sync()
    window.addEventListener("offline", sync)
    window.addEventListener("online", sync)
    return () => {
      window.removeEventListener("offline", sync)
      window.removeEventListener("online", sync)
    }
  }, [])

  if (!mounted || !offline || dismissed) return null

  const t = getWalletTexts(language)
  const sheet = (
    <div
      className="fixed inset-0 z-[10050] flex items-end justify-center bg-black/80 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:items-center sm:pb-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="offline-balance-title"
    >
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-zinc-950/95 p-6 text-white shadow-[0_8px_32px_rgba(0,0,0,0.45)]">
        <div className="mb-6 flex items-start justify-between gap-3">
          <p id="offline-balance-title" className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/45">
            {t.offlineWindowTitle}
          </p>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label={t.close}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-white/40 transition hover:bg-white/15 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">{t.offlineWindowAvailable}</p>
        {record ? (
          <>
            <p className="mt-2 text-5xl font-medium tracking-tight tabular-nums">{formatUsdc(record.usdc)}</p>
            <p className="mt-1 text-sm text-white/45">USDC</p>
            <p className="mt-4 font-mono text-sm text-white/70">{shortAccount(record.wallet)}</p>
            <p className="mt-4 text-sm leading-relaxed text-white/55">{t.offlineWindowSaved}</p>
          </>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-white/70">{t.offlineWindowEmpty}</p>
        )}
      </div>
    </div>
  )

  return createPortal(sheet, document.body)
}
