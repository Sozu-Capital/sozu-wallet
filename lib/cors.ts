import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PRODUCTION_ORIGINS = ["https://app.sozu.capital", "https://dev.sozu.capital"]

function configuredAppOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (!raw) return null
  try {
    return new URL(raw).origin
  } catch {
    return null
  }
}

/** Exact-match allowlist. Localhost is allowed only in development; no wildcard hosts. */
export function isAllowedCorsOrigin(origin: string | null): origin is string {
  if (!origin) return false
  if (PRODUCTION_ORIGINS.includes(origin)) return true
  if (origin === configuredAppOrigin()) return true
  if (process.env.NODE_ENV === "development") {
    return /^https?:\/\/localhost(:\d+)?$/.test(origin)
  }
  return false
}

/**
 * CORS headers for API routes. Same-origin requests don't need them; a cross-origin caller gets
 * Access-Control-Allow-Origin only when its origin is on the allowlist.
 */
export function corsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get("origin")
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  }
  if (isAllowedCorsOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin
    headers["Access-Control-Allow-Credentials"] = "true"
  }
  return headers
}

/**
 * Handle OPTIONS preflight requests
 */
export function handleOPTIONS(request: NextRequest) {
  const headers = corsHeaders(request)
  return new NextResponse(null, {
    status: 200,
    headers,
  })
}
