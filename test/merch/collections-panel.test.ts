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
        previousLabel: "Anterior",
        nextLabel: "Siguiente",
        cards: [],
      }),
    )
    expect(html).toContain("Colecciones")
    expect(html).toContain("Todavía no tienes coleccionables.")
    expect(html).toContain('href="/item/liquid-society"')
  })

  it("shows the receipt in front, including the testnet label and the disclaimer", () => {
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
        previousLabel: "Anterior",
        nextLabel: "Siguiente",
        cards: [{ slug: item.slug, receipt }],
      }),
    )
    expect(html).toContain("Liquid Society")
    expect(html).toContain("12 USDC")
    expect(html).toContain("Red de pruebas")
    expect(html).toContain("Este coleccionable es un comprobante de compra. No es una inversión ni representa fondos.")
    expect(html).not.toContain("Todavía no tienes coleccionables.")
  })

  it("shows only the receipt in front when the wallet holds more than one physical item", () => {
    const item = getMerchItem(LIQUID_SOCIETY_SLUG)
    if (!item) throw new Error("missing seed")
    const society = buildCollectibleReceipt({
      item,
      language: "es",
      status: "completed",
      priceUsdc: "12",
      paymentHash: null,
      transferHash: null,
      createdAt: "2026-11-18T22:00:00.000Z",
    })
    const cap = buildCollectibleReceipt({
      item: { ...item, name: "Five Panel", drop: "Streetwear · 18 Nov 2026" },
      language: "es",
      status: "completed",
      priceUsdc: "40",
      paymentHash: null,
      transferHash: null,
      createdAt: "2026-11-18T23:00:00.000Z",
    })
    const shared = {
      title: "Colecciones",
      emptyLabel: "Todavía no tienes coleccionables.",
      dropHref: merchItemPath(item.slug),
      dropLabel: item.name,
      previousLabel: "Anterior",
      nextLabel: "Siguiente",
      cards: [
        { slug: item.slug, receipt: society },
        { slug: "five-panel", receipt: cap },
      ],
    }
    const front = renderToStaticMarkup(createElement(CollectionsPanelView, { ...shared, activeIndex: 0 }))
    expect(front).toContain('data-receipt-slug="liquid-society"')
    expect(front).toContain("12 USDC")
    expect(front).toContain("Este coleccionable es un comprobante de compra.")
    expect(front).not.toContain("40 USDC")
    expect(front).not.toContain("Five Panel")

    const next = renderToStaticMarkup(createElement(CollectionsPanelView, { ...shared, activeIndex: 1 }))
    expect(next).toContain('data-receipt-slug="five-panel"')
    expect(next).toContain("Five Panel")
    expect(next).toContain("Streetwear · 18 Nov 2026")
    expect(next).toContain("40 USDC")
    expect(next).toContain("Este coleccionable es un comprobante de compra.")
    expect(next).not.toContain("12 USDC")
  })
})
