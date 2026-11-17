import { describe, expect, it } from "vitest"
import {
  FIVE_PANEL_SLUG,
  LIQUID_SOCIETY_ACTIVATION_SLUG,
  LIQUID_SOCIETY_DROP,
  LIQUID_SOCIETY_SLUG,
  LIQUID_SOCIETY_SOUVENIR_SLUG,
  getMerchItem,
  listActivations,
  listCollectibleSouvenirs,
  listMerchItems,
  merchItemPath,
} from "./catalog"

describe("merch catalog", () => {
  it("records the shirt and the 5-panel, and nothing else", () => {
    expect(listMerchItems().map((item) => item.slug)).toEqual([LIQUID_SOCIETY_SLUG, FIVE_PANEL_SLUG])

    expect(getMerchItem(LIQUID_SOCIETY_SLUG)).toMatchObject({
      slug: LIQUID_SOCIETY_SLUG,
      name: "T-shirt",
      imagePath: "/merch/liquid-society.svg",
      priceUsdc: "15",
      preMintSupply: 10,
      drop: LIQUID_SOCIETY_DROP,
      network: "testnet",
      contractId: null,
      distributorAddress: null,
    })

    expect(getMerchItem(FIVE_PANEL_SLUG)).toMatchObject({
      slug: FIVE_PANEL_SLUG,
      name: "5-panel",
      imagePath: "/merch/five-panel.svg",
      priceUsdc: "8",
      preMintSupply: null,
      drop: LIQUID_SOCIETY_DROP,
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
    expect(merchItemPath(FIVE_PANEL_SLUG)).toBe("/item/five-panel")
  })

  it("offers Liquid Society as one activation, with the shirt, the 5-panel, and a souvenir", () => {
    expect(listActivations()).toEqual([
      {
        slug: LIQUID_SOCIETY_ACTIVATION_SLUG,
        name: "Liquid Society",
        drop: LIQUID_SOCIETY_DROP,
        imagePath: "/merch/liquid-society-event.svg",
        itemSlugs: [LIQUID_SOCIETY_SLUG, FIVE_PANEL_SLUG],
        souvenir: {
          slug: LIQUID_SOCIETY_SOUVENIR_SLUG,
          name: "Collectible Souvenir",
          drop: LIQUID_SOCIETY_DROP,
          imagePath: "/merch/liquid-society-souvenir.svg",
          claimStartsAt: "2026-11-17T00:00:00.000-03:00",
          claimEndsAt: "2026-11-19T00:00:00.000-03:00",
        },
      },
    ])
    expect(listCollectibleSouvenirs()).toEqual([listActivations()[0]?.souvenir])
  })

  it("returns null for an unknown slug", () => {
    expect(getMerchItem("missing")).toBeNull()
  })
})
