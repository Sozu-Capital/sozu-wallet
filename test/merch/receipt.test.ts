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
  it("shows the purchase line, both explorer links, the disclaimer, and the testnet label", () => {
    const receipt = model("es", TRANSFER)
    const line = renderToStaticMarkup(createElement(PurchaseLine, { model: receipt }))
    const card = renderToStaticMarkup(createElement(CollectibleReceipt, { model: receipt }))

    expect(line).toContain("Compra · Shirt")
    expect(line).toContain("12 USDC")
    expect(line).toContain("Completada")
    expect(card).toContain("Shirt")
    expect(card).toContain("12 USDC")
    expect(card).toContain("Liquid Society · 18 Nov 2026")
    expect(card).toContain("2026-11-18 22:00 UTC")
    expect(card).toContain("Red de pruebas")
    expect(card).toContain("Este coleccionable es un comprobante de compra. No es una inversión ni representa fondos.")
    expect(card).toContain(`https://stellar.expert/explorer/testnet/tx/${PAYMENT}`)
    expect(card).toContain(`https://stellar.expert/explorer/testnet/tx/${TRANSFER}`)
  })

  it("uses English when the wallet language is English", () => {
    const receipt = model("en", TRANSFER)
    const card = renderToStaticMarkup(createElement(CollectibleReceipt, { model: receipt }))
    expect(receipt.line).toBe("Purchase · Shirt")
    expect(card).toContain("Testnet")
    expect(card).toContain("This collectible is a proof of purchase. It is not an investment and does not represent funds.")
    expect(card).toContain("Completed")
  })

  it("shows receipt pending when the order is paid and the transfer hash is missing", () => {
    const receipt = model("es", null, "paid")
    const card = renderToStaticMarkup(createElement(CollectibleReceipt, { model: receipt }))
    expect(receipt.receiptPending).toBe(true)
    expect(card).toContain("Comprobante en camino")
    expect(card).not.toContain(`https://stellar.expert/explorer/testnet/tx/${TRANSFER}`)
    expect(card).toContain(`https://stellar.expert/explorer/testnet/tx/${PAYMENT}`)
  })
})
