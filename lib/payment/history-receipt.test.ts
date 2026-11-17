import { describe, expect, it } from "vitest"
import type { Transaction } from "@/hooks/use-wallet-data"
import {
  historyReceiptForPurchase,
  historyReceiptForTransaction,
} from "@/lib/payment/history-receipt"

const hash = "a".repeat(64)
const wallet = "G".padEnd(56, "A")
const merchant = "G".padEnd(56, "B")

function payment(overrides?: Partial<Transaction>): Transaction {
  return {
    id: hash,
    hash,
    createdAt: "2026-11-14T04:00:00.000Z",
    successful: true,
    memo: null,
    operations: [
      {
        type: "payment",
        from: wallet,
        to: merchant,
        amount: 15,
        asset: "USDC",
      },
    ],
    ...overrides,
  }
}

describe("history receipt", () => {
  it("opens the same simple confirmation for a peer payment", () => {
    const view = historyReceiptForTransaction({
      tx: payment(),
      walletAddress: wallet,
      walletNetwork: "testnet",
      addressToTagMap: {},
      saved: [],
      language: "en",
    })
    expect(view?.kind).toBe("simple")
    if (view?.kind === "simple") {
      expect(view.receipt.amount).toBe(15)
      expect(view.receipt.transactionHash).toBe(hash)
    }
  })

  it("opens a collectible receipt for a product and a simple receipt for a drink", () => {
    const shirt = historyReceiptForTransaction({
      tx: payment(),
      walletAddress: wallet,
      walletNetwork: "testnet",
      addressToTagMap: {},
      saved: [
        {
          hash,
          merchantName: "UNBLCK",
          itemName: "Shirt",
          amount: "15.00",
          createdAt: "2026-11-14T04:00:00.000Z",
          collectible: true,
        },
      ],
      language: "en",
    })
    expect(shirt?.kind).toBe("collectible")
    if (shirt?.kind === "collectible") {
      expect(shirt.receipt.itemName).toBe("Shirt")
      expect(shirt.receipt.drop).toBe("UNBLCK")
    }

    const drink = historyReceiptForPurchase({
      purchase: {
        hash: "b".repeat(64),
        merchantName: "Cafe",
        itemName: "House latte",
        amount: "4.50",
        createdAt: "2026-11-14T04:00:00.000Z",
        collectible: false,
      },
      walletNetwork: "testnet",
      language: "en",
    })
    expect(drink.kind).toBe("simple")
    if (drink.kind === "simple") {
      expect(drink.receipt.amount).toBe(4.5)
      expect(drink.receipt.toLabel).toBe("Cafe")
    }
  })
})
