"use client"

import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { QRCodeSVG } from "qrcode.react"
import { Copy, Check, X } from "lucide-react"
import { toast } from "sonner"
import { copyToClipboard, formatAddress } from "@/lib/wallet-utils"
import { useWalletLanguage } from "@/lib/wallet-language"
import { formatWalletText } from "@/lib/wallet-texts"
import { resolveDepositReceiveAddress } from "@/lib/wallet/deposit-receive-address"
import { getUserId } from "@/lib/wallet-utils"
import { fundViaSozuFaucet } from "@/lib/stellar/sozu-faucet-fund"
import {
  markWalletActivationComplete,
  markWelcomeOnboardingComplete,
} from "@/lib/wallet/needs-activation-onboarding"

type DepositModalProps = {
  isOpen: boolean
  onClose: () => void
  /** Prefer prop from wallet context; falls back to sessionStorage. */
  walletAddress?: string
  walletNetwork?: "testnet" | "mainnet"
}

const FAUCET_COOLDOWN_KEY = "sozu_faucet_claim_until_v1"
const FAUCET_COOLDOWN_MS = 24 * 60 * 60 * 1000

function readFaucetCooldown(wallet: string): boolean {
  try {
    const raw = localStorage.getItem(FAUCET_COOLDOWN_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw) as { wallet?: string; until?: number }
    return (
      parsed.wallet === wallet.trim().toUpperCase() &&
      typeof parsed.until === "number" &&
      parsed.until > Date.now()
    )
  } catch {
    return false
  }
}

function writeFaucetCooldown(wallet: string, untilMs: number) {
  try {
    localStorage.setItem(
      FAUCET_COOLDOWN_KEY,
      JSON.stringify({ wallet: wallet.trim().toUpperCase(), until: untilMs }),
    )
  } catch {
    /* private mode or quota */
  }
}

function buildAddressQrPayload(address: string): string {
  return address
}

/** Block horizontal swipes from reaching the app shell panel carousel. */
function blockShellSwipe(e: React.SyntheticEvent) {
  e.stopPropagation()
}

