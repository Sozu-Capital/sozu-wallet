import { NextRequest } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { corsHeaders, isAllowedCorsOrigin } from "./cors"

function request(origin?: string) {
  return new NextRequest("https://app.sozu.capital/api/wallet/stellar/assets", {
    headers: origin ? { origin } : {},
  })
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("CORS allowlist", () => {
  it("allows the production and staging origins exactly", () => {
    vi.stubEnv("NODE_ENV", "production")
    expect(isAllowedCorsOrigin("https://app.sozu.capital")).toBe(true)
    expect(isAllowedCorsOrigin("https://dev.sozu.capital")).toBe(true)
    expect(isAllowedCorsOrigin("https://evil.sozu.capital")).toBe(false)
    expect(isAllowedCorsOrigin("https://app.sozu.capital.evil.com")).toBe(false)
    expect(isAllowedCorsOrigin("http://app.sozu.capital")).toBe(false)
  })

  it("rejects wildcard hosts and localhost outside development", () => {
    vi.stubEnv("NODE_ENV", "production")
    expect(isAllowedCorsOrigin("https://attacker.vercel.app")).toBe(false)
    expect(isAllowedCorsOrigin("http://localhost:3000")).toBe(false)
  })

  it("allows localhost in development", () => {
    vi.stubEnv("NODE_ENV", "development")
    expect(isAllowedCorsOrigin("http://localhost:3000")).toBe(true)
  })

  it("allows the configured app origin", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://pilot.example.org/some/path")
    expect(isAllowedCorsOrigin("https://pilot.example.org")).toBe(true)
  })

  it("never echoes a disallowed origin or a wildcard", () => {
    vi.stubEnv("NODE_ENV", "production")
    for (const headers of [corsHeaders(request("https://attacker.vercel.app")), corsHeaders(request())]) {
      expect(headers["Access-Control-Allow-Origin"]).toBeUndefined()
      expect(headers["Access-Control-Allow-Credentials"]).toBeUndefined()
    }
    expect(corsHeaders(request("https://app.sozu.capital"))["Access-Control-Allow-Origin"]).toBe(
      "https://app.sozu.capital",
    )
  })
})
