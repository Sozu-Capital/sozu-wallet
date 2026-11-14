import { describe, expect, it } from "vitest"
import { Asset, Keypair, Networks } from "@stellar/stellar-sdk"
import { TRANSFER_TOPIC_COUNT, transferEventFilters } from "@/lib/stellar/soroban-event-filter"
import { purchasePlaceholderReceipts } from "@/lib/merch/purchase-receipts"

const wallet = new Asset("USDC", Keypair.random().publicKey()).contractId(Networks.TESTNET)
const merchant = Keypair.random().publicKey()
const hash = "a".repeat(64)

describe("USDC transfer event filter", () => {
  it("matches the four-topic Circle transfer, including payments sent and received", () => {
    const filters = transferEventFilters(new Asset("USD", Keypair.random().publicKey()).contractId(Networks.TESTNET), wallet)
    expect(filters).toHaveLength(2)
    expect(filters[0].topics[0]).toHaveLength(TRANSFER_TOPIC_COUNT)
    expect(filters[1].topics[0]).toHaveLength(TRANSFER_TOPIC_COUNT)
    expect(filters[0].topics[0][2]).toBe("*")
    expect(filters[1].topics[0][1]).toBe("*")
    expect(filters[0].topics[0][1]).not.toBe("*")
  })
})

describe("purchase placeholder receipts", () => {
  it("shows an outgoing USDC payment as a collectible that is still on its way", () => {
    const cards = purchasePlaceholderReceipts({
      wallet,
      transfers: [
        {
          hash,
          createdAt: "2026-11-14T04:00:00.000Z",
          from: wallet,
          to: merchant,
          amount: 8,
          asset: "USDC",
        },
      ],
      saved: [
        {
          hash,
          merchantName: "UNBLCK",
          itemName: "Polera UNBLCK Drop-002",
          amount: "8.00",
          createdAt: "2026-11-14T04:00:00.000Z",
        },
      ],
      language: "en",
      network: "testnet",
    })
    expect(cards).toHaveLength(1)
    expect(cards[0].receipt.itemName).toBe("Polera UNBLCK Drop-002")
    expect(cards[0].receipt.drop).toBe("UNBLCK")
    expect(cards[0].receipt.price).toBe("8.00")
    expect(cards[0].receipt.receiptPending).toBe(true)
    expect(cards[0].receipt.statusLabel).toBe("Receipt pending")
  })

  it("ignores incoming transfers and uses a placeholder name when the item was not saved", () => {
    const cards = purchasePlaceholderReceipts({
      wallet,
      transfers: [
        {
          hash: "b".repeat(64),
          createdAt: "2026-11-14T04:00:00.000Z",
          from: merchant,
          to: wallet,
          amount: 8,
          asset: "USDC",
        },
        {
          hash: "c".repeat(64),
          createdAt: "2026-11-14T05:00:00.000Z",
          from: wallet.toLowerCase(),
          to: merchant,
          amount: 3,
          asset: "USDC",
        },
      ],
      saved: [],
      language: "es",
      network: "testnet",
    })
    expect(cards).toHaveLength(1)
    expect(cards[0].receipt.itemName).toBe("Comprobante de compra")
    expect(cards[0].receipt.price).toBe("3.00")
    expect(cards[0].receipt.statusLabel).toBe("Comprobante en camino")
  })
})
