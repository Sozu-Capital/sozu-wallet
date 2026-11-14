import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { CollectionsPanelView } from "@/components/merch/collections-panel-view"
import { getMerchItem, LIQUID_SOCIETY_SLUG } from "@/lib/merch/catalog"
import { buildCollectibleReceipt } from "@/lib/merch/receipt"

const discover = {
  nearLabel: "Cerca de ti",
  cityLabel: "En la ciudad",
  findItems: [
    {
      href: "/item/liquid-society",
      name: "Liquid Society",
      drop: "Liquid Society · 18 Nov 2026",
      imageUrl: "/merch/liquid-society.svg",
      priceLabel: null,
    },
  ],
  cityDots: [
    { id: "1", name: "Pandevilla", href: "/city/spot/1", x: 36, y: 78 },
    { id: "4", name: "Charlie Wok", href: "/city/spot/4", x: 54, y: 22 },
  ],
}

describe("collections panel", () => {
  it("offers active collectibles and the city dots when the wallet holds nothing", () => {
    const html = renderToStaticMarkup(
      createElement(CollectionsPanelView, {
        title: "Colecciones",
        ...discover,
        previousLabel: "Anterior",
        nextLabel: "Siguiente",
        cards: [],
      }),
    )
    expect(html).toContain("Colecciones")
    expect(html).toContain("Cerca de ti")
    expect(html).toContain("Liquid Society")
    expect(html).toContain('href="/item/liquid-society"')
    expect(html).toContain("Ver")
    expect(html).toContain("En la ciudad")
    expect(html).toContain('href="/city"')
    expect(html).toContain("Pandevilla")
    expect(html).toContain('href="/city/spot/1"')
    expect(html).toContain("Charlie Wok")
    expect(html).not.toContain("Todavía no tienes coleccionables.")
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
        ...discover,
        previousLabel: "Anterior",
        nextLabel: "Siguiente",
        cards: [{ slug: item.slug, receipt }],
      }),
    )
    expect(html).toContain("Shirt")
    expect(html).toContain("12 USDC")
    expect(html).toContain("Red de pruebas")
    expect(html).toContain("Este coleccionable es un comprobante de compra. No es una inversión ni representa fondos.")
    expect(html).not.toContain("Cerca de ti")
    expect(html).not.toContain("Pandevilla")
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
      ...discover,
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
