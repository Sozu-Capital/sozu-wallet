"use client"

import { useEffect, useState } from "react"
import type { OfflineLedger } from "@/lib/offline/vault-ledger"

const SPOKEN = "Offline Stellar payments. A second spend of the same note fails on chain."

export function OfflineLedgerView({ vaultQuery }: { vaultQuery: string | null }) {
  const [ledger, setLedger] = useState<OfflineLedger | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = vaultQuery ? `?vault=${encodeURIComponent(vaultQuery)}` : ""
    let cancelled = false
    fetch(`/api/offline/ledger${params}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("ledger request failed")
        return (await res.json()) as OfflineLedger
      })
      .then((data) => {
        if (!cancelled) setLedger(data)
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the testnet ledger.")
      })
    return () => {
      cancelled = true
    }
  }, [vaultQuery])

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col gap-6 px-5 pb-16 pt-[max(2rem,env(safe-area-inset-top))] text-white">
      <header className="space-y-2">
        <p className="text-[10px] font-extralight uppercase tracking-[0.18em] text-white/45">
          Sozu Offline · testnet
        </p>
        <h1 className="text-xl font-semibold leading-snug">{SPOKEN}</h1>
        <p className="text-sm text-white/55">
          Live ledger of offline vault submissions. A website cannot hear Bluetooth. It shows vault events after an upload.
        </p>
      </header>

      {error ? <p className="text-sm text-red-300/90">{error}</p> : null}

      {!ledger && !error ? (
        <p className="text-sm text-white/45">Loading testnet rows…</p>
      ) : null}

      {ledger?.waiting ? (
        <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/65">
          Waiting for the vault id from the Contract cut. No explorer hashes are invented here.
        </p>
      ) : null}

      {ledger?.contractExplorerUrl ? (
        <a
          href={ledger.contractExplorerUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-sky-300 underline-offset-4 hover:underline"
        >
          Open vault on Stellar Expert
        </a>
      ) : null}

      {ledger && !ledger.waiting && ledger.txs.length === 0 ? (
        <p className="text-sm text-white/55">
          Vault is set. No submissions on testnet yet. First settle and the next <span className="text-white">note-used</span> will show here.
        </p>
      ) : null}

      {ledger && ledger.txs.length > 0 ? (
        <ol className="space-y-3">
          {ledger.txs.map((tx) => (
            <li key={tx.hash} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">{tx.reason}</p>
              <p
                className={
                  tx.reason === "note-used"
                    ? "mt-1 text-sm font-medium text-[#C4552A]"
                    : "mt-1 text-sm font-medium"
                }
              >
                {tx.label}
              </p>
              {tx.createdAt ? <p className="mt-1 text-xs text-white/40">{tx.createdAt}</p> : null}
              <a
                href={tx.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-sm text-sky-300 underline-offset-4 hover:underline"
              >
                View on Stellar Expert
              </a>
            </li>
          ))}
        </ol>
      ) : null}
    </main>
  )
}
