import { describe, expect, it } from "vitest"
import {
  classifyVaultEvent,
  emptyOfflineLedger,
  isVaultId,
  mapHistoryRows,
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
    expect(resolveVaultId("nope", "also-nope")).toBe(null)
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
})
