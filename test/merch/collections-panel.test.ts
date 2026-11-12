import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { CollectionsPanelView } from "@/components/merch/collections-panel-view"
import { getMerchItem, LIQUID_SOCIETY_SLUG, merchItemPath } from "@/lib/merch/catalog"
import { buildCollectibleReceipt } from "@/lib/merch/receipt"

describe("collections panel", () => {
  it("shows one line and a link to the current drop when the wallet holds nothing", () => {
    const html = renderToStaticMarkup(
      createElement(CollectionsPanelView, {
        title: "Colecciones",
        emptyLabel: "Todavía no tienes coleccionables.",
        dropHref: merchItemPath(LIQUID_SOCIETY_SLUG),
        dropLabel: "Liquid Society",
        cards: [],
      }),
    )
    expect(html).toContain("Colecciones")
    expect(html).toContain("Todavía no tienes coleccionables.")
    expect(html).toContain('href="/item/liquid-society"')
  })

  it("shows the testnet label and opens the collectible receipt", () => {
    const item = getMerchItem(LIQUID_SOCIETY_SLUG)
    if (!item) throw new Error("missing seed")
    const receipt = buildCollectibleReceipt({
      item,
      language: "es",
      status: "completed",
      priceUsdc: "12",
      paymentHash: null,
      transferHash: null,
      createdAt: "2026-11-18T22:00:00.000Z",
    })
    const html = renderToStaticMarkup(
      createElement(CollectionsPanelView, {
        title: "Colecciones",
        emptyLabel: "Todavía no tienes coleccionables.",
        dropHref: merchItemPath(item.slug),
        dropLabel: item.name,
        openSlug: item.slug,
        cards: [{ slug: item.slug, name: item.name, networkLabel: "Red de pruebas", receipt }],
      }),
    )
    expect(html).toContain("Liquid Society")
    expect(html).toContain("Red de pruebas")
    expect(html).toContain("Este coleccionable es un comprobante de compra.")
    expect(html).not.toContain("Todavía no tienes coleccionables.")
  })
})
