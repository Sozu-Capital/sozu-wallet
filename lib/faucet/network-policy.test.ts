import { describe, expect, it } from "vitest"
import {
  MAINNET_PILOT_CAP_USDC,
  decideFaucetPayout,
  effectiveDailyLimitUsdc,
  effectiveUserCooldownHours,
  isFaucetContractConfigured,
  isMainnetPilotArmed,
  pilotReservedExceedsCap,
  readFaucetNetwork,
  resolveFaucetTreasurySecret,
  vaultCoversClaim,
  withinDailyBudget,
} from "./network-policy"

const CONTRACT = `C${"A".repeat(55)}`

describe("faucet network policy", () => {
  it("treats anything other than STELLAR_NETWORK=mainnet as testnet", () => {
    expect(readFaucetNetwork({ STELLAR_NETWORK: "testnet" } as NodeJS.ProcessEnv)).toBe("testnet")
    expect(readFaucetNetwork({} as NodeJS.ProcessEnv)).toBe("testnet")
    expect(readFaucetNetwork({ STELLAR_NETWORK: "mainnet" } as NodeJS.ProcessEnv)).toBe("mainnet")
  })

  it("arms the mainnet pilot only for the exact flag", () => {
    expect(isMainnetPilotArmed({ FAUCET_MAINNET_PILOT: "1" } as NodeJS.ProcessEnv)).toBe(true)
    expect(isMainnetPilotArmed({ FAUCET_MAINNET_PILOT: "true" } as NodeJS.ProcessEnv)).toBe(false)
    expect(isMainnetPilotArmed({} as NodeJS.ProcessEnv)).toBe(false)
  })

  it("accepts a testnet claim and ignores the pilot cap", () => {
    expect(
      decideFaucetPayout({
        network: "testnet",
        pilotArmed: false,
        slug: "orb-1",
        amountUsdc: 1,
        reservedUsdc: 10_000,
        contractConfigured: false,
      }),
    ).toEqual({ ok: true })
  })

  it("refuses mainnet until the pilot is armed", () => {
    expect(
      decideFaucetPayout({
        network: "mainnet",
        pilotArmed: false,
        slug: "mainnet-pilot",
        amountUsdc: 1,
        reservedUsdc: 0,
        contractConfigured: true,
      }),
    ).toEqual({ ok: false, reason: "mainnet_refused" })
  })

  it("pays the armed pilot only from the pilot slug and the vault contract", () => {
    const base = {
      network: "mainnet" as const,
      pilotArmed: true,
      amountUsdc: 1,
      reservedUsdc: 0,
      contractConfigured: true,
    }
    expect(decideFaucetPayout({ ...base, slug: "mainnet-pilot" })).toEqual({ ok: true })
    expect(decideFaucetPayout({ ...base, slug: "orb-1" })).toEqual({ ok: false, reason: "pilot_slug" })
    expect(decideFaucetPayout({ ...base, slug: "mainnet-pilot", contractConfigured: false })).toEqual({
      ok: false,
      reason: "pilot_contract_required",
    })
  })

  it("stops at 300 USDC, including a claim that would cross the cap", () => {
    expect(MAINNET_PILOT_CAP_USDC).toBe(300)
    const base = {
      network: "mainnet" as const,
      pilotArmed: true,
      slug: "mainnet-pilot",
      contractConfigured: true,
      amountUsdc: 20,
    }
    expect(decideFaucetPayout({ ...base, reservedUsdc: 280 })).toEqual({ ok: true })
    expect(decideFaucetPayout({ ...base, reservedUsdc: 290 })).toEqual({ ok: false, reason: "pilot_cap" })
    expect(decideFaucetPayout({ ...base, amountUsdc: 300, reservedUsdc: 0 })).toEqual({ ok: true })
    expect(decideFaucetPayout({ ...base, amountUsdc: 301, reservedUsdc: 0 })).toEqual({
      ok: false,
      reason: "pilot_cap",
    })
  })

  it("counts a pending row once when it is already in the reserved sum", () => {
    const base = {
      network: "mainnet" as const,
      pilotArmed: true,
      slug: "mainnet-pilot",
      contractConfigured: true,
      amountUsdc: 20,
      reservedUsdc: 300,
      reservedIncludesAmount: true,
    }
    expect(decideFaucetPayout(base)).toEqual({ ok: true })
    expect(decideFaucetPayout({ ...base, reservedUsdc: 301 })).toEqual({ ok: false, reason: "pilot_cap" })
    expect(pilotReservedExceedsCap(300)).toBe(false)
    expect(pilotReservedExceedsCap(300.0000001)).toBe(true)
  })

  it("keeps a 24 hour cooldown on mainnet when the testnet switch is 0", () => {
    expect(effectiveUserCooldownHours("testnet", 0)).toBe(0)
    expect(effectiveUserCooldownHours("mainnet", 0)).toBe(24)
    expect(effectiveUserCooldownHours("mainnet", 48)).toBe(48)
  })

  it("caps the mainnet daily budget at 300 USDC", () => {
    expect(effectiveDailyLimitUsdc("mainnet", 10_000)).toBe(300)
    expect(effectiveDailyLimitUsdc("testnet", 10_000)).toBe(10_000)
    expect(withinDailyBudget(10, 20)).toBe(false)
    expect(withinDailyBudget(20, 20)).toBe(true)
  })

  it("refuses a claim when the vault balance cannot be read", () => {
    expect(
      vaultCoversClaim({ contractConfigured: true, balanceMinor: null, amountUsdc: 1 }),
    ).toBe(false)
    expect(
      vaultCoversClaim({ contractConfigured: true, balanceMinor: 5_000_000n, amountUsdc: 1 }),
    ).toBe(false)
    expect(
      vaultCoversClaim({ contractConfigured: true, balanceMinor: 10_000_000n, amountUsdc: 1 }),
    ).toBe(true)
    expect(
      vaultCoversClaim({ contractConfigured: false, balanceMinor: null, amountUsdc: 1 }),
    ).toBe(true)
  })

  it("refuses to reuse the testnet funder secret on mainnet", () => {
    expect(
      resolveFaucetTreasurySecret({
        network: "mainnet",
        funderSecret: "S".padEnd(56, "A"),
      }).ok,
    ).toBe(false)
    expect(
      resolveFaucetTreasurySecret({
        network: "mainnet",
        faucetTreasurySecret: "S".padEnd(56, "B"),
        funderSecret: "S".padEnd(56, "A"),
      }),
    ).toEqual({ ok: true, secret: "S".padEnd(56, "B") })
    expect(
      resolveFaucetTreasurySecret({
        network: "testnet",
        funderSecret: "S".padEnd(56, "A"),
      }),
    ).toEqual({ ok: true, secret: "S".padEnd(56, "A") })
  })

  it("recognizes a deployed faucet contract id", () => {
    expect(isFaucetContractConfigured({ FAUCET_CONTRACT_ID: CONTRACT } as NodeJS.ProcessEnv)).toBe(true)
    expect(isFaucetContractConfigured({ FAUCET_CONTRACT_ID: "G".padEnd(56, "A") } as NodeJS.ProcessEnv)).toBe(
      false,
    )
  })
})
