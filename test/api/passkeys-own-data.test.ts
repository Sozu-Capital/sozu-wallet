import { NextRequest } from "next/server"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { WALLET_SESSION_COOKIE, buildSessionCookieValue } from "@/lib/auth/session-cookie"
import { createFakeSupabase, type EqCall } from "./fake-supabase"

const CALLER = "00000000-0000-4000-8000-0000000000aa"
const VICTIM = "00000000-0000-4000-8000-0000000000bb"

const calls: EqCall[] = []

vi.mock("@supabase/supabase-js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@supabase/supabase-js")>()),
  createClient: () => {
    const fake = createFakeSupabase()
    const from = fake.client.from
    fake.client.from = (table: string) => {
      const q = from(table) as { eq: (c: string, v: unknown) => unknown }
      const eq = q.eq
      q.eq = (column: string, value: unknown) => {
        calls.push({ table, column, value })
        return eq(column, value)
      }
      return q
    }
    return fake.client
  },
}))

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.test"
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service"
  process.env.WALLET_SESSION_SECRET = "test-secret"
})

function requestAs(path: string): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"), {
    headers: {
      cookie: `${WALLET_SESSION_COOKIE}=${buildSessionCookieValue(CALLER)}`,
      "x-user-id": VICTIM,
    },
  })
}

describe("passkey endpoints with a session for one user and a forged header for another", () => {
  it.each(["list", "primary"])("/api/auth/passkeys/%s only queries the session user", async (name) => {
    calls.length = 0
    const { GET } = await import(`@/app/api/auth/passkeys/${name}/route`)
    await GET(requestAs(`/api/auth/passkeys/${name}`))
    const userFilters = calls.filter((c) => c.table === "passkeys" && c.column === "user_id")
    expect(userFilters.length).toBeGreaterThan(0)
    expect(userFilters.every((c) => c.value === CALLER)).toBe(true)
  })
})
