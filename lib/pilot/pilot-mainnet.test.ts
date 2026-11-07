import { readdirSync, statSync } from "node:fs"
import path from "node:path"
import { NextRequest } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { isPilotBlockedPath, PILOT_BLOCKED_PREFIXES } from "./pilot-mainnet"

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: vi.fn(async () => new Response(null, { status: 299 })),
}))

const { config, middleware } = await import("@/middleware")

/**
 * One real path per module that must stay unreachable on mainnet, kept apart from
 * PILOT_BLOCKED_PREFIXES so dropping a prefix fails here instead of shrinking the test.
 */
const REQUIRED_DISABLED = [
  // Backup PIN and address overwrite
  "/api/auth/pin/login",
  "/api/wallet/update-address",
  // Test and debug
  "/api/test/auto-deposit-e2e",
  "/api/debug/passkeys",
  "/test-keys",
  "/dev/cleanup",
  // Credit
  "/api/wallet/credits",
  "/api/wallet/credit-eligibility",
  "/credit",
  "/dashboard/business/new",
  // Vouching and trust points
  "/api/wallet/vouch/debug",
  "/api/wallet/trust-points/initialize",
  "/api/claim-daily-trust-points",
  "/api/maxflow/ego/x/can-vouch",
  // Gmail ledger
  "/api/gmail/callback",
  "/api/cron/gmail-sync",
  "/api/ledger/categories",
  "/ledger/goals",
  // PIZZA
  "/api/pizza/redeems/x",
  "/checkout/pizza/x",
  // DeFindex / Blend
  "/api/wallet/defindex/apy",
  "/api/wallet/vault",
  "/defi-info",
]

const appDir = path.resolve(__dirname, "../../app")

function listRouteDirs(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      listRouteDirs(full, out)
    } else if (/^(route|page)\.(ts|tsx)$/.test(entry)) {
      out.push(`/${path.relative(appDir, dir).split(path.sep).join("/")}`)
    }
  }
  return out
}

/** URL path for an app dir: route groups dropped, dynamic segments filled. */
function toUrlPath(routeDir: string): string {
  return routeDir
    .split("/")
    .filter((segment) => !/^\(.*\)$/.test(segment))
    .map((segment) => (/^\[.*\]$/.test(segment) ? "x" : segment))
    .join("/")
}

const allPaths = listRouteDirs(appDir).map(toUrlPath)
const blockedPaths = allPaths.filter(isPilotBlockedPath)

async function statusFor(pathname: string, method = "GET"): Promise<number> {
  const response = await middleware(new NextRequest(`https://app.sozu.capital${pathname}`, { method }))
  return response.status
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("PILOT_MAINNET blocklist", () => {
  it("every prefix matches at least one real route or page", () => {
    const dead = PILOT_BLOCKED_PREFIXES.filter((prefix) => !allPaths.some((p) => p === prefix || p.startsWith(`${prefix}/`)))
    expect(dead).toEqual([])
  })

  it("does not block the pilot flow", () => {
    for (const pathname of [
      "/",
      "/auth",
      "/home",
      "/settings",
      "/api/auth/login/challenge",
      "/api/auth/login/verify",
      "/api/auth/register/verify",
      "/api/wallet/stellar/balance",
      "/api/wallet/stellar/payment",
      "/api/wallet/resolve-recipient",
      "/api/ramp/offramp",
      "/api/cron/ramp-sync",
    ]) {
      expect(isPilotBlockedPath(pathname), pathname).toBe(false)
    }
  })

  it("matches whole segments only", () => {
    expect(isPilotBlockedPath("/developers")).toBe(false)
    expect(isPilotBlockedPath("/ledgerx")).toBe(false)
    expect(isPilotBlockedPath("/dev/cleanup")).toBe(true)
  })
})

describe("middleware under PILOT_MAINNET=1", () => {
  it("returns 404 for every route and page in a disabled module", async () => {
    vi.stubEnv("PILOT_MAINNET", "1")
    expect(blockedPaths.length).toBeGreaterThan(20)
    for (const pathname of blockedPaths) {
      for (const method of ["GET", "POST"]) {
        expect(await statusFor(pathname, method), `${method} ${pathname}`).toBe(404)
      }
    }
  })

  it("passes allowed API routes through untouched", async () => {
    vi.stubEnv("PILOT_MAINNET", "1")
    expect(await statusFor("/api/wallet/stellar/balance")).toBe(200)
  })

  it("still runs the page session check for allowed pages", async () => {
    vi.stubEnv("PILOT_MAINNET", "1")
    expect(await statusFor("/home")).toBe(299)
  })
})

describe("required disabled modules", () => {
  it("each module has a real route or page", () => {
    const missing = REQUIRED_DISABLED.filter((p) => !allPaths.includes(p))
    expect(missing).toEqual([])
  })

  it("each module is blocked and returns 404 under PILOT_MAINNET=1", async () => {
    vi.stubEnv("PILOT_MAINNET", "1")
    for (const pathname of REQUIRED_DISABLED) {
      expect(isPilotBlockedPath(pathname), pathname).toBe(true)
      expect(await statusFor(pathname), pathname).toBe(404)
    }
  })
})

describe("middleware matcher", () => {
  // The matcher is a single raw regex path, which Next anchors at both ends.
  const matchers = config.matcher.map((pattern: string) => new RegExp(`^${pattern}$`))
  const matches = (pathname: string) => matchers.some((re: RegExp) => re.test(pathname))

  it("still skips Next internals", () => {
    expect(matches("/_next/static/chunk.js")).toBe(false)
    expect(matches("/favicon.ico")).toBe(false)
  })

  it("runs for disabled routes even with an image extension", async () => {
    vi.stubEnv("PILOT_MAINNET", "1")
    for (const pathname of ["/api/pizza/redeems/example.png", "/api/ledger/vaults/example.svg", "/checkout/pizza/x.jpg"]) {
      expect(matches(pathname), pathname).toBe(true)
      expect(await statusFor(pathname, "POST"), pathname).toBe(404)
    }
  })

  it("runs for every blocked path", () => {
    expect(blockedPaths.filter((pathname) => !matches(pathname))).toEqual([])
  })

  it("serves allowed image files without the session check", async () => {
    vi.stubEnv("PILOT_MAINNET", "1")
    expect(await statusFor("/icons/logo.png")).toBe(200)
  })
})

describe("middleware with the flag off", () => {
  it("reaches every disabled-module route", async () => {
    vi.stubEnv("PILOT_MAINNET", "")
    vi.stubEnv("NEXT_PUBLIC_PILOT_MAINNET", "")
    for (const pathname of blockedPaths) {
      expect(await statusFor(pathname), pathname).not.toBe(404)
    }
  })
})
