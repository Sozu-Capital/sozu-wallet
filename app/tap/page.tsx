import type { Metadata } from "next"
import { cookies } from "next/headers"
import { FaucetClaimExperience } from "@/components/faucet/faucet-claim-experience"
import { TapEntry } from "@/components/faucet/tap-entry"
import { FAUCET_TAP_COOKIE, openTapSlug } from "@/lib/faucet/tap-gate"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Sozu",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
}

/** NFC and QR open /tap#secret. After the cookie is set, the bar is only /tap. */
export default async function TapPage() {
  const jar = await cookies()
  const slug = openTapSlug(jar.get(FAUCET_TAP_COOKIE)?.value)
  if (!slug) return <TapEntry />
  return <FaucetClaimExperience slug={slug} />
}
