import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ItemPageView } from "@/components/merch/item-page-view"
import { getMerchItem, LIQUID_SOCIETY_SLUG } from "@/lib/merch/catalog"
import {
  decideBuy,
  itemAuthReturnPath,
  ordinaryUsdcFromBalance,
  passkeyBuyHref,
} from "@/lib/merch/buy-gate"
import { buildItemPageModel } from "@/lib/merch/item-page"

const base = {
  slug: LIQUID_SOCIETY_SLUG,
  language: "es" as const,
  itemNetwork: "testnet" as const,
  walletNetwork: "testnet" as const,
  priceUsdc: 12,
  ordinaryUsdc: 5,
}

describe("buy gate", () => {
  it("sends a logged-out Buy through passkey and back to the same item", () => {
    const gate = decideBuy({ ...base, hasSession: false, balanceKnown: false, ordinaryUsdc: null })
    expect(gate).toMatchObject({
      kind: "authenticate",
      href: "/auth?redirect=%2Fitem%2Fliquid-society",
      payment: null,
    })
    expect(passkeyBuyHref(LIQUID_SOCIETY_SLUG)).toBe(gate.kind === "authenticate" ? gate.href : "")
    expect(itemAuthReturnPath("/item/liquid-society")).toBe("/item/liquid-society")
    expect(itemAuthReturnPath("https://evil.example/item/liquid-society")).toBeNull()
    expect(itemAuthReturnPath("//item/liquid-society")).toBeNull()
  })

  it("reads ordinary USDC and shows the shortfall without building a payment", () => {
    const payload = {
      displayWalletUsdc: 5,
      totalDisplayUsdcBalance: 20,
      giveawayUsdc: 15,
    }
    const ordinary = ordinaryUsdcFromBalance(payload)
    expect(ordinary).toBe(5)
    expect(ordinary).not.toBe(payload.totalDisplayUsdcBalance)
    expect(ordinary).not.toBe(payload.giveawayUsdc)

    const gate = decideBuy({ ...base, hasSession: true, balanceKnown: true, ordinaryUsdc: ordinary })
    expect(gate.kind).toBe("shortfall")
    if (gate.kind !== "shortfall") return
    expect(gate.shortfallLabel).toBe("Faltan 7 USDC")
    expect(gate.depositLabel).toBe("Depositar")
    expect(gate.depositHref).toBe("/home")
    expect(gate.payment).toBeNull()
    expect(gate.buyDisabled).toBe(true)

    const item = getMerchItem(LIQUID_SOCIETY_SLUG)
    if (!item) throw new Error("missing seed")
    const html = renderToStaticMarkup(
      createElement(ItemPageView, {
        model: buildItemPageModel({
          item: { ...item, priceUsdc: "12" },
          language: "es",
          remaining: 4,
        }),
        gate,
      }),
    )
    expect(html).toContain("Faltan 7 USDC")
    expect(html).toContain("Depositar")
    expect(html).toContain('href="/home"')
    expect(html).toContain('disabled=""')
    expect(html).not.toContain("<form")
  })

  it("blocks Buy on a network mismatch and builds no payment", () => {
    const gate = decideBuy({
      ...base,
      hasSession: true,
      balanceKnown: true,
      ordinaryUsdc: 100,
      walletNetwork: "mainnet",
      language: "en",
    })
    expect(gate).toMatchObject({
      kind: "network",
      networkLabel: "Your wallet is on a different network.",
      buyDisabled: true,
      payment: null,
    })

    const item = getMerchItem(LIQUID_SOCIETY_SLUG)
    if (!item) throw new Error("missing seed")
    const html = renderToStaticMarkup(
      createElement(ItemPageView, {
        model: buildItemPageModel({
          item: { ...item, priceUsdc: "12" },
          language: "en",
          remaining: 4,
        }),
        gate,
      }),
    )
    expect(html).toContain("Your wallet is on a different network.")
    expect(html).toContain('disabled=""')
    expect(html).not.toContain("Deposit")
    expect(html).not.toContain("<form")
  })
})
