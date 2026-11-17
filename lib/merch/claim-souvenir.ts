"use client"

import { listCollectibleSouvenirs } from "@/lib/merch/catalog"
import { rememberClaimedSouvenir, type ClaimedSouvenir } from "@/lib/merch/souvenirs"

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function cancelled(error: unknown): boolean {
  return error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "AbortError")
}

/** Asks the passkey to sign, then keeps the badge on this wallet. A cancelled prompt keeps nothing. */
export async function claimEventSouvenir(input: {
  slug: string
  walletAddress: string
}): Promise<ClaimedSouvenir | null> {
  const souvenir = listCollectibleSouvenirs().find(
    (item) => item.slug.trim().toLowerCase() === input.slug.trim().toLowerCase(),
  )
  const wallet = input.walletAddress.trim().toUpperCase()
  if (!souvenir || !wallet) return null

  const { getPasskey } = await import("@/lib/turnkey/passkeys")
  const challenge = bytesToBase64Url(
    new TextEncoder().encode(`sozu.souvenir.claim.v1:${wallet}:${souvenir.slug}:${Date.now()}`),
  )

  let signature = ""
  try {
    const credential = await getPasskey({
      challenge,
      rpId: window.location.hostname,
      userVerification: "required",
      allowCredentials: [],
    })
    signature = credential?.response.signature?.trim() ?? ""
  } catch (error) {
    if (cancelled(error)) return null
    throw error
  }
  if (!signature) return null

  const claim: ClaimedSouvenir = {
    slug: souvenir.slug,
    walletAddress: wallet,
    claimedAt: new Date().toISOString(),
  }
  rememberClaimedSouvenir(claim)
  return claim
}
