import { describe, expect, it } from "vitest"
import { FAUCET_TAP_PATH, TESTNET_FAUCET_ORIGIN, tapAuthReturnPath, testnetFaucetTapUrl } from "./tap-path"
import {
  FAUCET_TAP_COOKIE,
  buildTapCookieValue,
  openTapSlug,
  tapCookieAllowsSlug,
  tapSecretMatches,
  tapSlug,
} from "./tap-gate"

const SECRET = "a".repeat(43)
const ENV = { FAUCET_TAP_SECRET: SECRET, FAUCET_TAP_SLUG: "test-orb-001" } as NodeJS.ProcessEnv

describe("faucet tap gate", () => {
  it("accepts only the clean auth return", () => {
    expect(FAUCET_TAP_PATH).toBe("/tap")
    expect(tapAuthReturnPath("/tap")).toBe("/tap")
    expect(tapAuthReturnPath("/tap#secret")).toBeNull()
    expect(tapAuthReturnPath("/faucet/test-orb-001")).toBeNull()
    expect(tapAuthReturnPath("/tap/extra")).toBeNull()
    expect(TESTNET_FAUCET_ORIGIN).toBe("https://dev.sozu.capital")
    expect(testnetFaucetTapUrl("secret")).toBe("https://dev.sozu.capital/tap#secret")
  })

  it("matches the chip secret and ignores a short or swapped guess", () => {
    expect(tapSecretMatches(SECRET, SECRET)).toBe(true)
    expect(tapSecretMatches(`b${SECRET.slice(1)}`, SECRET)).toBe(false)
    expect(tapSecretMatches("short", SECRET)).toBe(false)
    expect(tapSecretMatches("", SECRET)).toBe(false)
  })

  it("opens a signed cookie and rejects a forwarded address with no cookie", () => {
    const now = 1_700_000_000_000
    const value = buildTapCookieValue("test-orb-001", now, SECRET)
    expect(openTapSlug(value, now + 1000, ENV)).toBe("test-orb-001")
    expect(openTapSlug(null, now, ENV)).toBeNull()
    expect(openTapSlug(`${value}x`, now, ENV)).toBeNull()
    expect(openTapSlug(value, now + 3 * 60 * 60 * 1000, ENV)).toBeNull()
  })

  it("does not let a cookie for another slug call this faucet", () => {
    const now = 1_700_000_000_000
    const value = buildTapCookieValue("test-orb-001", now, SECRET)
    const header = `${FAUCET_TAP_COOKIE}=${value}`
    expect(tapCookieAllowsSlug(header, "test-orb-001", now + 1000, ENV)).toBe(true)
    expect(tapCookieAllowsSlug(header, "mainnet-pilot", now + 1000, ENV)).toBe(false)
    expect(tapCookieAllowsSlug(null, "test-orb-001", now, ENV)).toBe(false)
  })

  it("uses the configured slug and falls back to the seeded orb", () => {
    expect(tapSlug(ENV)).toBe("test-orb-001")
    expect(tapSlug({} as NodeJS.ProcessEnv)).toBe("test-orb-001")
    expect(tapSlug({ FAUCET_TAP_SLUG: "../admin" } as NodeJS.ProcessEnv)).toBe("test-orb-001")
  })
})
