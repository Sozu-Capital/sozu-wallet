"use client"

import { useEffect, useState } from "react"
import type { OfflineLedger, OfflineLedgerTx } from "@/lib/offline/vault-ledger"
import { formatSyncRemaining, WITNESS_SYNC_MS, witnessSyncDial } from "@/lib/offline/witness-sync"

const PAPER = "#F6F4EF"
const INK = "#1A1A1A"
const COMMIT = "#1F4D3A"
const FLAG = "#C4552A"
const QUIET = "#E7E2D6"

export function OfflineLedgerView({ vaultQuery }: { vaultQuery: string | null }) {
  const [ledger, setLedger] = useState<OfflineLedger | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [syncedAt, setSyncedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(tick)
  }, [])

  useEffect(() => {
    const params = vaultQuery ? `?vault=${encodeURIComponent(vaultQuery)}` : ""
    let cancelled = false

    async function load() {
      try {
        const res = await fetch(`/api/offline/ledger${params}`, { cache: "no-store" })
        if (!res.ok) throw new Error("ledger request failed")
        const data = (await res.json()) as OfflineLedger
        if (cancelled) return
        setLedger(data)
        setError(null)
        setSyncedAt(Date.now())
      } catch {
        if (!cancelled) setError("The witness could not read testnet.")
      }
    }

    void load()
    const reprint = window.setInterval(() => void load(), WITNESS_SYNC_MS)
    return () => {
      cancelled = true
      window.clearInterval(reprint)
    }
  }, [vaultQuery])

  const dial = witnessSyncDial(now, syncedAt ?? now)
  const wifi = error ? "down" : ledger ? "up" : "…"
  const count = ledger?.txs.length ?? 0

  return (
    <div
      className="min-h-[100dvh] px-4 py-10"
      style={{
        backgroundColor: "#C9C1B2",
        backgroundImage:
          "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.35), transparent 42%)",
      }}
    >
      <article
        className="mx-auto w-full max-w-[420px] rounded-[32px] px-5 pb-6 pt-5"
        style={{
          backgroundColor: "#E7E0D2",
          color: INK,
          boxShadow:
            "0 28px 50px rgba(48, 36, 18, 0.28), inset 0 1px 0 rgba(255,255,255,0.75), inset 0 -10px 18px rgba(90, 70, 40, 0.12)",
          border: "1px solid #C3B9A8",
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <Screw />
          <p className="text-[10px] font-medium uppercase tracking-[0.28em]" style={{ color: "#6D655A" }}>
            Sozu witness
          </p>
          <Screw />
        </div>

        <div className="grid grid-cols-[88px_1fr_88px] items-center gap-2">
          <WitnessFace wifi={wifi} />
          <SyncDial degrees={dial.degrees} remaining={formatSyncRemaining(dial.remainingMs)} />
          <CountWindow count={count} />
        </div>

        <div className="mt-5 flex gap-2">
          <FilterKey label="Testnet" on />
          <FilterKey label="Sozu vault" on />
        </div>

        <p className="mt-3 text-center text-[11px] leading-relaxed" style={{ color: "#6D655A" }}>
          Testnet payments that left a phone with no signal. The first phone back online submits them to the vault. This tape is the audit.
        </p>

        <div
          className="mt-4 overflow-hidden rounded-[18px] p-3"
          style={{
            backgroundColor: "#2A2622",
            boxShadow: "inset 0 10px 18px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          <div
            className="max-h-[420px] overflow-y-auto rounded-[12px] px-3 py-3"
            style={{
              backgroundColor: PAPER,
              backgroundImage:
                "repeating-linear-gradient(transparent, transparent 27px, rgba(26,26,26,0.06) 28px)",
            }}
          >
            <Tape
              ledger={ledger}
              error={error}
            />
          </div>
        </div>

        <footer className="mt-4 flex items-end justify-between">
          <Screw />
          <div className="flex flex-col items-center gap-1 text-[11px]">
            {ledger?.contractExplorerUrl ? (
              <a href={ledger.contractExplorerUrl} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                Vault on Stellar Expert
              </a>
            ) : (
              <span style={{ color: "#6D655A" }}>Waiting for the vault id</span>
            )}
            <a href="/offline/mesh" className="underline-offset-2 hover:underline" style={{ color: "#6D655A" }}>
              Mesh wallet
            </a>
          </div>
          <Screw />
        </footer>
      </article>
    </div>
  )
}

function Tape({ ledger, error }: { ledger: OfflineLedger | null; error: string | null }) {
  if (error) {
    return <p className="text-sm" style={{ color: FLAG }}>{error}</p>
  }
  if (!ledger) {
    return <p className="text-sm" style={{ color: "#6D655A" }}>Reading the vault…</p>
  }
  if (ledger.waiting) {
    return (
      <p className="text-sm leading-relaxed" style={{ color: "#6D655A" }}>
        Waiting for the vault id. This tape stays blank until a Sozu contract is set.
      </p>
    )
  }
  if (ledger.txs.length === 0) {
    return (
      <p className="text-sm leading-relaxed" style={{ color: "#6D655A" }}>
        Vault is set. No Sozu submissions on testnet in this window.
      </p>
    )
  }
  return (
    <ol className="space-y-2">
      {ledger.txs.map((tx) => (
        <Slip key={tx.hash} tx={tx} />
      ))}
    </ol>
  )
}

function Slip({ tx }: { tx: OfflineLedgerTx }) {
  const flag = tx.reason === "note-used"
  const when = tx.createdAt ? formatWhen(tx.createdAt) : "testnet"
  return (
    <li
      className="rounded-md px-3 py-2"
      style={{
        backgroundColor: "#FFFcf6",
        boxShadow: "0 1px 0 rgba(26,26,26,0.08), 0 8px 12px rgba(48,36,18,0.06)",
        borderTop: `3px solid ${flag ? FLAG : COMMIT}`,
      }}
    >
      <p className="text-[10px] uppercase tracking-[0.16em]" style={{ color: flag ? FLAG : COMMIT }}>
        {flag ? "Note already used" : tx.reason === "settled" ? "Settled" : "Vault"}
      </p>
      <p className="mt-1 text-sm font-medium">{tx.label}</p>
      <p className="mt-1 font-mono text-[11px]" style={{ color: "#6D655A" }}>
        {when} · {tx.hash.slice(0, 8)}
      </p>
      <a
        href={tx.explorerUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-1 inline-block text-[11px] underline-offset-2 hover:underline"
      >
        Open transaction
      </a>
    </li>
  )
}

function WitnessFace({ wifi }: { wifi: string }) {
  const up = wifi === "up"
  return (
    <div
      className="flex h-[88px] w-[88px] flex-col items-center justify-center gap-1 rounded-[6px]"
      style={{
        backgroundColor: PAPER,
        color: INK,
        boxShadow: "inset 0 2px 4px rgba(255,255,255,0.8), 0 2px 0 #B7AE9E, 0 8px 12px rgba(48,36,18,0.12)",
        border: `3px solid ${INK}`,
      }}
      aria-label={`Witness wifi ${wifi}`}
    >
      <span className="text-[10px] uppercase tracking-[0.18em]">Witness</span>
      <span className="text-sm font-medium" style={{ color: up ? COMMIT : wifi === "down" ? FLAG : "#6D655A" }}>
        {wifi}
      </span>
    </div>
  )
}

function SyncDial({ degrees, remaining }: { degrees: number; remaining: string }) {
  const ticks = Array.from({ length: 16 }, (_, index) => index)
  return (
    <div className="flex flex-col items-center">
      <div
        className="relative grid h-[104px] w-[104px] place-items-center rounded-full"
        style={{
          backgroundColor: "#D9D1C3",
          boxShadow: "inset 0 3px 6px rgba(255,255,255,0.7), 0 6px 10px rgba(48,36,18,0.16)",
        }}
        aria-label={`Next sync in ${remaining}`}
      >
        <svg viewBox="0 0 100 100" className="h-[92px] w-[92px]">
          <circle cx="50" cy="50" r="44" fill={PAPER} stroke={INK} strokeWidth="3" />
          {ticks.map((tick) => {
            const angle = ((tick / 16) * 360 - 90) * (Math.PI / 180)
            const inner = tick % 4 === 0 ? 32 : 36
            return (
              <line
                key={tick}
                x1={50 + Math.cos(angle) * inner}
                y1={50 + Math.sin(angle) * inner}
                x2={50 + Math.cos(angle) * 41}
                y2={50 + Math.sin(angle) * 41}
                stroke={tick % 4 === 0 ? INK : "#8A8174"}
                strokeWidth={tick % 4 === 0 ? 1.6 : 1}
              />
            )
          })}
          <g style={{ transform: `rotate(${degrees}deg)`, transformOrigin: "50px 50px" }}>
            <line x1="50" y1="50" x2="50" y2="16" stroke={COMMIT} strokeWidth="2.4" strokeLinecap="round" />
          </g>
          <circle cx="50" cy="50" r="4" fill={INK} />
        </svg>
      </div>
      <p className="mt-1 text-[10px] uppercase tracking-[0.16em]" style={{ color: "#6D655A" }}>
        {remaining}
      </p>
    </div>
  )
}

function CountWindow({ count }: { count: number }) {
  const digits = String(count).padStart(3, "0").slice(-3)
  return (
    <div
      className="flex h-[88px] w-[88px] flex-col items-center justify-center rounded-[10px]"
      style={{
        backgroundColor: "#14281E",
        boxShadow: "inset 0 6px 10px rgba(0,0,0,0.45), 0 2px 0 #B7AE9E",
        border: "1px solid #0C1812",
      }}
      aria-label={`${count} Sozu transactions`}
    >
      <span className="font-mono text-[28px] font-medium tracking-[0.12em]" style={{ color: "#D7EFE4" }}>
        {digits}
      </span>
      <span className="text-[9px] uppercase tracking-[0.16em]" style={{ color: "#8FB5A2" }}>
        Sozu txs
      </span>
    </div>
  )
}

function FilterKey({ label, on }: { label: string; on: boolean }) {
  return (
    <div
      className="flex flex-1 items-center justify-between rounded-full px-3 py-2 text-[11px] font-medium"
      style={{
        backgroundColor: on ? PAPER : QUIET,
        boxShadow: "inset 0 2px 3px rgba(255,255,255,0.8), 0 2px 0 #B7AE9E",
        border: "1px solid #C9C0B0",
      }}
    >
      <span>{label}</span>
      <span
        className="grid h-5 w-5 place-items-center rounded-full text-[9px]"
        style={{
          backgroundColor: on ? COMMIT : QUIET,
          color: on ? PAPER : INK,
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.25)",
        }}
      >
        {on ? "on" : "off"}
      </span>
    </div>
  )
}

function Screw() {
  return (
    <span
      aria-hidden
      className="relative grid h-3.5 w-3.5 place-items-center rounded-full"
      style={{
        backgroundColor: "#B7AE9E",
        boxShadow: "inset 0 1px 1px rgba(255,255,255,0.7), 0 1px 1px rgba(0,0,0,0.2)",
      }}
    >
      <span className="h-px w-2" style={{ backgroundColor: "#6D655A" }} />
    </span>
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
