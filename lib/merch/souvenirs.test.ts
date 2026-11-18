import { describe, expect, it } from "vitest"
import { LIQUID_SOCIETY_SOUVENIR_SLUG, listCollectibleSouvenirs } from "@/lib/merch/catalog"
import { profileSouvenirs } from "@/lib/merch/souvenirs"
import { buildCollectibleReceipt } from "@/lib/merch/receipt"

const hash = "a".repeat(64)
const DURING_EVENT = Date.parse("2026-11-18T12:00:00.000-03:00")
const AFTER_EVENT = Date.parse("2026-11-20T12:00:00.000-03:00")

describe("profile souvenirs", () => {
  it("keeps a bought 1/10 as a 3D receipt and an unclaimed event badge as something to sign for", () => {
    const { held, claimable } = profileSouvenirs({
      purchases: [
        {
          hash,
          merchantName: "Liquid Society",
          itemName: "T-shirt 1/10",
          amount: "15.00",
          createdAt: "2026-11-14T04:00:00.000Z",
          collectible: false,
          imageUrl: "https://pay.sozu.capital/shirt.png",
        },
      ],
      claims: [],
      catalog: listCollectibleSouvenirs(),
      language: "en",
      network: "testnet",
      nowMs: DURING_EVENT,
    })

    expect(claimable.map((item) => item.slug)).toEqual([LIQUID_SOCIETY_SOUVENIR_SLUG])
    expect(held).toHaveLength(1)
    expect(held[0]?.kind).toBe("receipt")
    if (held[0]?.kind === "receipt") {
      expect(held[0].name).toBe("T-shirt")
      expect(held[0].receipt.editionLabel).toBe("1/10")
      expect(held[0].receipt.itemName).toBe("T-shirt")
      expect(held[0].receipt.imageUrl).toBe("https://pay.sozu.capital/shirt.png")
    }
  })

  it("turns a signed event claim into a badge and stops offering it", () => {
    const catalog = listCollectibleSouvenirs()
    const { held, claimable } = profileSouvenirs({
      purchases: [],
      claims: [
        {
          slug: LIQUID_SOCIETY_SOUVENIR_SLUG,
          walletAddress: "C".padEnd(56, "A"),
          claimedAt: "2026-11-18T22:00:00.000Z",
        },
      ],
      catalog,
      language: "es",
      network: "testnet",
      nowMs: DURING_EVENT,
    })

    expect(claimable).toEqual([])
    expect(held).toEqual([
      {
        kind: "badge",
        id: `badge:${LIQUID_SOCIETY_SOUVENIR_SLUG}`,
        name: "Collectible Souvenir",
        drop: catalog[0]?.drop,
        imagePath: "/merch/liquid-society-souvenir.svg",
      },
    ])
  })

  it("keeps a claimed badge forever after the window closes, and will not offer a second claim", () => {
    const catalog = listCollectibleSouvenirs()
    const claimed = profileSouvenirs({
      purchases: [],
      claims: [
        {
          slug: LIQUID_SOCIETY_SOUVENIR_SLUG,
          walletAddress: "C".padEnd(56, "A"),
          claimedAt: "2026-11-18T22:00:00.000Z",
          name: "Collectible Souvenir",
          drop: catalog[0]?.drop,
          imagePath: "/merch/liquid-society-souvenir.svg",
        },
      ],
      catalog,
      language: "en",
      network: "testnet",
      nowMs: AFTER_EVENT,
    })
    expect(claimed.claimable).toEqual([])
    expect(claimed.held).toHaveLength(1)
    expect(claimed.held[0]).toMatchObject({
      kind: "badge",
      id: `badge:${LIQUID_SOCIETY_SOUVENIR_SLUG}`,
      name: "Collectible Souvenir",
    })

    const missed = profileSouvenirs({
      purchases: [],
      claims: [],
      catalog,
      language: "en",
      network: "testnet",
      nowMs: AFTER_EVENT,
    })
    expect(missed.claimable).toEqual([])
    expect(missed.held).toEqual([])
  })

  it("does not invent a receipt image for the badge model", () => {
    const receipt = buildCollectibleReceipt({
      item: { name: "T-shirt", drop: "Liquid Society", network: "testnet" },
      language: "en",
      status: "paid",
      priceUsdc: "15",
      paymentHash: hash,
      transferHash: null,
      edition: { number: 1, size: 10 },
    })
    expect(receipt.editionLabel).toBe("1/10")
  })
})
