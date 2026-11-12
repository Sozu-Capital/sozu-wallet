import { merchItemPath, type MerchNetwork } from "@/lib/merch/catalog"
import { merchCopy, type MerchLanguage } from "@/lib/merch/copy"

export type WalletNetwork = "testnet" | "mainnet"

export type BuyGate =
  | {
      kind: "authenticate"
      href: string
      buyDisabled: false
      payment: null
    }
  | {
      kind: "checking"
      buyDisabled: true
      payment: null
    }
  | {
      kind: "shortfall"
      shortfallLabel: string
      depositLabel: string
      depositHref: string
      buyDisabled: true
      payment: null
    }
  | {
      kind: "network"
      networkLabel: string
      buyDisabled: true
      payment: null
    }
  | {
      kind: "allow"
      buyDisabled: false
      payment: null
    }

const ITEM_RETURN = /^\/item\/[a-z0-9-]+$/

/** Relative hang-tag path only. Rejects absolute and protocol-relative redirects. */
export function itemAuthReturnPath(redirect: string | null | undefined): string | null {
  const value = redirect?.trim() ?? ""
  if (!ITEM_RETURN.test(value)) return null
  return value
}

export function passkeyBuyHref(slug: string): string {
  const path = merchItemPath(slug)
  return `/auth?redirect=${encodeURIComponent(path)}`
}

export function parsePriceUsdc(priceUsdc: string | null): number | null {
  if (priceUsdc == null) return null
  const value = Number(priceUsdc.trim())
  if (!Number.isFinite(value) || value < 0) return null
  return value
}

/**
 * Ordinary USDC is the wallet balance, not vault yield and not a giveaway.
 * `displayWalletUsdc` is that figure. Other fields are ignored on purpose.
 */
export function ordinaryUsdcFromBalance(payload: {
  displayWalletUsdc?: unknown
  totalDisplayUsdcBalance?: unknown
  giveawayUsdc?: unknown
}): number | null {
  const value = payload.displayWalletUsdc
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null
  return value
}

function formatAmount(amount: number): string {
  const rounded = Math.round(amount * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2)
}

function cents(amount: number): number {
  return Math.round(amount * 100)
}

export function decideBuy(input: {
  hasSession: boolean
  balanceKnown: boolean
  slug: string
  language: MerchLanguage
  itemNetwork: MerchNetwork
  walletNetwork: WalletNetwork
  priceUsdc: number | null
  ordinaryUsdc: number | null
}): BuyGate {
  if (!input.hasSession) {
    return {
      kind: "authenticate",
      href: passkeyBuyHref(input.slug),
      buyDisabled: false,
      payment: null,
    }
  }

  if (input.itemNetwork !== input.walletNetwork) {
    return {
      kind: "network",
      networkLabel: merchCopy(input.language).networkMismatch,
      buyDisabled: true,
      payment: null,
    }
  }

  if (!input.balanceKnown || input.priceUsdc == null || input.ordinaryUsdc == null) {
    return { kind: "checking", buyDisabled: true, payment: null }
  }

  if (cents(input.ordinaryUsdc) < cents(input.priceUsdc)) {
    const gap = (cents(input.priceUsdc) - cents(input.ordinaryUsdc)) / 100
    const copy = merchCopy(input.language)
    return {
      kind: "shortfall",
      shortfallLabel: copy.shortfall(formatAmount(gap)),
      depositLabel: copy.deposit,
      depositHref: "/home",
      buyDisabled: true,
      payment: null,
    }
  }

  return { kind: "allow", buyDisabled: false, payment: null }
}
