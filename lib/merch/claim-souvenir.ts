"use client"

import type { CollectibleSouvenir } from "@/lib/merch/catalog"
import { rememberClaimedSouvenir, type ClaimedSouvenir } from "@/lib/merch/souvenirs"

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function cancelled(error: unknown): boolean {
  return error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "AbortError")
}

/** Asks the passkey to sign, then keeps the badge on this account forever. */
export async function claimEventSouvenir(input: {
  souvenir: CollectibleSouvenir
  walletAddress: string
}): Promise<ClaimedSouvenir | null> {
  const souvenir = input.souvenir
  const wallet = input.walletAddress.trim().toUpperCase()
  if (!souvenir?.slug || !wallet) return null

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

  const res = await fetch("/api/souvenirs/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug: souvenir.slug, walletAddress: wallet }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    claim?: ClaimedSouvenir
    already?: boolean
    error?: string
  }
  if (res.status === 409 && data.error === "claim_closed") {
    throw new Error("claim_closed")
  }
  if (!res.ok || !data.claim) return null

  const claim: ClaimedSouvenir = {
    slug: data.claim.slug || souvenir.slug,
    walletAddress: wallet,
    claimedAt: data.claim.claimedAt || new Date().toISOString(),
    name: data.claim.name || souvenir.name,
    drop: data.claim.drop || souvenir.drop,
    imagePath: data.claim.imagePath || souvenir.imagePath,
  }
  rememberClaimedSouvenir(claim)
  return claim
}

export async function fetchAccountSouvenirs(): Promise<{
  catalog: CollectibleSouvenir[]
  claims: ClaimedSouvenir[]
} | null> {
  const res = await fetch("/api/souvenirs")
  if (!res.ok) return null
  const data = (await res.json().catch(() => null)) as {
    catalog?: CollectibleSouvenir[]
    claims?: ClaimedSouvenir[]
  } | null
  if (!data || !Array.isArray(data.catalog) || !Array.isArray(data.claims)) return null
  return { catalog: data.catalog, claims: data.claims }
}
