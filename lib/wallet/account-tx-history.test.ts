import { describe, expect, it } from "vitest"
import {
  FAUCET_COUNTERPARTY,
  FAUCET_HISTORY_MEMO,
  faucetClaimToHistory,
  mergeAccountHistory,
  type AccountHistoryTx,
} from "./account-tx-history"
import { readCachedTxHistory, writeCachedTxHistory } from "./cached-tx-history"

const FRANK = "CDJVGT46QLTXLWY6GNWJ2UZOAWONZILHBKCF64E4AEEQRH3G4BA4AZ3F"
const OTHER = "CCJY33SGQ3VNQN52XLGSKFUDMTW4VG57527CFLQNSJKLLNRZVDDT2KGZ"
const TREASURY = "GCFNUCUJ7WU32XGBP5A6GPDUYABQ7EXYBMSK7OEZG4YESBNNVG5BGTMJ"
const PAYMENT_HASH = "ab".repeat(32)
const CLAIM_HASH = "cd".repeat(32)

function payment(input: {
  hash: string
  from: string
  to: string
  amount: number
  createdAt: string
  memo?: string | null
}): AccountHistoryTx {
  return {
    id: input.hash,
    hash: input.hash,
    createdAt: input.createdAt,
    successful: true,
    memo: input.memo ?? null,
    operations: [
      {
        type: "payment",
        from: input.from,
        to: input.to,
        amount: input.amount,
        asset: "USDC",
      },
    ],
  }
}

function memoryStorage() {
  const rows = new Map<string, string>()
  return {
    getItem: (key: string) => rows.get(key) ?? null,
    setItem: (key: string, value: string) => {
      rows.set(key, value)
    },
  }
}

describe("mergeAccountHistory", () => {
  it("keeps remembered payments when the chain scan is empty", () => {
    const remembered = [
      payment({
        hash: PAYMENT_HASH,
        from: TREASURY,
        to: FRANK,
        amount: 10,
        createdAt: "2026-11-08T12:00:00.000Z",
      }),
    ]
    const merged = mergeAccountHistory({
      walletAddress: FRANK,
      remembered,
      chain: [],
      faucet: [],
    })
    expect(merged.map((tx) => tx.hash)).toEqual([PAYMENT_HASH])
    expect(merged[0]?.operations[0]?.amount).toBe(10)
  })

  it("includes a faucet claim the chain no longer returns", () => {
    const claim = faucetClaimToHistory({
      id: "claim-1",
      walletAddress: FRANK.toLowerCase(),
      amount: "100.0000000",
      txHash: CLAIM_HASH,
      claimedAt: "2026-11-10T08:00:00.000Z",
    })
    expect(claim).not.toBeNull()
    const merged = mergeAccountHistory({
      walletAddress: FRANK,
      remembered: [],
      chain: [],
      faucet: claim ? [claim] : [],
    })
    expect(merged).toHaveLength(1)
    expect(merged[0]?.operations[0]).toMatchObject({
      from: FAUCET_COUNTERPARTY,
      to: FRANK,
      amount: 100,
    })
    expect(merged[0]?.memo).toBe(FAUCET_HISTORY_MEMO)
  })

  it("does not keep another account's payments or faucet claims", () => {
    const otherPayment = payment({
      hash: PAYMENT_HASH,
      from: TREASURY,
      to: OTHER,
      amount: 10,
      createdAt: "2026-11-15T21:50:00.000Z",
    })
    const otherClaim = faucetClaimToHistory({
      id: "claim-other",
      walletAddress: OTHER,
      amount: 50,
      txHash: CLAIM_HASH,
      claimedAt: "2026-11-16T00:00:00.000Z",
    })
    const merged = mergeAccountHistory({
      walletAddress: FRANK,
      remembered: [otherPayment],
      chain: [],
      faucet: otherClaim ? [otherClaim] : [],
    })
    expect(merged).toEqual([])
  })

  it("unions an older remembered payment with a new chain payment", () => {
    const older = payment({
      hash: PAYMENT_HASH,
      from: TREASURY,
      to: FRANK,
      amount: 10,
      createdAt: "2026-11-08T12:00:00.000Z",
    })
    const recent = payment({
      hash: CLAIM_HASH,
      from: FRANK,
      to: OTHER,
      amount: 2,
      createdAt: "2026-11-17T15:00:00.000Z",
    })
    const merged = mergeAccountHistory({
      walletAddress: FRANK,
      remembered: [older],
      chain: [recent],
      faucet: [],
    })
    expect(merged.map((tx) => tx.hash)).toEqual([CLAIM_HASH, PAYMENT_HASH])
  })

  it("keeps one row when a faucet claim is also still on chain", () => {
    const chain = payment({
      hash: CLAIM_HASH,
      from: TREASURY,
      to: FRANK,
      amount: 100,
      createdAt: "2026-11-10T08:00:01.000Z",
    })
    const claim = faucetClaimToHistory({
      id: "claim-1",
      walletAddress: FRANK,
      amount: 100,
      txHash: CLAIM_HASH.toUpperCase(),
      claimedAt: "2026-11-10T08:00:00.000Z",
    })
    const merged = mergeAccountHistory({
      walletAddress: FRANK,
      remembered: [],
      chain: [chain],
      faucet: claim ? [claim] : [],
    })
    expect(merged).toHaveLength(1)
    expect(merged[0]?.operations[0]?.from).toBe(TREASURY)
    expect(merged[0]?.memo).toBe(FAUCET_HISTORY_MEMO)
  })
})

describe("cached tx history", () => {
  it("returns the history saved for that account", () => {
    const storage = memoryStorage()
    const tx = payment({
      hash: PAYMENT_HASH,
      from: TREASURY,
      to: FRANK,
      amount: 10,
      createdAt: "2026-11-08T12:00:00.000Z",
    })
    writeCachedTxHistory(FRANK, [tx], storage)
    expect(readCachedTxHistory(FRANK, storage)?.map((row) => row.hash)).toEqual([PAYMENT_HASH])
  })

  it("does not return another account's history", () => {
    const storage = memoryStorage()
    writeCachedTxHistory(
      FRANK,
      [
        payment({
          hash: PAYMENT_HASH,
          from: TREASURY,
          to: FRANK,
          amount: 10,
          createdAt: "2026-11-08T12:00:00.000Z",
        }),
      ],
      storage,
    )
    expect(readCachedTxHistory(OTHER, storage)).toBeNull()
  })
})
