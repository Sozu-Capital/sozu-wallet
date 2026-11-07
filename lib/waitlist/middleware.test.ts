import { NextRequest, NextResponse } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: vi.fn(async () => NextResponse.redirect("https://app.sozu.capital/auth", 307)),
}))

import { middleware } from "@/middleware"
import { WAITLIST_BYPASS_COOKIE } from "@/lib/waitlist/waitlist-mode"

const TOKEN = "team-bypass-token-0123456789"

function request(path: string, cookie?: string) {
  return new NextRequest(`https://app.sozu.capital${path}`, {
    headers: cookie ? { cookie: `${WAITLIST_BYPASS_COOKIE}=${cookie}` } : {},
  })
}

function rewriteTarget(response: Response) {
  return response.headers.get("x-middleware-rewrite")
}

function isNext(response: Response) {
  return response.headers.get("x-middleware-next") === "1"
}

beforeEach(() => {
  vi.stubEnv("WAITLIST_MODE", "1")
  vi.stubEnv("WAITLIST_BYPASS_TOKEN", TOKEN)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("waitlist middleware", () => {
  it("rewrites the root to the waitlist page", async () => {
    const response = await middleware(request("/"))
    expect(rewriteTarget(response)).toBe("https://app.sozu.capital/waitlist")
  })

  it("redirects app pages and dotted page URLs to the root", async () => {
    for (const path of ["/auth", "/home?x=1", "/city/spot/1.png", "/waitlist"]) {
      const response = await middleware(request(path))
      expect(response.status).toBe(307)
      expect(response.headers.get("location")).toBe("https://app.sozu.capital/")
    }
  })

  it("serves assets and well-known files without the session check", async () => {
    for (const path of ["/brand/november-2026/mark.png", "/robots.txt", "/.well-known/stellar.toml"]) {
      expect(isNext(await middleware(request(path)))).toBe(true)
    }
  })

  it("sets the bypass cookie from a valid access link and strips the token from the URL", async () => {
    const response = await middleware(request(`/home?access=${TOKEN}&tab=1`))
    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe("https://app.sozu.capital/home?tab=1")
    const cookie = response.cookies.get(WAITLIST_BYPASS_COOKIE)
    expect(cookie?.value).toBe(TOKEN)
    expect(cookie?.httpOnly).toBe(true)
  })

  it("ignores a wrong access link", async () => {
    const response = await middleware(request("/home?access=wrong-token-0123456789"))
    expect(response.headers.get("location")).toBe("https://app.sozu.capital/")
    expect(response.cookies.get(WAITLIST_BYPASS_COOKIE)).toBeUndefined()
  })

  it("lets a valid bypass cookie through to the normal app flow", async () => {
    const response = await middleware(request("/home", TOKEN))
    expect(response.headers.get("location")).toBe("https://app.sozu.capital/auth")
  })

  it("keeps the waitlist for an invalid bypass cookie", async () => {
    const response = await middleware(request("/home", "not-the-token-0123456789"))
    expect(response.headers.get("location")).toBe("https://app.sozu.capital/")
  })

  it("does nothing when WAITLIST_MODE is off", async () => {
    vi.stubEnv("WAITLIST_MODE", "")
    const page = await middleware(request("/home"))
    expect(page.headers.get("location")).toBe("https://app.sozu.capital/auth")
    expect(isNext(await middleware(request("/icons/sozu_icon_192.png")))).toBe(true)
  })
})
