/**
 * Pay API this wallet host should call.
 * Staging must not follow a production NEXT_PUBLIC_SOZUPAY_URL: that host still
 * serves checkout sessions without productImageUrl, so confirmation falls back
 * to the 3D shirt placeholder.
 */
export function payOriginForWalletHost(
  hostHeader: string | null | undefined,
  envOrigin?: string | null,
): string {
  const host = (hostHeader ?? "").split(",")[0]?.trim().toLowerCase().replace(/:\d+$/, "") ?? ""
  if (host === "dev.sozu.capital") return "https://dev.pay.sozu.capital"
  if (host === "app.sozu.capital") return "https://pay.sozu.capital"
  const env = envOrigin?.trim().replace(/\/$/, "") ?? ""
  if (/^https?:\/\//.test(env)) return env
  return "https://pay.sozu.capital"
}

export function sozuPayOriginFromRequest(request: Request): string {
  return payOriginForWalletHost(
    request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
    process.env.NEXT_PUBLIC_SOZUPAY_URL,
  )
}
