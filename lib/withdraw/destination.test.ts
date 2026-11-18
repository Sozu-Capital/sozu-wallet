import { describe, expect, it } from "vitest"
import { Keypair, MuxedAccount, StrKey } from "@stellar/stellar-sdk"
import { groupAddressForDisplay } from "@/lib/payment/address-display"
import { parseMemoId, parseWithdrawDestination } from "./destination"

const G = Keypair.random().publicKey()
const C = StrKey.encodeContract(Buffer.alloc(32, 7))

describe("parseMemoId", () => {
  it("accepts empty, zero and uint64 max", () => {
    expect(parseMemoId("")).toEqual({ ok: true, memoId: null })
    expect(parseMemoId("  ")).toEqual({ ok: true, memoId: null })
    expect(parseMemoId("0")).toEqual({ ok: true, memoId: "0" })
    expect(parseMemoId(" 18446744073709551615 ")).toEqual({ ok: true, memoId: "18446744073709551615" })
  })

  it("rejects text, decimals, negatives and zero-padded memos", () => {
    for (const memo of ["abc", "12a", "1.5", "-1", "0123", "1 2"]) {
      expect(parseMemoId(memo), memo).toEqual({ ok: false, code: "memo_not_numeric" })
    }
  })

  it("rejects ids above uint64", () => {
    expect(parseMemoId("18446744073709551616")).toEqual({ ok: false, code: "memo_too_large" })
  })
})

describe("parseWithdrawDestination", () => {
  it("accepts a G address, tolerating spaces, newlines and lowercase", () => {
    const pasted = ` ${G.slice(0, 20).toLowerCase()}\n${G.slice(20)} `
    const r = parseWithdrawDestination(pasted)
    expect(r).toEqual({
      ok: true,
      destination: { address: G, kind: "classic", baseAddress: G, transferTo: G, memoId: null },
    })
  })

  it("turns G + numeric memo into the muxed M address carrying that id", () => {
    const r = parseWithdrawDestination(G, "123456789")
    if (!r.ok) throw new Error(r.code)
    expect(r.destination.address).toBe(G)
    expect(r.destination.baseAddress).toBe(G)
    expect(r.destination.memoId).toBe("123456789")
    expect(r.destination.transferTo.startsWith("M")).toBe(true)
    const mux = MuxedAccount.fromAddress(r.destination.transferTo, "0")
    expect(mux.baseAccount().accountId()).toBe(G)
    expect(mux.id()).toBe("123456789")
  })

  it("accepts an M address as-is and exposes its base G and id", () => {
    const m = parseWithdrawDestination(G, "42")
    if (!m.ok) throw new Error(m.code)
    const r = parseWithdrawDestination(m.destination.transferTo)
    if (!r.ok) throw new Error(r.code)
    expect(r.destination).toMatchObject({ kind: "muxed", baseAddress: G, memoId: "42" })
    expect(r.destination.transferTo).toBe(m.destination.transferTo)
  })

  it("rejects a memo on top of an M address or a C address", () => {
    const m = parseWithdrawDestination(G, "42")
    if (!m.ok) throw new Error(m.code)
    expect(parseWithdrawDestination(m.destination.transferTo, "7")).toEqual({ ok: false, code: "memo_with_muxed" })
    expect(parseWithdrawDestination(C, "7")).toEqual({ ok: false, code: "memo_on_contract" })
  })

  it("accepts a C address without memo", () => {
    expect(parseWithdrawDestination(C)).toEqual({
      ok: true,
      destination: { address: C, kind: "contract", baseAddress: C, transferTo: C, memoId: null },
    })
  })

  it("rejects bad checksums, secrets, empty input and text memos", () => {
    const badChecksum = G.slice(0, 55) + (G.endsWith("A") ? "B" : "A")
    expect(parseWithdrawDestination(badChecksum)).toEqual({ ok: false, code: "invalid_address" })
    expect(parseWithdrawDestination(Keypair.random().secret())).toEqual({ ok: false, code: "invalid_address" })
    expect(parseWithdrawDestination("   ")).toEqual({ ok: false, code: "empty" })
    expect(parseWithdrawDestination(G, "binance-memo")).toEqual({ ok: false, code: "memo_not_numeric" })
  })
})

describe("groupAddressForDisplay", () => {
  it("keeps every character, in groups of four", () => {
    const grouped = groupAddressForDisplay(G)
    expect(grouped.replace(/ /g, "")).toBe(G)
    expect(grouped.split(" ").every((g) => g.length <= 4)).toBe(true)
  })
})
