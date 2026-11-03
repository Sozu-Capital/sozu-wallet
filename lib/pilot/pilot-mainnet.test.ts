import { readdirSync, statSync } from "node:fs"
import path from "node:path"
import { NextRequest } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { isPilotBlockedPath, PILOT_BLOCKED_PREFIXES } from "./pilot-mainnet"

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: vi.fn(async () => new Response(null, { status: 299 })),
}))

const { middleware } = await import("@/middleware")

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

describe("middleware with the flag off", () => {
  it("reaches every disabled-module route", async () => {
    vi.stubEnv("PILOT_MAINNET", "")
    vi.stubEnv("NEXT_PUBLIC_PILOT_MAINNET", "")
    for (const pathname of blockedPaths) {
      expect(await statusFor(pathname), pathname).not.toBe(404)
    }
  })
})
