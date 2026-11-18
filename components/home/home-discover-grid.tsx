"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { MessageSquare, UserPlus, X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useWalletLanguage } from "@/lib/wallet-language"
import {
  INVITE_GOAL,
  INVITE_REWARD_USD,
  INVITE_SHARING_ENABLED,
  inviteCodeMatchesUsername,
} from "@/lib/referral/invite-code"

type SheetKind = "dollars" | "feedback" | "invite" | null

const INVITE_CACHE_KEY = "sozu_invite_code:v1"

function readInviteCache(username: string): string | null {
  if (!username) return null
  try {
    const raw = localStorage.getItem(INVITE_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { username?: string; code?: string }
    if (
      parsed.username === username &&
      typeof parsed.code === "string" &&
      inviteCodeMatchesUsername(parsed.code, username)
    ) {
      return parsed.code
    }
  } catch {
    return null
  }
  return null
}

function writeInviteCache(username: string, code: string) {
  try {
    localStorage.setItem(INVITE_CACHE_KEY, JSON.stringify({ username, code }))
  } catch {
    // Private browsing can reject storage writes.
  }
}

const tileClass = cn(
  "border border-white/15 bg-white/[0.08] text-left text-white",
  "shadow-[0_10px_28px_rgba(0,0,0,0.28)]",
  "transition-colors hover:bg-white/[0.14] active:scale-[0.99]",
)

function blockShellSwipe(event: React.SyntheticEvent) {
  event.stopPropagation()
}

export function HomeDiscoverGrid({ className }: { className?: string }) {
  const { t } = useWalletLanguage()
  const [sheet, setSheet] = useState<SheetKind>(null)
  const [note, setNote] = useState("")
  const [sending, setSending] = useState(false)
  const [inviteCode, setInviteCode] = useState("")
  const [confirmedInvites, setConfirmedInvites] = useState(0)
  const [inviteGoal, setInviteGoal] = useState(INVITE_GOAL)

  useEffect(() => {
    let cancelled = false
    const username = localStorage.getItem("sozu_username")?.trim() ?? ""
    const cached = readInviteCache(username)
    if (cached) setInviteCode(cached)

    void (async () => {
      try {
        const response = await fetch("/api/wallet/referral/invite")
        if (!response.ok) return
        const data = (await response.json()) as {
          code?: string
          username?: string
          confirmedInvites?: number
          goal?: number
        }
        if (cancelled || typeof data.code !== "string") return
        setInviteCode(data.code)
        if (typeof data.confirmedInvites === "number") setConfirmedInvites(data.confirmedInvites)
        if (typeof data.goal === "number" && data.goal > 0) setInviteGoal(data.goal)
        const owner = typeof data.username === "string" && data.username.trim() ? data.username.trim() : username
        if (owner) writeInviteCache(owner, data.code)
      } catch {
        // The cached code still shows if the request fails.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const sendFeedback = async () => {
    const text = note.trim()
    if (!text || sending) return
    setSending(true)
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          path: typeof window !== "undefined" ? window.location.pathname : null,
        }),
      })
      if (!response.ok) {
        toast.error(t.homeFeedbackFailed)
        return
      }
      toast(t.homeFeedbackReady)
      setNote("")
      setSheet(null)
    } catch {
      toast.error(t.homeFeedbackFailed)
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div
        data-home-discover
        className={cn("grid w-full grid-cols-2 gap-2", className)}
        onTouchStart={blockShellSwipe}
        onTouchMove={blockShellSwipe}
        onTouchEnd={blockShellSwipe}
      >
        <button
          type="button"
          onClick={() => setSheet("dollars")}
          className={cn(tileClass, "col-span-2 min-h-[3.75rem] rounded-2xl px-4 py-3")}
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">
            {t.homeDollarsEyebrow}
          </p>
          <p className="mt-1 text-lg font-medium leading-none tracking-tight">{t.homeDollarsTitle}</p>
        </button>

        <button
          type="button"
          disabled
          className="col-span-2 flex min-h-[3.25rem] cursor-not-allowed flex-col justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-left text-white/35"
        >
          <span className="text-[14px] font-medium leading-tight">{t.homePayStoreTitle}</span>
          <span className="mt-0.5 text-[11px] leading-snug text-white/40">{t.homePayStoreBody}</span>
        </button>

        <button
          type="button"
          onClick={() => setSheet("invite")}
          className={cn(tileClass, "flex min-h-[4.25rem] flex-col justify-between rounded-2xl p-3")}
        >
          <UserPlus className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          <span>
            <span className="block text-[13px] font-medium leading-tight">{t.homeInviteTitle}</span>
            <span className="mt-0.5 block text-[11px] leading-snug text-white/50">{t.homeInviteBody}</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSheet("feedback")}
          className={cn(tileClass, "flex min-h-[4.25rem] flex-col justify-between rounded-2xl p-3")}
        >
          <MessageSquare className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          <span>
            <span className="block text-[13px] font-medium leading-tight">{t.homeFeedbackTitle}</span>
            <span className="mt-0.5 block text-[11px] leading-snug text-white/50">{t.homeFeedbackBody}</span>
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
        open={sheet === "invite"}
        title={t.homeInviteEyebrow}
        onClose={() => setSheet(null)}
      >
        <p className="text-[15px] leading-relaxed text-white/75">{t.homeInviteRewardBody}</p>
        <div className="mt-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[13px] text-white/70">
              {t.homeInviteProgress
                .replace("{count}", String(confirmedInvites))
                .replace("{goal}", String(inviteGoal))}
            </p>
            <p className="text-[13px] font-medium text-white">${INVITE_REWARD_USD}</p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-white"
              style={{ width: `${Math.min(100, Math.round((confirmedInvites / inviteGoal) * 100))}%` }}
            />
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/40">
            {t.homeInviteCodeLabel}
          </p>
          <p className={cn("mt-1 font-mono text-lg tracking-wide text-white", !inviteCode && "animate-pulse text-white/30")}>
            {inviteCode || "····-····"}
          </p>
        </div>
        <button
          type="button"
          disabled={!INVITE_SHARING_ENABLED}
          aria-disabled={!INVITE_SHARING_ENABLED}
          className="mt-4 w-full cursor-not-allowed rounded-full border border-white/10 bg-white/[0.06] py-3 text-[13px] font-semibold text-white/35"
        >
          {t.homeInviteShareCode}
        </button>
        <p className="mt-2 text-center text-[12px] leading-snug text-white/45">{t.homeInviteSoon}</p>
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
