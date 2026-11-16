"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Check, X } from "lucide-react"
import { useWalletLanguage } from "@/lib/wallet-language"

const STORAGE_KEY = "p2pWithdrawRequests:v1"

type P2pWithdrawRequest = {
  id: string
  amount: string
  holderName: string
  bank: string
  account: string
  createdAt: string
}

type P2pWithdrawSheetProps = {
  open: boolean
  onClose: () => void
}

function blockShellSwipe(event: React.SyntheticEvent) {
  event.stopPropagation()
}

function saveRequest(request: P2pWithdrawRequest) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const existing = raw ? (JSON.parse(raw) as P2pWithdrawRequest[]) : []
    const next = Array.isArray(existing) ? [request, ...existing].slice(0, 20) : [request]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* private mode or quota */
  }
}

export function P2pWithdrawSheet({ open, onClose }: P2pWithdrawSheetProps) {
  const { t } = useWalletLanguage()
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [holderName, setHolderName] = useState("")
  const [bank, setBank] = useState("")
  const [account, setAccount] = useState("")
  const [amount, setAmount] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) {
      setVisible(false)
      return
    }
    setHolderName("")
    setBank("")
    setAccount("")
    setAmount("")
    setError(null)
    setCreated(false)
    const frame = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [open])

  if (!open || !mounted) return null

  const submit = () => {
    const parsed = Number(amount.replace(",", "."))
    if (!holderName.trim() || !bank.trim() || !account.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      setError(t.p2pWithdrawInvalid)
      return
    }
    saveRequest({
      id: crypto.randomUUID(),
      amount: parsed.toFixed(2),
      holderName: holderName.trim(),
      bank: bank.trim(),
      account: account.trim(),
      createdAt: new Date().toISOString(),
    })
    setError(null)
    setCreated(true)
  }

  const fieldClass =
    "w-full rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/30"

  const sheet = (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:pb-4"
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 0.3s ease",
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
      }}
      onClick={onClose}
      onTouchStart={blockShellSwipe}
      onTouchMove={blockShellSwipe}
      onTouchEnd={blockShellSwipe}
    >
      <div
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-zinc-950/95 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
        onClick={(event) => event.stopPropagation()}
        style={{
          transform: visible ? "translateY(0)" : "translateY(16px)",
          transition: "transform 0.35s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/45">
            {t.p2pWithdrawTitle}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-white/40 transition hover:bg-white/15 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {created ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
              <Check className="h-5 w-5" />
            </span>
            <p className="text-sm leading-snug text-white/80">{t.p2pWithdrawSuccess}</p>
          </div>
        ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              submit()
            }}
          >
            <p className="text-[12px] leading-snug text-white/45">{t.p2pWithdrawBody}</p>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-white/35">{t.p2pWithdrawAmount}</span>
              <input
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                className={fieldClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-white/35">{t.p2pWithdrawName}</span>
              <input
                value={holderName}
                onChange={(event) => setHolderName(event.target.value)}
                placeholder={t.p2pWithdrawNamePlaceholder}
                autoComplete="name"
                className={fieldClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-white/35">{t.p2pWithdrawBank}</span>
              <input
                value={bank}
                onChange={(event) => setBank(event.target.value)}
                placeholder={t.p2pWithdrawBankPlaceholder}
                autoComplete="organization"
                className={fieldClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-white/35">{t.p2pWithdrawAccount}</span>
              <input
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                placeholder={t.p2pWithdrawAccountPlaceholder}
                autoComplete="off"
                className={fieldClass}
              />
            </label>
            {error ? <p className="text-[11px] text-rose-300">{error}</p> : null}
            <button
              type="submit"
              className="mt-1 w-full rounded-full bg-white py-3.5 text-[13px] font-semibold text-black transition hover:bg-white/90 active:scale-[0.98]"
            >
              {t.p2pWithdrawSubmit}
            </button>
          </form>
        )}
      </div>
    </div>
  )

  return createPortal(sheet, document.body)
}
