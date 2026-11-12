import { describe, expect, it } from "vitest"
import {
  LIQUID_SOCIETY_SLUG,
  UNRECORDED_PRICE_USDC,
  getMerchItem,
  merchItemPath,
} from "./catalog"

describe("merch catalog", () => {
  it("seeds one Liquid Society item with the fields the page reads", () => {
    const item = getMerchItem(LIQUID_SOCIETY_SLUG)
    expect(item).toMatchObject({
      slug: LIQUID_SOCIETY_SLUG,
      name: "Liquid Society",
      imagePath: "/merch/liquid-society.svg",
      priceUsdc: UNRECORDED_PRICE_USDC,
      drop: "Liquid Society · 18 Nov 2026",
      network: "testnet",
      contractId: null,
      distributorAddress: null,
    })
  })

  it("gives NFC and QR the same item URL", () => {
    const nfc = merchItemPath(LIQUID_SOCIETY_SLUG)
    const qr = merchItemPath("  Liquid-Society  ")
    expect(nfc).toBe("/item/liquid-society")
    expect(qr).toBe(nfc)
  })

  it("returns null for an unknown slug", () => {
    expect(getMerchItem("missing")).toBeNull()
  })
})
