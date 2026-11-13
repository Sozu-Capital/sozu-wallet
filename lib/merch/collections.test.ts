import { describe, expect, it } from "vitest"
import type { MerchItemRecord } from "@/lib/merch/catalog"
import { heldCollectibleSlugs, receiptsForHoldings, stepReceipt } from "@/lib/merch/collections"
import { panelIndex, panelAuthReturnPath } from "@/lib/shell/panels"

const ITEM = `C${"A".repeat(55)}`
const OTHER = `C${"B".repeat(55)}`

describe("collectible holdings", () => {
  it("maps a registered contract balance to a card and ignores an unknown token", () => {
    const slugs = heldCollectibleSlugs(
      [
        { slug: "liquid-society", contractId: ITEM },
        { slug: "unrecorded", contractId: null },
      ],
      { [ITEM]: 1, [OTHER]: 4 },
    )
    expect(slugs).toEqual(["liquid-society"])
  })

  it("treats a zero balance and a failed read as not held", () => {
    expect(
      heldCollectibleSlugs([{ slug: "liquid-society", contractId: ITEM }], { [ITEM]: 0 }),
    ).toEqual([])
    expect(
      heldCollectibleSlugs([{ slug: "liquid-society", contractId: ITEM }], { [ITEM]: null }),
    ).toEqual([])
  })
})

describe("collection receipts", () => {
  const society: MerchItemRecord = {
    slug: "liquid-society",
    name: "Liquid Society",
    imagePath: "/merch/liquid-society.svg",
    priceUsdc: "12",
    drop: "Liquid Society · 18 Nov 2026",
    network: "testnet",
    contractId: ITEM,
    distributorAddress: null,
  }
  const cap: MerchItemRecord = {
    slug: "five-panel",
    name: "Five Panel",
    imagePath: "/merch/five-panel.svg",
    priceUsdc: "40",
    drop: "Streetwear · 18 Nov 2026",
    network: "testnet",
    contractId: OTHER,
    distributorAddress: null,
  }

  it("puts streetwear and the event item in one sequence, joined to each order", () => {
    const slugs = heldCollectibleSlugs([society, cap], { [ITEM]: 1, [OTHER]: 1 })
    const receipts = receiptsForHoldings(
      [society, cap],
      slugs,
      [
        {
          slug: "five-panel",
          status: "paid",
          priceUsdc: "40",
          paymentHash: "c".repeat(64),
          transferHash: null,
          createdAt: "2026-11-18T23:00:00.000Z",
        },
        {
          slug: "liquid-society",
          status: "failed",
          priceUsdc: "1",
          paymentHash: null,
          transferHash: null,
          createdAt: "2026-11-18T21:00:00.000Z",
        },
        {
          slug: "liquid-society",
          status: "completed",
          priceUsdc: "12",
          paymentHash: "a".repeat(64),
          transferHash: "b".repeat(64),
          createdAt: "2026-11-18T22:00:00.000Z",
        },
      ],
      "es",
    )
    expect(receipts.map((card) => card.slug)).toEqual(["liquid-society", "five-panel"])
    expect(receipts[0]?.receipt.itemName).toBe("Liquid Society")
    expect(receipts[0]?.receipt.price).toBe("12")
    expect(receipts[0]?.receipt.statusLabel).toBe("Completada")
    expect(receipts[0]?.receipt.disclaimer).toContain("comprobante de compra")
    expect(receipts[1]?.receipt.itemName).toBe("Five Panel")
    expect(receipts[1]?.receipt.drop).toBe("Streetwear · 18 Nov 2026")
    expect(receipts[1]?.receipt.statusLabel).toBe("Comprobante en camino")
    expect(receipts[1]?.receipt.networkLabel).toBe("Red de pruebas")
  })
})

describe("receipt swipe", () => {
  it("moves to the next receipt and leaves the panel only from the first one", () => {
    expect(stepReceipt(0, 2, "next")).toEqual({ index: 1, leave: false })
    expect(stepReceipt(1, 2, "next")).toEqual({ index: 1, leave: false })
    expect(stepReceipt(1, 2, "previous")).toEqual({ index: 0, leave: false })
    expect(stepReceipt(0, 2, "previous")).toEqual({ index: 0, leave: true })
    expect(stepReceipt(0, 1, "next")).toEqual({ index: 0, leave: false })
    expect(stepReceipt(0, 1, "previous")).toEqual({ index: 0, leave: true })
  })
})

describe("panel deep link", () => {
  it("opens collections from the collections panel name", () => {
    expect(panelIndex("collections")).toBe(3)
    expect(panelIndex("history")).toBe(2)
    expect(panelIndex("nope")).toBe(1)
    expect(panelAuthReturnPath("/home?panel=collections")).toBe("/home?panel=collections")
    expect(panelAuthReturnPath("/item/liquid-society")).toBeNull()
  })
})
