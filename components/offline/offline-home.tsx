"use client"

import { useEffect, useState } from "react"
import type { OfflineLedger, OfflineLedgerTx } from "@/lib/offline/vault-ledger"
import { offlineAmountFits, offlineAndroidIntent, offlinePhoneLink, normalizeOfflineUsdc } from "@/lib/offline/offline-link"
import { signOfflineSettle } from "@/lib/offline/sign-offline-settle"

const REFRESH_MS = 15_000

function readWallet(): string | null {
  const stored = (
    localStorage.getItem("stellar_public_key") ??
    sessionStorage.getItem("stellar_public_key") ??
    ""
  )
    .trim()
    .toUpperCase()
  return /^[CG][A-Z2-7]{55}$/.test(stored) ? stored : null
}

function shortAccount(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`
}

function formatUsdc(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function OfflineHome({
  vaultQuery,
  initialDeposit,
  initialFrame,
}: {
  vaultQuery: string | null
  initialDeposit?: string | null
  initialFrame?: string | null
}) {
  const [address, setAddress] = useState<string | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [balanceState, setBalanceState] = useState<"idle" | "loading" | "ready" | "missing">("idle")
  const [amount, setAmount] = useState(() => normalizeOfflineUsdc(initialDeposit ?? "") ?? "")
  const [copied, setCopied] = useState<"account" | "link" | null>(null)
  const [ledger, setLedger] = useState<OfflineLedger | null>(null)
  const [ledgerError, setLedgerError] = useState<string | null>(null)
  const [signing, setSigning] = useState(false)
  const [signNote, setSignNote] = useState<string | null>(null)
  const [onAndroid, setOnAndroid] = useState(false)
  const frame = initialFrame?.trim().startsWith("SOZU1:") ? initialFrame.trim() : null

  useEffect(() => {
    setAddress(readWallet())
    setOnAndroid(/Android/i.test(navigator.userAgent))
  }, [])

  useEffect(() => {
    if (!address) return
    let cancelled = false
    setBalanceState("loading")
    async function loadBalance() {
      try {
        const res = await fetch(`/api/wallet/stellar/balance?publicKey=${address}`, { cache: "no-store" })
        if (!res.ok) throw new Error("balance")
        const data = (await res.json()) as { usdcBalance?: number; displayWalletUsdc?: number }
        const next = typeof data.usdcBalance === "number" ? data.usdcBalance : data.displayWalletUsdc
        if (cancelled) return
        if (typeof next !== "number") {
          setBalanceState("missing")
          return
        }
        setBalance(next)
        setBalanceState("ready")
      } catch {
        if (!cancelled) setBalanceState("missing")
      }
    }
    void loadBalance()
    return () => {
      cancelled = true
    }
  }, [address])

  useEffect(() => {
    const params = vaultQuery ? `?vault=${encodeURIComponent(vaultQuery)}` : ""
    let cancelled = false
    async function loadLedger() {
      try {
        const res = await fetch(`/api/offline/ledger${params}`, { cache: "no-store" })
        if (!res.ok) throw new Error("ledger")
        const data = (await res.json()) as OfflineLedger
        if (cancelled) return
        setLedger(data)
        setLedgerError(null)
      } catch {
        if (!cancelled) setLedgerError("Payments could not be read from testnet.")
      }
    }
    void loadLedger()
    const timer = window.setInterval(() => void loadLedger(), REFRESH_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [vaultQuery])

  const normalized = normalizeOfflineUsdc(amount)
  const overBalance = normalized != null && !offlineAmountFits(normalized, balanceState === "ready" ? balance : null)
  const href = address && normalized && !overBalance ? offlinePhoneLink(address, normalized) : null
  const openHref =
    address && normalized && href && onAndroid ? offlineAndroidIntent(address, normalized) : href

  async function copy(value: string, kind: "account" | "link") {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(kind)
    } catch {
      setCopied(null)
    }
  }

  return (
    <main className="relative z-10 min-h-[100dvh] bg-black text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-5 pb-16 pt-8">
        <header>
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">Sozu offline</p>
          <h1 className="mt-2 text-[2rem] font-medium leading-none tracking-tight">Your Sozu</h1>
          <p className="mt-3 text-sm leading-relaxed text-white/60">
            This wallet and the phone are the same Sozu. Choose how much of it the phone can spend offline.
          </p>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Passkey account</p>
          {address ? (
            <>
              <p className="mt-3 font-mono text-lg tracking-tight">{shortAccount(address)}</p>
              <p className="mt-1 break-all font-mono text-[11px] text-white/40">{address}</p>
              <p className="mt-4 text-2xl font-medium tracking-tight">
                {balanceState === "ready" && balance != null ? `${formatUsdc(balance)} USDC` : balanceState === "loading" ? "Reading balance…" : "Balance unavailable"}
              </p>
              <button
                type="button"
                onClick={() => void copy(address, "account")}
                className="mt-4 text-sm text-white/70 underline-offset-4 hover:underline"
              >
                {copied === "account" ? "Address copied" : "Copy address"}
              </button>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm leading-relaxed text-white/70">
                Sign in with the passkey on this browser. That wallet is the source of the deposit.
              </p>
              <a
                href="/auth?redirect=/offline"
                className="mt-4 inline-flex h-11 items-center rounded-full bg-white px-4 text-sm font-medium text-black"
              >
                Sign in
              </a>
            </>
          )}
        </section>

        <section>
          <label htmlFor="offline-amount" className="text-[11px] uppercase tracking-[0.18em] text-white/40">
            Available offline
          </label>
          <div className="mt-3 flex items-end gap-2 border-b border-white/15 pb-2">
            <input
              id="offline-amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value.replace(/[^\d.]/g, ""))
                setCopied(null)
              }}
              className="w-full bg-transparent text-5xl font-medium tracking-tight outline-none placeholder:text-white/20"
            />
            <span className="pb-2 text-sm text-white/50">USDC</span>
          </div>
          <div className="mt-4 flex gap-2">
            {["1", "5", "10"].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(preset)}
                className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-white/80"
              >
                {preset}
              </button>
            ))}
            {balanceState === "ready" && balance != null && balance > 0 ? (
              <button
                type="button"
                onClick={() => setAmount(balance.toFixed(7).replace(/\.?0+$/, ""))}
                className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-white/80"
              >
                All
              </button>
            ) : null}
          </div>
          <p className="mt-3 text-sm leading-relaxed text-white/50">
            {overBalance
              ? "That is more than this wallet holds."
              : onAndroid
                ? "This amount becomes the offline balance on the phone."
                : "Open this page on the phone. This amount becomes the offline balance there."}
          </p>
          {openHref ? (
            <div className="mt-5 flex flex-col gap-3">
              <a
                href={openHref}
                className="flex h-14 items-center justify-center rounded-full bg-white text-base font-medium text-black"
              >
                Put this on my phone
              </a>
              <button
                type="button"
                onClick={() => {
                  if (href) void copy(href, "link")
                }}
                className="text-sm text-white/60 underline-offset-4 hover:underline"
              >
                {copied === "link" ? "Link copied" : "Copy phone link"}
              </button>
            </div>
          ) : (
            <p className="mt-5 text-sm text-white/40">
              {address ? "Enter an amount to open it on the phone." : "Sign in, then choose an amount."}
            </p>
          )}
        </section>

        {frame ? (
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Settlement</p>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              This cheque is ready. Your passkey signs the vault call. The fee payer only covers the network fee.
            </p>
            <button
              type="button"
              disabled={signing || !address}
              onClick={() => {
                if (!address) return
                setSigning(true)
                setSignNote(null)
                void signOfflineSettle(frame, address)
                  .then((hash) => setSignNote(`Signed. ${hash.slice(0, 8)}`))
                  .catch((error: unknown) => {
                    setSignNote(error instanceof Error ? error.message : "The passkey did not sign.")
                  })
                  .finally(() => setSigning(false))
              }}
              className="mt-5 flex h-14 w-full items-center justify-center rounded-full bg-white text-base font-medium text-black disabled:opacity-40"
            >
              {signing ? "Waiting for the passkey…" : "Sign with passkey"}
            </button>
            {signNote ? <p className="mt-3 text-sm text-white/70">{signNote}</p> : null}
            {!address ? <p className="mt-3 text-sm text-white/40">Sign in first. The passkey account is the settler.</p> : null}
          </section>
        ) : null}

        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-medium">Payments</h2>
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Testnet</p>
          </div>
          <div className="mt-4">
            <PaymentList ledger={ledger} error={ledgerError} />
          </div>
          {ledger?.contractExplorerUrl ? (
            <a
              href={ledger.contractExplorerUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block text-sm text-white/50 underline-offset-4 hover:underline"
            >
              Vault on Stellar Expert
            </a>
          ) : null}
        </section>
      </div>
    </main>
  )
}

function PaymentList({ ledger, error }: { ledger: OfflineLedger | null; error: string | null }) {
  if (error) return <p className="text-sm text-red-300/90">{error}</p>
  if (!ledger) return <p className="text-sm text-white/40">Reading payments…</p>
  if (ledger.waiting) return <p className="text-sm text-white/50">Waiting for the vault.</p>
  if (ledger.txs.length === 0) return <p className="text-sm text-white/50">No payments on testnet in this window.</p>
  return (
    <ol className="max-h-[50vh] divide-y divide-white/10 overflow-y-auto">
      {ledger.txs.map((tx) => (
        <PaymentRow key={tx.hash} tx={tx} />
      ))}
    </ol>
  )
}

function PaymentRow({ tx }: { tx: OfflineLedgerTx }) {
  const title = tx.reason === "note-used" ? "Already used" : tx.reason === "settled" ? "Settled" : "Vault"
  const when = tx.createdAt ? formatWhen(tx.createdAt) : "Testnet"
  return (
    <li className="py-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-[11px] text-white/40">{when}</p>
      </div>
      <p className="mt-1 text-sm text-white/70">{tx.label}</p>
      <a
        href={tx.explorerUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-1 inline-block font-mono text-[11px] text-white/40 underline-offset-4 hover:underline"
      >
        {tx.hash.slice(0, 8)}
      </a>
    </li>
  )
}

function formatWhen(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
