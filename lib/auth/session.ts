import "server-only"
import { NextResponse } from "next/server"
import {
  WALLET_SESSION_COOKIE,
  buildSessionCookieValue,
  getSessionCookieOptions,
  parseSessionCookieValue,
  readCookie,
} from "@/lib/auth/session-cookie"

/**
 * The only way wallet API routes learn who the caller is.
 * Client-supplied identity (e.g. an `x-user-id` header or a userId in the body) is never trusted.
 */
export function getSessionUserId(request: Request): string | null {
  const raw = readCookie(request.headers.get("cookie"), WALLET_SESSION_COOKIE)
  return parseSessionCookieValue(raw)?.uid ?? null
}

export function unauthorizedResponse(headers?: HeadersInit): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers })
}

export function requireSession(
  request: Request,
  headers?: HeadersInit,
): { userId: string; error?: never } | { userId?: never; error: NextResponse } {
  const userId = getSessionUserId(request)
  if (userId) return { userId }
  return { error: unauthorizedResponse(headers) }
}

export function setSessionCookie(response: NextResponse, userId: string): NextResponse {
  response.cookies.set(WALLET_SESSION_COOKIE, buildSessionCookieValue(userId), getSessionCookieOptions())
  return response
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(WALLET_SESSION_COOKIE, "", getSessionCookieOptions(0))
  return response
}