export function DepositModal({
  isOpen,
  onClose,
  walletAddress: walletAddressProp,
  walletNetwork = "testnet",
}: DepositModalProps) {
  const { t } = useWalletLanguage()
  const router = useRouter()
  const [address, setAddress] = useState<string>("")
  const [depositAddressSource, setDepositAddressSource] = useState<
    "prop" | "storage" | "sync" | "legacy"
  >("storage")
  const [sozuTag, setSozuTag] = useState<string>("")
  const [tagCopied, setTagCopied] = useState(false)
  const [addressCopied, setAddressCopied] = useState(false)
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [faucetBusy, setFaucetBusy] = useState(false)
  const [faucetLocked, setFaucetLocked] = useState(false)
  const [faucetStatus, setFaucetStatus] = useState<"idle" | "ok" | "err">("idle")
  const [faucetError, setFaucetError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isOpen) {
      setVisible(false)
      setFaucetBusy(false)
      setFaucetStatus("idle")
      setFaucetError(null)
      return
    }

    let tag = ""
    if (typeof window !== "undefined") {
      tag =
        sessionStorage.getItem("dev_username_display") ??
        localStorage.getItem("sozu_username") ??
        ""
      setSozuTag(tag)
    }

    setSetupError(
      typeof window !== "undefined"
        ? sessionStorage.getItem("wallet_setup_error")
        : null,
    )

    void (async () => {
      setResolving(true)
      try {
        const userId = getUserId()
        const { address: depositAddr, source } = await resolveDepositReceiveAddress(
          walletAddressProp,
          userId,
        )
        setDepositAddressSource(source)
        setAddress(depositAddr)
        if (!depositAddr) {
          const statusRes = await fetch("/api/wallet/smart-wallet/status")
          if (statusRes.ok) {
            const status = (await statusRes.json()) as { missingEnv?: string | null }
            if (status.missingEnv) setSetupError(status.missingEnv)
          }
        } else if (typeof window !== "undefined") {
          sessionStorage.removeItem("wallet_setup_error")
          setSetupError(null)
        }
      } finally {
        setResolving(false)
      }
    })()

    requestAnimationFrame(() => setVisible(true))
  }, [isOpen, walletAddressProp])

  const propIsC = walletAddressProp?.trim().toUpperCase().startsWith("C")
  const effectiveAddress =
    address.startsWith("C") ? address : propIsC ? walletAddressProp!.trim().toUpperCase() : address
  const qrPayload = useMemo(() => {
    if (effectiveAddress) return buildAddressQrPayload(effectiveAddress)
    return ""
  }, [effectiveAddress])

  const addressLabel = useMemo(
    () => (effectiveAddress ? formatAddress(effectiveAddress, 6, 6) : ""),
    [effectiveAddress],
  )

  useEffect(() => {
    if (!isOpen) return
    const wallet = effectiveAddress || address
    if (!wallet) return
    setFaucetLocked(readFaucetCooldown(wallet))
  }, [isOpen, effectiveAddress, address])

  const qrCaption = effectiveAddress
    ? effectiveAddress.startsWith("C")
      ? `${formatWalletText(t.depositAddressCaption, { addr: addressLabel })} · ${t.depositSmartAccountHint}`
      : formatWalletText(t.depositAddressCaption, { addr: addressLabel })
    : t.depositConnectWallet

  const handleCopyTag = async () => {
    if (!sozuTag) return
    const ok = await copyToClipboard(`$${sozuTag}`)
    if (!ok) return
    setTagCopied(true)
    setTimeout(() => setTagCopied(false), 2000)
  }

  const handleCopyAddress = async () => {
    if (!effectiveAddress) return
    const ok = await copyToClipboard(effectiveAddress)
    if (!ok) return
    setAddressCopied(true)
    setTimeout(() => setAddressCopied(false), 2000)
  }

  const handleSozuFaucetFund = async () => {
    if (faucetBusy || faucetLocked || walletNetwork !== "testnet") return
    setFaucetBusy(true)
    setFaucetStatus("idle")
    setFaucetError(null)
    try {
      const result = await fundViaSozuFaucet(effectiveAddress || address)
      const fundedWallet = ("to" in result && result.to) || effectiveAddress || address
      if (result.ok) {
        writeFaucetCooldown(fundedWallet, Date.now() + FAUCET_COOLDOWN_MS)
        setFaucetLocked(true)
        setFaucetStatus("ok")
        markWelcomeOnboardingComplete()
        markWalletActivationComplete()
        onClose()
        router.replace("/home")
        return
      }
      if (result.reason === "wallet_daily_limit") {
        const until = result.nextAvailableAt ? Date.parse(result.nextAvailableAt) : Number.NaN
        writeFaucetCooldown(fundedWallet, Number.isFinite(until) ? until : Date.now() + FAUCET_COOLDOWN_MS)
        setFaucetLocked(true)
        setFaucetStatus("err")
        setFaucetError(t.depositFaucetDailyLimit)
        return
      }
      setFaucetStatus("err")
      setFaucetError(result.error)
    } catch (e) {
      setFaucetStatus("err")
      setFaucetError(e instanceof Error ? e.message : t.depositFaucetError)
    } finally {
      setFaucetBusy(false)
    }
  }

  if (!isOpen || !mounted) return null

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 overflow-y-auto px-6 py-8 sm:px-8 overscroll-y-contain overscroll-none"
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 0.35s ease",
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        touchAction: "none",
      }}
      onClick={onClose}
      onTouchStart={blockShellSwipe}
      onTouchMove={blockShellSwipe}
      onTouchEnd={blockShellSwipe}
      onMouseDown={blockShellSwipe}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t.depositClose}
        className="absolute right-5 top-[max(1.25rem,env(safe-area-inset-top))] z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-white/40 transition hover:bg-white/15 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          toast(t.comingSoon, { description: t.depositPesosTag })
        }}
        className="rounded-full border border-white/15 bg-white/[0.08] px-4 py-2 text-[11px] font-medium text-white/80 transition hover:bg-white/[0.14] hover:text-white"
      >
        {t.depositPesosTag}
      </button>

      <div className="text-[9px] font-light uppercase tracking-[0.3em] text-white/35">{t.depositTitle}</div>

      {sozuTag ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            void handleCopyTag()
          }}
          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[12px] text-white/70"
        >
          {tagCopied ? t.depositCopied : `$${sozuTag}`}
        </button>
      ) : null}

      <div
        className="flex flex-col items-center gap-2"
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: visible ? "translateY(0)" : "translateY(12px)",
          transition: "transform 0.4s cubic-bezier(0.4,0,0.2,1)",
          touchAction: "manipulation",
        }}
      >
        {qrPayload ? (
          <div key={qrPayload} className="inline-block rounded-2xl bg-white p-3.5 transition-opacity duration-300">
            <QRCodeSVG
              value={qrPayload}
              size={200}
              bgColor="#ffffff"
              fgColor="#111111"
              level="H"
            />
          </div>
        ) : (
          <div className="h-56 w-56 animate-pulse rounded-2xl bg-white/10" />
        )}
        <div className="max-w-[16rem] text-center text-[10px] leading-snug text-white/40">{qrCaption}</div>
      </div>

      <div
        className="flex w-full max-w-sm flex-col gap-2"
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: visible ? "translateY(0)" : "translateY(8px)",
          transition: "transform 0.45s cubic-bezier(0.4,0,0.2,1) 0.05s",
          touchAction: "manipulation",
        }}
      >
        <button
            type="button"
            onClick={handleCopyAddress}
            disabled={!effectiveAddress}
            className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.08] px-4 py-2.5 transition hover:bg-emerald-500/[0.12] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <div className="min-w-0 text-left">
              <p className="text-[9px] uppercase tracking-wider text-white/35">{t.depositStellarAddress}</p>
              <p className="truncate font-mono text-[11px] text-white/70">
                {effectiveAddress ? addressLabel : t.depositNoWallet}
              </p>
            </div>
            {addressCopied ? (
              <span className="flex shrink-0 items-center gap-1 text-[10px] text-green-400">
                <Check className="h-4 w-4" />
                {t.depositCopied}
              </span>
            ) : (
              <Copy className="h-4 w-4 shrink-0 text-white/25 group-hover:text-white/60" />
            )}
          </button>

        {!effectiveAddress && (setupError || resolving) ? (
          <div className="rounded-2xl border border-rose-500/35 bg-rose-950/40 px-4 py-3 text-left">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-rose-200/90">
              {t.depositNoWallet}
            </div>
            {setupError ? (
              <div className="mt-1.5 text-[10px] leading-relaxed text-white/55">{setupError}</div>
            ) : null}
            {resolving ? (
              <div className="mt-1 text-[10px] text-white/40">{t.depositResolvingWallet}</div>
            ) : null}
          </div>
        ) : null}

        {depositAddressSource === "legacy" && effectiveAddress.startsWith("G") ? (
          <div className="rounded-2xl border border-amber-500/35 bg-amber-950/40 px-4 py-2.5 text-[10px] leading-relaxed text-amber-100/90">
            {t.depositLegacyGWarning}
          </div>
        ) : null}

      </div>

      {walletNetwork === "testnet" ? (
        <div
          className="relative z-20 flex w-full max-w-sm flex-col gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            disabled={faucetBusy || faucetLocked || resolving || !effectiveAddress}
            onClick={() => void handleSozuFaucetFund()}
            className="flex w-full items-center justify-center rounded-2xl border border-white/20 bg-white/[0.08] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/90 transition hover:bg-white/[0.14] hover:text-white active:scale-[0.99] disabled:opacity-50"
          >
            {faucetBusy ? t.depositFaucetBusy : t.depositFaucetCta}
          </button>
          {faucetStatus === "err" ? (
            <p className="text-center text-[10px] text-red-300/90">{faucetError || t.depositFaucetError}</p>
          ) : faucetLocked ? (
            <p className="text-center text-[10px] text-white/55">{t.depositFaucetDailyLimit}</p>
          ) : (
            <p className="text-center text-[10px] text-white/40">{t.depositFaucetHint}</p>
          )}
        </div>
      ) : null}

      <div className="shrink-0 text-[9px] text-white/25">{t.depositUsdcOnly}</div>
    </div>
  )

  return createPortal(modal, document.body)
}
