"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { MessageSquare, UserPlus, X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useWalletLanguage } from "@/lib/wallet-language"

type SheetKind = "dollars" | "feedback" | null

const tileClass = cn(
  "border border-white/15 bg-white/[0.08] text-left text-white",
  "shadow-[0_10px_28px_rgba(0,0,0,0.28)]",
  "transition-colors hover:bg-white/[0.14] active:scale-[0.99]",
)

function blockShellSwipe(event: React.SyntheticEvent) {
  event.stopPropagation()
}

async function shareOrCopy(text: string): Promise<"shared" | "copied" | "failed"> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ text })
      return "shared"
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "failed"
    }
  }
  try {
    await navigator.clipboard.writeText(text)
    return "copied"
  } catch {
    return "failed"
  }
}

export function HomeDiscoverGrid({ className }: { className?: string }) {
  const { t } = useWalletLanguage()
  const [sheet, setSheet] = useState<SheetKind>(null)
  const [note, setNote] = useState("")
  const [sending, setSending] = useState(false)

  const invite = async () => {
    const link = typeof window !== "undefined" ? window.location.origin : "https://app.sozu.capital"
    const result = await shareOrCopy(`${t.homeInviteShare} ${link}`)
    if (result === "copied") toast(t.homeLinkCopied)
    else if (result === "shared") toast(t.homeInviteReady)
  }

  const sendFeedback = async () => {
    const text = note.trim()
    if (!text || sending) return
    setSending(true)
    try {
      const result = await shareOrCopy(`${t.homeFeedbackTitle}: ${text}`)
      if (result === "failed") return
      toast(result === "copied" ? t.homeLinkCopied : t.homeFeedbackReady)
      setNote("")
      setSheet(null)
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div
        data-home-discover
        className={cn("grid w-full grid-cols-2 gap-3", className)}
        onTouchStart={blockShellSwipe}
        onTouchMove={blockShellSwipe}
        onTouchEnd={blockShellSwipe}
      >
        <button
          type="button"
          onClick={() => setSheet("dollars")}
          className={cn(tileClass, "col-span-2 min-h-[7.5rem] rounded-[1.75rem] px-5 py-5")}
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/45">
            {t.homeDollarsEyebrow}
          </p>
          <p className="mt-2 text-[1.65rem] font-medium leading-none tracking-tight">{t.homeDollarsTitle}</p>
        </button>

        <button
          type="button"
          onClick={() => void invite()}
          className={cn(tileClass, "flex aspect-square flex-col justify-between rounded-[1.75rem] p-4")}
        >
          <UserPlus className="h-6 w-6" strokeWidth={1.75} aria-hidden />
          <span>
            <span className="block text-[15px] font-medium leading-tight">{t.homeInviteTitle}</span>
            <span className="mt-1 block text-[12px] leading-snug text-white/50">{t.homeInviteBody}</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSheet("feedback")}
          className={cn(tileClass, "flex aspect-square flex-col justify-between rounded-[1.75rem] p-4")}
        >
          <MessageSquare className="h-6 w-6" strokeWidth={1.75} aria-hidden />
          <span>
            <span className="block text-[15px] font-medium leading-tight">{t.homeFeedbackTitle}</span>
            <span className="mt-1 block text-[12px] leading-snug text-white/50">{t.homeFeedbackBody}</span>
          </span>
        </button>
      </div>

      <DiscoverSheet
        open={sheet === "dollars"}
        title={t.homeDollarsEyebrow}
        onClose={() => setSheet(null)}
      >
        <p className="text-[15px] leading-relaxed text-white/75">{t.homeDollarsBody}</p>
      </DiscoverSheet>

      <DiscoverSheet
        open={sheet === "feedback"}
        title={t.homeFeedbackTitle}
        onClose={() => setSheet(null)}
      >
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t.homeFeedbackPlaceholder}
          rows={4}
          className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
        />
        <button
          type="button"
          disabled={!note.trim() || sending}
          onClick={() => void sendFeedback()}
          className="mt-3 w-full rounded-full bg-white py-3 text-[13px] font-semibold text-black transition hover:bg-white/90 active:scale-[0.98] disabled:opacity-40"
        >
          {t.homeFeedbackSend}
        </button>
      </DiscoverSheet>
    </>
  )
}

function DiscoverSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
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

  return createPortal(
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
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/45">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-white/40 transition hover:bg-white/15 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
