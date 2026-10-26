"use client"

import { useEffect, useState } from "react"

/** Faucet gift on wallet create and NFC tap. The phone locks this as its offline limit. */
const FAUCET_USDC = "10"

const PAPER = "#F6F4EF"
const INK = "#1A1A1A"
const COMMIT = "#1F4D3A"

function readWallet(): string | null {
  const stored = localStorage.getItem("stellar_public_key")?.trim().toUpperCase() ?? ""
  return /^[CG][A-Z2-7]{55}$/.test(stored) ? stored : null
}

export function LinkPhone() {
  const [address, setAddress] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setAddress(readWallet())
  }, [])

  const href = address
    ? `sozu://link?addr=${encodeURIComponent(address)}&usdc=${FAUCET_USDC}`
    : null

  return (
    <section
      style={{
        background: PAPER,
        color: INK,
        padding: "20px 20px 0",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 420,
          margin: "0 auto",
          border: `1px solid ${COMMIT}`,
          borderRadius: 16,
          padding: 16,
        }}
      >
        <p style={{ margin: 0, fontSize: 13, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Same wallet on the phone
        </p>
        {href && address ? (
          <>
            <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.45 }}>
              The faucet put {FAUCET_USDC} USDC on this passkey account. Sozu offline spends as this
              same address. The phone confirms each Bluetooth cheque. Your passkey on this site still
              has to sign the vault deposit before those coins move on chain.
            </p>
            <p style={{ margin: "10px 0 0", fontFamily: "ui-monospace, monospace", fontSize: 12, wordBreak: "break-all" }}>
              {address}
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <a
                href={href}
                style={{
                  background: COMMIT,
                  color: PAPER,
                  borderRadius: 999,
                  padding: "10px 14px",
                  fontSize: 14,
                  textDecoration: "none",
                }}
              >
                Open in Sozu offline
              </a>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(href).then(() => setCopied(true))
                }}
                style={{
                  border: `1px solid ${INK}`,
                  background: "transparent",
                  borderRadius: 999,
                  padding: "10px 14px",
                  fontSize: 14,
                }}
              >
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
          </>
        ) : (
          <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.45 }}>
            Sign in on this browser first. The faucet USDC is on that passkey account, and the phone
            has to use the same address.
          </p>
        )}
      </div>
    </section>
  )
}
