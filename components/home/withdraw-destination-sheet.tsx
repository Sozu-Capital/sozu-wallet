"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { useWalletLanguage } from "@/lib/wallet-language"

type WithdrawDestinationSheetProps = {
  open: boolean
  onClose: () => void
  onSozuWallet: () => void
  onBank: () => void
}

function blockShellSwipe(event: React.SyntheticEvent) {
  event.stopPropagation()
}

export function WithdrawDestinationSheet({
  open,
  onClose,
  onSozuWallet,
  onBank,
}: WithdrawDestinationSheetProps) {
  const { t } = useWalletLanguage()
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) {
      setVisible(false)
      return
    }
    const frame = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [open])

  if (!open || !mounted) return null

  const sheet = (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:items-center sm:pb-4"
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
          transform: visible ? "translateY(0)" : "translateY(12px)",
          transition: "transform 0.35s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/45">
            {t.withdrawDestinationTitle}
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
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onSozuWallet}
            className="rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3.5 text-left transition hover:bg-white/[0.1] active:scale-[0.99]"
          >
            <span className="block text-sm font-medium text-white">{t.withdrawToSozuWallet}</span>
            <span className="mt-0.5 block text-[11px] leading-snug text-white/45">
              {t.withdrawToSozuWalletHint}
            </span>
          </button>
          <button
            type="button"
            onClick={onBank}
            className="rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3.5 text-left transition hover:bg-white/[0.1] active:scale-[0.99]"
          >
            <span className="block text-sm font-medium text-white">{t.withdrawToBank}</span>
            <span className="mt-0.5 block text-[11px] leading-snug text-white/45">
              {t.withdrawToBankHint}
            </span>
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(sheet, document.body)
}
