import { isPilotBlockedPath, isPilotMainnet } from "@/lib/pilot/pilot-mainnet"
import { updateSession } from "@/lib/supabase/middleware"
import { NextResponse, type NextRequest } from "next/server"

const IMAGE_FILE = /\.(?:svg|png|jpg|jpeg|gif|webp)$/i

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (isPilotMainnet() && isPilotBlockedPath(pathname)) {
    return new NextResponse(null, { status: 404 })
  }

  // API routes enforce their own auth; the matcher includes them only for the pilot gate above.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next()
  }

  // Image files skip the session check. They are matched only so the pilot gate above sees them.
  if (IMAGE_FILE.test(pathname)) {
    return NextResponse.next()
  }

  // Browsing via http://0.0.0.0:PORT breaks WebAuthn (rpId invalid). Dev may bind 0.0.0.0 for Docker.
  // Use the Host header. nextUrl.hostname stays 0.0.0.0 for every request when the
  // server is bound there, which would redirect localhost and LAN phones forever.
  const requestedHost = request.headers.get("host")?.split(":")[0]
  if (requestedHost === "0.0.0.0") {
    const url = request.nextUrl.clone()
    url.hostname = "localhost"
    return NextResponse.redirect(url, 307)
  }

  // SDP fetches this from host.docker.internal / ngrok — must not redirect to /auth.
  if (pathname.startsWith("/.well-known")) {
    return NextResponse.next()
  }

  // /sdp/invite is a public entry point (sets invite cookie, then redirects to auth or register).
  if (pathname.startsWith("/sdp/invite")) {
    return NextResponse.next()
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - sw.js (service worker)
     * - manifest.json (PWA manifest)
     * Image extensions stay matched so a disabled module can't be reached as /api/pizza/x.png.
     */
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|\\.well-known).*)",
  ],
}
