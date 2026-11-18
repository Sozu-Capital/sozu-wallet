"use client"

import { useEffect } from "react"
import { FAUCET_TAP_PATH } from "@/lib/faucet/tap-path"

/**
 * Reads the NFC/QR secret from the URL fragment, trades it for an httpOnly cookie,
 * then replaces the address bar with /tap. The fragment is not sent to the server
 * on the page load, and it is removed before the cookie request returns.
 */
export function TapEntry() {
  useEffect(() => {
    const secret = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : ""
    if (!secret) return
    window.history.replaceState(null, "", FAUCET_TAP_PATH)
    let cancelled = false
    void (async () => {
      const res = await fetch("/api/faucet-tap/enter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret }),
        cache: "no-store",
      })
      if (!cancelled && res.ok) window.location.replace(FAUCET_TAP_PATH)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return <div className="fixed inset-0 bg-black" />
}
