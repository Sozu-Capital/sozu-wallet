import { describe, expect, it } from "vitest"
import { MAINNET_PILOT_CLAIM_USDC, resolveClaimAmount } from "./claim-amount"

describe("resolveClaimAmount", () => {
  it("pays 15 USDC on mainnet even when the shared env is still 10", () => {
    expect(MAINNET_PILOT_CLAIM_USDC).toBe(15)
    expect(
      resolveClaimAmount(1, {
        STELLAR_NETWORK: "mainnet",
        FAUCET_CLAIM_AMOUNT: "10",
      } as NodeJS.ProcessEnv),
    ).toBe(15)
    expect(
      resolveClaimAmount(1, { STELLAR_NETWORK: "mainnet" } as NodeJS.ProcessEnv),
    ).toBe(15)
  })

  it("keeps the env override on testnet", () => {
    expect(
      resolveClaimAmount(1, { FAUCET_CLAIM_AMOUNT: "10" } as NodeJS.ProcessEnv),
    ).toBe(10)
    expect(resolveClaimAmount(1, {} as NodeJS.ProcessEnv)).toBe(1)
  })
})
