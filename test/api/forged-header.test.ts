import { readdirSync, statSync } from "node:fs"
import path from "node:path"
import { NextRequest } from "next/server"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { createFakeSupabase } from "./fake-supabase"
import { PUBLIC_ROUTES } from "./public-routes"

/**
 * Every /api route is called with a forged `x-user-id` and no session cookie.
 * Anything not on the reviewed PUBLIC_ROUTES list must answer 401.
 */

const VICTIM_USER_ID = "00000000-0000-4000-8000-00000000beef"
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    getAll: () => [],
    has: () => false,
    set: () => {},
    delete: () => {},
  }),
  headers: async () => new Headers({ "x-user-id": VICTIM_USER_ID }),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => createFakeSupabase().client,
}))

vi.mock("@supabase/supabase-js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@supabase/supabase-js")>()),
  createClient: () => createFakeSupabase().client,
}))

const apiRoot = path.resolve(__dirname, "../../app/api")

function findRoutes(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return findRoutes(full)
    return name === "route.ts" ? [full] : []
  })
}

function routePath(file: string): string {
  return "/api/" + path.relative(apiRoot, path.dirname(file)).split(path.sep).join("/")
}

const routes = findRoutes(apiRoot).map((file) => ({ file, route: routePath(file) }))

function forgedRequest(route: string, method: string): NextRequest {
  const url = new URL(
    route.replace(/\[(\w+)\]/g, (_, k) => (k === "address" ? "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5" : "x")),
    "http://localhost:3000",
  )
  url.searchParams.set("userId", VICTIM_USER_ID)
  return new NextRequest(url, {
    method,
    headers: { "x-user-id": VICTIM_USER_ID, "content-type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify({ userId: VICTIM_USER_ID }),
  })
}

const originalFetch = globalThis.fetch

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.test"
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon"
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service"
  process.env.WALLET_SESSION_SECRET = "test-secret"
  globalThis.fetch = (async () => {
    throw new Error("network disabled in forged-header test")
  }) as typeof fetch
  vi.spyOn(console, "log").mockImplementation(() => {})
  vi.spyOn(console, "info").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterAll(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe("forged x-user-id without a session", () => {
  it("public route list only names routes that exist", () => {
    const known = new Set(routes.map((r) => r.route))
    expect(Object.keys(PUBLIC_ROUTES).filter((r) => !known.has(r))).toEqual([])
  })

  for (const { file, route } of routes) {
    const exempt = PUBLIC_ROUTES[route]
    if (exempt && !exempt.methods) continue
    it(`${route} returns 401`, async () => {
      const mod = (await import(file)) as Record<string, unknown>
      const handlers = METHODS.filter((m) => typeof mod[m] === "function")
      expect(handlers.length).toBeGreaterThan(0)
      for (const method of handlers) {
        if (exempt?.methods?.includes(method)) continue
        const handler = mod[method] as (req: NextRequest, ctx: unknown) => Promise<Response>
        const ctx = { params: Promise.resolve({ id: "x", slug: "x", address: "x" }) }
        const res = await handler(forgedRequest(route, method), ctx)
        expect({ method, status: res.status }).toEqual({ method, status: 401 })
      }
    }, 30_000)
  }
})
