import { afterEach, describe, expect, it, vi } from "vitest"
import { isSouvenirLaunchAuthorized } from "@/lib/merch/souvenir-launch-auth"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("souvenir launch auth", () => {
  it("accepts the shared Sozu Pay secret", () => {
    vi.stubEnv("SOZU_PAY_SOUVENIR_SECRET", "a-long-enough-shared-secret")
    const request = new Request("https://dev.sozu.capital/api/souvenirs/launch", {
      headers: { "x-sozu-pay-souvenir": "a-long-enough-shared-secret" },
    })
    expect(isSouvenirLaunchAuthorized(request)).toBe(true)
  })

  it("rejects a missing or short secret", () => {
    vi.stubEnv("SOZU_PAY_SOUVENIR_SECRET", "short")
    const request = new Request("https://dev.sozu.capital/api/souvenirs/launch")
    expect(isSouvenirLaunchAuthorized(request)).toBe(false)
  })
})
