import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ItemPageView } from "@/components/merch/item-page-view"
import { getMerchItem, LIQUID_SOCIETY_SLUG } from "@/lib/merch/catalog"
import { buildItemPageModel } from "@/lib/merch/item-page"

function markup(language: "es" | "en", remaining: number | null) {
  const item = getMerchItem(LIQUID_SOCIETY_SLUG)
  if (!item) throw new Error("missing seed")
  const model = buildItemPageModel({
    item: { ...item, priceUsdc: "12" },
    language,
    remaining,
  })
  return { model, html: renderToStaticMarkup(createElement(ItemPageView, { model })) }
}

describe("item page", () => {
  it("shows the name, image, price, receipt line, and testnet label", () => {
    const { html } = markup("es", 4)
    expect(html).toContain("Liquid Society")
    expect(html).toContain("/merch/liquid-society.svg")
    expect(html).toContain("12 USDC")
    expect(html).toContain("Recibirás un coleccionable digital como comprobante de compra.")
    expect(html).toContain("Red de pruebas")
    expect(html).toContain("Comprar · 12 USDC")
    expect(html).not.toContain('disabled=""')
  })

  it("uses the English strings when the wallet language is English", () => {
    const { html } = markup("en", 4)
    expect(html).toContain("Buy · 12 USDC")
    expect(html).toContain("You will receive a digital collectible as your proof of purchase.")
    expect(html).toContain("Testnet")
  })

  it("disables Buy when the item is sold out and builds no payment", () => {
    const { model, html } = markup("es", 0)
    expect(model.soldOut).toBe(true)
    expect(model.buyDisabled).toBe(true)
    expect(model.payment).toBeNull()
    expect(html).toContain("Agotado")
    expect(html).toContain('disabled=""')
    expect(html).not.toContain("<form")
    expect(html).not.toContain("action=")
  })
})
