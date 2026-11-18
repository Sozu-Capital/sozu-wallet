"use client"

import { useState } from "react"
import { sendCircleSacPayment } from "@/lib/connect/send-circle-payment"

export function ConnectPayConfirm({
  amount,
  to,
  username,
  accountId,
  onSigned,
  onCancel,
}: {
  amount: string
  to: string
  username: string
  accountId: string
  onSigned: (txHash: string) => void
  onCancel: () => void
}) {
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sign() {
    if (sending) return
    setSending(true)
    setError(null)
    try {
      const txHash = await sendCircleSacPayment({ from: accountId, to, amount })
      onSigned(txHash)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed")
      setSending(false)
    }
  }

  return (
    <div className="flex h-full min-h-[var(--sozu-app-height,100lvh)] w-full flex-col justify-between bg-black px-6 py-8 text-white">
      <div>
        <p className="text-[12px] uppercase tracking-[0.14em] text-white/45">Pay with Sozu</p>
        <p className="mt-3 text-[40px] font-semibold leading-none">{amount} USDC</p>
        <p className="mt-2 text-[13px] text-white/50">Circle testnet USDC</p>
      </div>
      <div className="space-y-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.12em] text-white/40">To</p>
          <p className="mt-1 break-all font-mono text-[13px] text-white/85">{to}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.12em] text-white/40">From</p>
          <p className="mt-1 text-[15px]">{username}</p>
          <p className="mt-1 break-all font-mono text-[12px] text-white/45">{accountId}</p>
        </div>
        {error ? <p className="text-[13px] text-red-300">{error}</p> : null}
      </div>
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => void sign()}
          disabled={sending}
          className="w-full rounded-full bg-white py-3.5 text-[15px] font-semibold text-black disabled:opacity-60"
        >
          {sending ? "Waiting for passkey…" : "Sign and send"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={sending}
          className="w-full py-2 text-[13px] text-white/50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
