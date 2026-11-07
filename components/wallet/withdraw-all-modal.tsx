"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Loader2, ShieldCheck, TriangleAlert, X } from "lucide-react"
import { useWalletLanguage } from "@/lib/wallet-language"
import { useWithdrawAll } from "@/hooks/use-withdraw-all"
import type { PaymentReceipt } from "@/lib/payment/payment-receipt"
import { groupAddressForDisplay } from "@/lib/payment/address-display"
import { getWithdrawTexts, withdrawErrorText, WITHDRAW_GUIDE_PATH } from "@/lib/withdraw/withdraw-texts"

type WithdrawAllModalProps = {
  open: boolean
  onClose: () => void
  onSuccess: (receipt: PaymentReceipt) => void
}

/** Block horizontal swipes from reaching the app shell panel carousel — same pattern as offramp-modal.tsx. */
function blockShellSwipe(e: React.SyntheticEvent) {
  e.stopPropagation()
}

export function WithdrawAllModal({ open, onClose, onSuccess }: WithdrawAllModalProps) {
  const { language } = useWalletLanguage()
  const t = getWithdrawTexts(language)
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const w = useWithdrawAll(onSuccess)
  const { reset } = w
  const busy = w.phase === "previewing" || w.phase === "building" || w.phase === "signing" || w.phase === "submitting"

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) {
      setVisible(false)
      return
    }
    reset()
    requestAnimationFrame(() => setVisible(true))
  }, [open, reset])

  if (!open || !mounted) return null

  const errorText = withdrawErrorText(w.errorCode, t)
  const close = () => {
    if (busy) return
    onClose()
  }

  const busyLabel =
    w.phase === "signing" ? t.signing : w.phase === "submitting" ? t.submitting : t.preparing

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 overflow-y-auto px-6 py-8 sm:px-8 overscroll-y-contain overscroll-none"
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 0.35s ease",
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
      }}
      onClick={close}
      onTouchStart={blockShellSwipe}
      onTouchMove={blockShellSwipe}
      onTouchEnd={blockShellSwipe}
      onMouseDown={blockShellSwipe}
    >
      <button
        type="button"
        onClick={close}
        aria-label={t.close}
        className="absolute right-5 top-[max(1.25rem,env(safe-area-inset-top))] z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-white/40 transition hover:bg-white/15 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>

      <div
        className="relative z-10 flex w-full max-w-sm flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: visible ? "translateY(0)" : "translateY(12px)",
          transition: "transform 0.4s cubic-bezier(0.4,0,0.2,1)",
          touchAction: "manipulation",
        }}
      >
        <p className="text-[9px] font-light uppercase tracking-[0.3em] text-white/35">{t.title}</p>

        {w.phase === "form" || w.phase === "previewing" ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              void w.requestPreview()
            }}
          >
            <p className="text-sm leading-snug text-white/70">{t.intro}</p>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-white/40" htmlFor="withdraw-address">
                {t.addressLabel}
              </label>
              <textarea
                id="withdraw-address"
                rows={3}
                value={w.address}
                onChange={(e) => w.setAddress(e.target.value)}
                placeholder={t.addressPlaceholder}
                disabled={busy}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 font-mono text-[13px] leading-relaxed text-white placeholder-white/25 outline-none transition break-all focus:border-white/25 disabled:opacity-50"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-white/40" htmlFor="withdraw-memo">
                {t.memoLabel}
              </label>
              <input
                id="withdraw-memo"
                type="text"
                inputMode="numeric"
                value={w.memo}
                onChange={(e) => w.setMemo(e.target.value)}
                placeholder={t.memoPlaceholder}
                disabled={busy}
                autoComplete="off"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 font-mono text-sm text-white placeholder-white/25 outline-none transition focus:border-white/25 disabled:opacity-50"
              />
              <p className="text-[10px] leading-snug text-white/40">{t.memoHint}</p>
            </div>

            {errorText ? (
              <div className="rounded-2xl border border-rose-500/35 bg-rose-950/40 px-4 py-2.5 text-xs leading-snug text-rose-200/90">
                {errorText}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={busy || !w.address.trim()}
              className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/20 px-4 py-3 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {w.phase === "previewing" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {w.phase === "previewing" ? t.reviewing : t.review}
            </button>
            <a
              href={WITHDRAW_GUIDE_PATH}
              target="_blank"
              rel="noopener"
              className="text-center text-xs text-white/50 underline underline-offset-4 hover:text-white/80"
            >
              {t.guideLink}
            </a>
          </form>
        ) : w.preview && w.phase !== "error" ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-white/90">{t.confirmTitle}</p>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <p className="text-[9px] uppercase tracking-wider text-white/35">{t.youSend}</p>
              <p className="mt-1 font-mono text-xl tabular-nums text-white">
                {w.preview.amountDisplay} <span className="text-sm text-white/60">{w.preview.assetCode}</span>
              </p>
              <p className="mt-0.5 text-[10px] text-white/40">{t.allBalance}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <p className="text-[9px] uppercase tracking-wider text-white/35">{t.toAddress}</p>
              <p className="mt-1 break-all font-mono text-[13px] leading-relaxed text-white" data-testid="withdraw-full-address">
                {groupAddressForDisplay(w.preview.address)}
              </p>
              {w.preview.memoId ? (
                <p className="mt-2 font-mono text-[13px] text-white">
                  <span className="text-[9px] uppercase tracking-wider text-white/35">{t.memoRow} </span>
                  {w.preview.memoId}
                </p>
              ) : null}
              <p className="mt-2 text-[10px] leading-snug text-white/40">{t.compareHint}</p>
            </div>

            {w.preview.kind === "contract" ? (
              <p className="text-[11px] leading-snug text-white/55">{t.contractNote}</p>
            ) : (
              <p className="flex items-start gap-1.5 text-[11px] leading-snug text-emerald-200/80">
                <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" />
                {t.destinationOk}
              </p>
            )}

            {w.preview.memoId ? (
              <div className="flex items-start gap-2 rounded-2xl border border-amber-400/30 bg-amber-500/[0.08] px-3 py-2.5 text-[11px] leading-snug text-amber-100/90">
                <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
                {t.exchangeWarning}
              </div>
            ) : null}

            {errorText ? (
              <div className="rounded-2xl border border-amber-400/30 bg-amber-500/[0.08] px-4 py-2.5 text-xs text-amber-100/90">
                {errorText}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void w.confirm()}
              disabled={busy}
              className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/20 px-4 py-3 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {busy ? busyLabel : t.confirm}
            </button>
            <button
              type="button"
              onClick={w.backToForm}
              disabled={busy}
              className="text-xs text-white/50 hover:text-white/80 disabled:opacity-40"
            >
              {t.back}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl border border-rose-500/35 bg-rose-950/40 px-4 py-3 text-sm leading-snug text-rose-200/90">
              {errorText ?? t.errors.unknown}
            </div>
            <button
              type="button"
              onClick={w.backToForm}
              className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 text-xs font-medium text-white/90 transition hover:bg-white/[0.1]"
            >
              {t.retry}
            </button>
            <a
              href={WITHDRAW_GUIDE_PATH}
              target="_blank"
              rel="noopener"
              className="text-center text-xs text-white/50 underline underline-offset-4 hover:text-white/80"
            >
              {t.guideLink}
            </a>
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
