import "server-only"

import { Horizon } from "@stellar/stellar-sdk"
import { after } from "next/server"
import { getConfiguredFunderPublicKey } from "@/lib/stellar/soroban-fee-payer"

const PUBLIC_HORIZON = "https://horizon.stellar.org"
const TESTNET_HORIZON = "https://horizon-testnet.stellar.org"

/** Sponsored deploys treat STELLAR_NETWORK=public as mainnet. The alert must use that same horizon. */
export function feePayerHorizon(
  env: { network?: string; horizonUrl?: string } = {
    network: process.env.STELLAR_NETWORK,
    horizonUrl: process.env.STELLAR_HORIZON_URL,
  },
): { network: string; horizonUrl: string } {
  const explicit = env.horizonUrl?.trim()
  const raw = env.network?.trim()
  const mainnet = raw === "mainnet" || raw === "public"
  return {
    network: mainnet ? "mainnet" : raw || "testnet",
    horizonUrl: explicit || (mainnet ? PUBLIC_HORIZON : TESTNET_HORIZON),
  }
}

const DEFAULT_THRESHOLD_XLM = 25
const ALERT_COOLDOWN_MS = 15 * 60 * 1000

let lastAlertAt = 0
let alertInFlight = false

export type FeePayerBalanceReport = {
  publicKey: string
  network: string
  xlm: number
  thresholdXlm: number
  low: boolean
  alerted: boolean
}

export function feePayerThresholdXlm(raw = process.env.FEE_PAYER_ALERT_THRESHOLD_XLM): number {
  const n = Number(raw)
  return raw?.trim() && Number.isFinite(n) && n >= 0 ? n : DEFAULT_THRESHOLD_XLM
}

export function shouldAlert(params: {
  xlm: number
  thresholdXlm: number
  lastAlertAt: number
  now: number
  force?: boolean
}): boolean {
  if (params.xlm >= params.thresholdXlm) return false
  return params.force === true || params.now - params.lastAlertAt >= ALERT_COOLDOWN_MS
}

/** Slack reads `text`, Discord reads `content`; send both so either webhook works. */
async function postAlert(message: string): Promise<boolean> {
  const url = process.env.FEE_PAYER_ALERT_WEBHOOK_URL?.trim()
  if (!url) {
    console.error(`[fee-payer-alert] ${message} (FEE_PAYER_ALERT_WEBHOOK_URL not set)`)
    return false
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message, content: message }),
  })
  if (!res.ok) console.error(`[fee-payer-alert] webhook answered ${res.status}`)
  return res.ok
}

export async function checkFeePayerBalance(opts: { force?: boolean } = {}): Promise<FeePayerBalanceReport | null> {
  const publicKey = getConfiguredFunderPublicKey()
  if (!publicKey) return null
  const cfg = feePayerHorizon()
  const horizon = new Horizon.Server(cfg.horizonUrl)
  const account = await horizon.loadAccount(publicKey)
  const native = account.balances.find((b) => b.asset_type === "native")
  const xlm = Number(native?.balance ?? 0)
  const thresholdXlm = feePayerThresholdXlm()
  const now = Date.now()
  let alerted = false
  if (shouldAlert({ xlm, thresholdXlm, lastAlertAt, now, force: opts.force }) && !alertInFlight) {
    alertInFlight = true
    try {
      alerted = await postAlert(
        `Sozu Wallet fee payer ${publicKey} on ${cfg.network} holds ${xlm} XLM, below the ${thresholdXlm} XLM alert line. Top it up before smart-account deploys and sends start failing.`,
      )
      if (alerted) lastAlertAt = now
    } finally {
      alertInFlight = false
    }
  }
  return { publicKey, network: cfg.network, xlm, thresholdXlm, low: xlm < thresholdXlm, alerted }
}

/** Check after the response is sent; falls back to a detached promise outside a request. */
export function scheduleFeePayerBalanceCheck(): void {
  const run = () => checkFeePayerBalance().then(() => undefined, () => undefined)
  try {
    after(run)
  } catch {
    void run()
  }
}
