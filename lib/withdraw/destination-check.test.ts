import { describe, expect, it } from "vitest"
import { Keypair } from "@stellar/stellar-sdk"
import { evaluateClassicDestination } from "./destination-check"
import { CIRCLE_USDC_ISSUERS } from "./usdc-asset"

const asset = { code: "USDC", issuer: CIRCLE_USDC_ISSUERS.mainnet, decimals: 7 } as const
const G = Keypair.random().publicKey()
const usdcLine = (over: Record<string, unknown> = {}) => ({
  asset_type: "credit_alphanum4",
  asset_code: "USDC",
  asset_issuer: CIRCLE_USDC_ISSUERS.mainnet,
  balance: "0.0000000",
  limit: "922337203685.4775807",
  is_authorized: true,
  ...over,
})
const AMOUNT = BigInt("123456789")

describe("evaluateClassicDestination", () => {
  it("fails when the account is not on-chain", () => {
    expect(evaluateClassicDestination(null, G, asset, AMOUNT)).toEqual({ ok: false, code: "destination_not_found" })
  })

  it("fails without a Circle USDC trustline (XLM only, or USDC from another issuer)", () => {
    const xlmOnly = { balances: [{ asset_type: "native", balance: "5.0000000" }] }
    expect(evaluateClassicDestination(xlmOnly, G, asset, AMOUNT)).toEqual({ ok: false, code: "destination_no_trustline" })
    const fakeUsdc = { balances: [usdcLine({ asset_issuer: Keypair.random().publicKey() })] }
    expect(evaluateClassicDestination(fakeUsdc, G, asset, AMOUNT)).toEqual({ ok: false, code: "destination_no_trustline" })
  })

  it("fails on an unauthorized trustline or one without room", () => {
    expect(evaluateClassicDestination({ balances: [usdcLine({ is_authorized: false })] }, G, asset, AMOUNT)).toEqual({
      ok: false,
      code: "destination_trustline_unauthorized",
    })
    const nearlyFull = { balances: [usdcLine({ balance: "99.0000000", limit: "100.0000000" })] }
    expect(evaluateClassicDestination(nearlyFull, G, asset, AMOUNT)).toEqual({ ok: false, code: "destination_trustline_full" })
  })

  it("passes with an authorized trustline that has room", () => {
    expect(evaluateClassicDestination({ balances: [usdcLine()] }, G, asset, AMOUNT)).toEqual({ ok: true })
    const exactRoom = { balances: [usdcLine({ balance: "87.6543211", limit: "100.0000000" })] }
    expect(evaluateClassicDestination(exactRoom, G, asset, AMOUNT)).toEqual({ ok: true })
  })
})
