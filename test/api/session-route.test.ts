import { NextRequest } from "next/server"
import { beforeAll, describe, expect, it } from "vitest"
import { WALLET_SESSION_COOKIE, buildSessionCookieValue } from "@/lib/auth/session-cookie"

const USER = "00000000-0000-4000-8000-0000000000aa"

beforeAll(() => {
  process.env.WALLET_SESSION_SECRET = "test-secret"
})

describe("GET /api/auth/session", () => {
  it("rejects a missing cookie", async () => {
    const { GET } = await import("@/app/api/auth/session/route")
    const res = await GET(new NextRequest("http://localhost:3000/api/auth/session"))
    expect(res.status).toBe(401)
  })

  it("accepts a signed session cookie", async () => {
    const { GET } = await import("@/app/api/auth/session/route")
    const res = await GET(
      new NextRequest("http://localhost:3000/api/auth/session", {
        headers: { cookie: `${WALLET_SESSION_COOKIE}=${buildSessionCookieValue(USER)}` },
      }),
    )
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ authenticated: true })
  })

  it("rejects a cookie signed with another secret", async () => {
    const { GET } = await import("@/app/api/auth/session/route")
    const res = await GET(
      new NextRequest("http://localhost:3000/api/auth/session", {
        headers: {
          cookie: `${WALLET_SESSION_COOKIE}=${buildSessionCookieValue(USER, Date.now(), "other-secret")}`,
        },
      }),
    )
    expect(res.status).toBe(401)
  })
})
