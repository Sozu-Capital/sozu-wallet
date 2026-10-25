import { describe, expect, it } from "vitest"
import {
  DEMO_OFFLINE_VAULT_ID,
  classifyVaultEvent,
  emptyOfflineLedger,
  isVaultId,
  loadOfflineLedger,
  mapHistoryRows,
  mapRpcEvents,
  resolveVaultId,
  vaultContractExplorerUrl,
} from "./vault-ledger"

const CONTRACT = `C${"A".repeat(55)}`
const ACCOUNT = `G${"A".repeat(55)}`

describe("vault ledger", () => {
  it("accepts classic and contract vault ids", () => {
    expect(isVaultId(ACCOUNT)).toBe(true)
    expect(isVaultId(CONTRACT)).toBe(true)
    expect(isVaultId("")).toBe(false)
    expect(isVaultId("sozu")).toBe(false)
  })

  it("prefers the query vault over env", () => {
    expect(resolveVaultId(CONTRACT, ACCOUNT)).toBe(CONTRACT)
    expect(resolveVaultId(null, ACCOUNT)).toBe(ACCOUNT)
    expect(resolveVaultId("nope", "also-nope", null)).toBe(null)
    expect(resolveVaultId("nope", "also-nope")).toBe(DEMO_OFFLINE_VAULT_ID)
  })

  it("builds stellar.expert contract and tx urls on testnet", () => {
    expect(vaultContractExplorerUrl(CONTRACT)).toBe(
      `https://stellar.expert/explorer/testnet/contract/${CONTRACT}`,
    )
    const rows = mapHistoryRows(
      [
        {
          hash: "abc123def456",
          title: "settleCheque",
          created_at: "2026-10-25T19:00:00Z",
        },
        {
          txHash: "fff000111222",
          error: "note-used",
        },
      ],
      CONTRACT,
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]?.reason).toBe("settled")
    expect(rows[0]?.explorerUrl).toBe("https://stellar.expert/explorer/testnet/tx/abc123def456")
    expect(rows[1]?.reason).toBe("note-used")
    expect(rows[1]?.label).toBe("note already used")
  })

  it("returns a waiting ledger when the vault is missing", () => {
    const empty = emptyOfflineLedger(null)
    expect(empty.waiting).toBe(true)
    expect(empty.txs).toEqual([])
    expect(empty.contractExplorerUrl).toBe(null)
  })

  it("does not invent hashes from account ids", () => {
    expect(mapHistoryRows([{ hash: ACCOUNT, title: "settle" }], ACCOUNT)).toEqual([])
  })

  it("classifies spoken reject copy", () => {
    expect(classifyVaultEvent("note already used")).toBe("note-used")
    expect(classifyVaultEvent("first settle")).toBe("settled")
  })

  it("reads the testnet settled and note-used events", () => {
    const rows = mapRpcEvents([
      {
        txHash: "b26a45961b7a435385d04c230058d80fa3b09c0a33a8b5eaf0d608342839fa9e",
        ledgerClosedAt: "2026-10-25T20:09:12Z",
        topic: ["AAAADwAAAAdzZXR0bGVkAA=="],
        value: "AAAAEAAAAAEAAAACAAAADQAAABCMo7G9x+ZC0rueIhyLEn6NAAAACgAAAAAAAAAAAAAAAAABhqA=",
      },
      {
        txHash: "3c8c0df9d75eb97c0e614538a1e3271c4a501aa2ecd114247ec36b5472cd37d5",
        ledgerClosedAt: "2026-10-25T20:09:22Z",
        topic: ["AAAADwAAAAhyZWplY3RlZA=="],
        value: "AAAAEAAAAAEAAAACAAAADQAAABCMo7G9x+ZC0rueIhyLEn6NAAAADgAAAAlub3RlLXVzZWQAAAA=",
      },
    ])
    expect(rows.map((row) => row.reason)).toEqual(["settled", "note-used"])
    expect(rows[0]?.label).toBe("settled · settler kept 0.01 USDC")
    expect(rows[1]?.label).toBe("note already used")
    expect(rows[1]?.explorerUrl).toBe(
      "https://stellar.expert/explorer/testnet/tx/3c8c0df9d75eb97c0e614538a1e3271c4a501aa2ecd114247ec36b5472cd37d5",
    )
  })

  it("loads contract events from soroban rpc", async () => {
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { method?: string }
      if (body.method === "getLatestLedger") {
        return Response.json({ result: { sequence: 5_387_284 } })
      }
      return Response.json({
        result: {
          events: [
            {
              txHash: "b26a45961b7a435385d04c230058d80fa3b09c0a33a8b5eaf0d608342839fa9e",
              ledgerClosedAt: "2026-10-25T20:09:12Z",
              topic: ["AAAADwAAAAdzZXR0bGVkAA=="],
              value: "AAAAEAAAAAEAAAACAAAADQAAABCMo7G9x+ZC0rueIhyLEn6NAAAACgAAAAAAAAAAAAAAAAABhqA=",
            },
          ],
        },
      })
    }) as typeof fetch

    const ledger = await loadOfflineLedger(DEMO_OFFLINE_VAULT_ID, fetchImpl)
    expect(ledger.waiting).toBe(false)
    expect(ledger.txs).toHaveLength(1)
    expect(ledger.txs[0]?.reason).toBe("settled")
    expect(ledger.contractExplorerUrl).toContain(DEMO_OFFLINE_VAULT_ID)
  })
})
