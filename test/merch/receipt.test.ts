import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { CollectibleReceipt, PurchaseLine } from "@/components/merch/collectible-receipt"
import { getMerchItem, LIQUID_SOCIETY_SLUG } from "@/lib/merch/catalog"
import { buildCollectibleReceipt } from "@/lib/merch/receipt"

const PAYMENT = "a".repeat(64)
const TRANSFER = "b".repeat(64)

function model(language: "es" | "en", transferHash: string | null, status: "paid" | "completed" | "failed" = "completed") {
  const item = getMerchItem(LIQUID_SOCIETY_SLUG)
  if (!item) throw new Error("missing seed")
  return buildCollectibleReceipt({
    item,
    language,
    status,
    priceUsdc: "12",
    paymentHash: PAYMENT,
    transferHash,
    createdAt: "2026-11-18T22:00:00.000Z",
  })
}

describe("collectible receipt", () => {
  it("shows the purchase line, and the card stops at the timestamp with a share button", () => {
    const receipt = model("es", TRANSFER)
    const line = renderToStaticMarkup(createElement(PurchaseLine, { model: receipt }))
    const card = renderToStaticMarkup(createElement(CollectibleReceipt, { model: receipt }))

    expect(line).toContain("Compra · T-shirt")
    expect(line).toContain("12 USDC")
    expect(line).toContain("Completada")
    expect(card).toContain('data-product="shirt"')
    expect(card).toContain("bg-black/90")
    expect(card).toContain("T-shirt")
    expect(card).toContain("12 USDC")
    expect(card).toContain("Liquid Society · 18 Nov 2026")
    expect(card).toContain("2026-11-18 22:00 UTC")
    expect(card).toContain("Compartir")
    expect(card).not.toContain("Red de pruebas")
    expect(card).not.toContain("Este coleccionable es un comprobante de compra")
    expect(card).not.toContain("stellar.expert")
    expect(receipt.paymentUrl).toContain(PAYMENT)
    expect(receipt.transferUrl).toContain(TRANSFER)
    expect(receipt.disclaimer).toContain("fondos")
  })

  it("uses English when the wallet language is English", () => {
    const receipt = model("en", TRANSFER)
    const card = renderToStaticMarkup(createElement(CollectibleReceipt, { model: receipt }))
    expect(receipt.line).toBe("Purchase · T-shirt")
    expect(card).toContain("Share")
    expect(card).not.toContain("Testnet")
    expect(card).not.toContain("This collectible is a proof of purchase")
    expect(card).not.toContain("Completed")
  })

  it("prints the shirt number from a shared edition", () => {
    const item = getMerchItem(LIQUID_SOCIETY_SLUG)
    if (!item) throw new Error("missing seed")
    const receipt = buildCollectibleReceipt({
      item,
      language: "en",
      status: "paid",
      priceUsdc: "15",
      paymentHash: PAYMENT,
      transferHash: null,
      createdAt: "2026-11-18T22:00:00.000Z",
      edition: { number: 6, size: 10 },
    })
    const card = renderToStaticMarkup(createElement(CollectibleReceipt, { model: receipt }))
    expect(receipt.line).toBe("Purchase · T-shirt · 6/10")
    expect(receipt.editionLabel).toBe("6/10")
    expect(card).toContain('data-edition="6/10"')
  })

  it("shows the merchant photo instead of the 3D placeholder", () => {
    const item = getMerchItem(LIQUID_SOCIETY_SLUG)
    if (!item) throw new Error("missing seed")
    const photo = "https://dev.pay.sozu.capital/api/public/stores/org/items/tee/image"
    const receipt = buildCollectibleReceipt({
      item,
      language: "en",
      status: "paid",
      priceUsdc: "15",
      paymentHash: PAYMENT,
      transferHash: null,
      createdAt: "2026-11-18T22:00:00.000Z",
      imageUrl: photo,
    })
    const card = renderToStaticMarkup(createElement(CollectibleReceipt, { model: receipt }))
    expect(card).toContain(`src="${photo}"`)
    expect(card).toContain("data-product-photo")
    expect(card).not.toContain('data-product="shirt"')
  })

  it("keeps a JPEG data URL from the SozuPay payment-link row", () => {
    const item = getMerchItem(LIQUID_SOCIETY_SLUG)
    if (!item) throw new Error("missing seed")
    const photo = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBD"
    const receipt = buildCollectibleReceipt({
      item,
      language: "en",
      status: "paid",
      priceUsdc: "15",
      paymentHash: PAYMENT,
      transferHash: null,
      createdAt: "2026-11-18T22:00:00.000Z",
      imageUrl: photo,
    })
    expect(receipt.imageUrl).toBe(photo)
  })

  it("shows receipt pending when the order is paid and the transfer hash is missing", () => {
    const receipt = model("es", null, "paid")
    const card = renderToStaticMarkup(createElement(CollectibleReceipt, { model: receipt }))
    expect(receipt.receiptPending).toBe(true)
    expect(receipt.statusLabel).toBe("Comprobante en camino")
    expect(card).not.toContain("Comprobante en camino")
    expect(card).not.toContain("stellar.expert")
    expect(receipt.paymentUrl).toContain(PAYMENT)
    expect(receipt.transferUrl).toBeNull()
  })
})
