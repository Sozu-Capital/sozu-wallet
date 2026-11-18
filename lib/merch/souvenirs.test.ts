import { describe, expect, it } from "vitest"
import { profileSouvenirs } from "@/lib/merch/souvenirs"
import { buildCollectibleReceipt } from "@/lib/merch/receipt"
import type { CollectibleSouvenir } from "@/lib/merch/catalog"

const hash = "a".repeat(64)
const DURING_EVENT = Date.parse("2026-11-18T12:00:00.000-03:00")
const AFTER_EVENT = Date.parse("2026-11-20T12:00:00.000-03:00")
const PHOTO = "https://dev.pay.sozu.capital/api/public/stores/org/items/tee/image"

const DROP: CollectibleSouvenir = {
  slug: "noche-pizza-abc123",
  name: "Noche Pizza",
  drop: "Da Bruno",
  imagePath: "data:image/jpeg;base64,aaaa",
  claimStartsAt: "2026-11-17T00:00:00.000-03:00",
  claimEndsAt: "2026-11-19T00:00:00.000-03:00",
}

describe("profile souvenirs", () => {
  it("keeps a bought 1/10 as a receipt with the merchant photo, and an unclaimed launch as something to sign for", () => {
    const { held, claimable } = profileSouvenirs({
      purchases: [
        {
          hash,
          merchantName: "UNBLCK",
          itemName: "T-shirt 1/10",
          amount: "15.00",
          createdAt: "2026-11-14T04:00:00.000Z",
          collectible: true,
          imageUrl: PHOTO,
        },
      ],
      claims: [],
      catalog: [DROP],
      language: "en",
      network: "testnet",
      nowMs: DURING_EVENT,
    })

    expect(claimable.map((item) => item.slug)).toEqual([DROP.slug])
    expect(held).toHaveLength(1)
    expect(held[0]?.kind).toBe("receipt")
    if (held[0]?.kind === "receipt") {
      expect(held[0].name).toBe("T-shirt")
      expect(held[0].receipt.editionLabel).toBe("1/10")
      expect(held[0].receipt.itemName).toBe("T-shirt")
      expect(held[0].receipt.imageUrl).toBe(PHOTO)
    }
  })

  it("turns a signed event claim into a badge and stops offering it", () => {
    const { held, claimable } = profileSouvenirs({
      purchases: [],
      claims: [
        {
          slug: DROP.slug,
          walletAddress: "C".padEnd(56, "A"),
          claimedAt: "2026-11-18T22:00:00.000Z",
        },
      ],
      catalog: [DROP],
      language: "es",
      network: "testnet",
      nowMs: DURING_EVENT,
    })

    expect(claimable).toEqual([])
    expect(held).toEqual([
      {
        kind: "badge",
        id: `badge:${DROP.slug}`,
        name: DROP.name,
        drop: DROP.drop,
        imagePath: DROP.imagePath,
      },
    ])
  })

  it("keeps a claimed badge forever after the window closes, and will not offer a second claim", () => {
    const claimed = profileSouvenirs({
      purchases: [],
      claims: [
        {
          slug: DROP.slug,
          walletAddress: "C".padEnd(56, "A"),
          claimedAt: "2026-11-18T22:00:00.000Z",
          name: DROP.name,
          drop: DROP.drop,
          imagePath: DROP.imagePath,
        },
      ],
      catalog: [DROP],
      language: "en",
      network: "testnet",
      nowMs: AFTER_EVENT,
    })
    expect(claimed.claimable).toEqual([])
    expect(claimed.held).toHaveLength(1)
    expect(claimed.held[0]).toMatchObject({
      kind: "badge",
      id: `badge:${DROP.slug}`,
      name: DROP.name,
    })

    const missed = profileSouvenirs({
      purchases: [],
      claims: [],
      catalog: [DROP],
      language: "en",
      network: "testnet",
      nowMs: AFTER_EVENT,
    })
    expect(missed.claimable).toEqual([])
    expect(missed.held).toEqual([])
  })

  it("does not invent a receipt image when the purchase had none", () => {
    const receipt = buildCollectibleReceipt({
      item: { name: "T-shirt", drop: "UNBLCK", network: "testnet" },
      language: "en",
      status: "paid",
      priceUsdc: "15",
      paymentHash: hash,
      transferHash: null,
      edition: { number: 1, size: 10 },
    })
    expect(receipt.editionLabel).toBe("1/10")
    expect(receipt.imageUrl).toBeNull()
  })
})
