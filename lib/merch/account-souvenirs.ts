import { listCollectibleSouvenirs, type CollectibleSouvenir } from "@/lib/merch/catalog"
import { isSouvenirClaimOpen, mergeSouvenirCatalog, souvenirSlugKey } from "@/lib/merch/souvenir-window"
import {
  getSouvenirClaim,
  getSouvenirDrop,
  insertSouvenirClaim,
  insertSouvenirDrop,
  isSouvenirStoreUnavailable,
  listSouvenirClaimsForUser,
  listSouvenirDrops,
} from "@/lib/db/souvenirs"
import type { ClaimedSouvenir } from "@/lib/merch/souvenirs"

export async function loadSouvenirCatalog(): Promise<CollectibleSouvenir[]> {
  try {
    return mergeSouvenirCatalog(await listSouvenirDrops())
  } catch (error) {
    if (isSouvenirStoreUnavailable(error)) return [...listCollectibleSouvenirs()]
    throw error
  }
}

export async function loadAccountSouvenirs(userId: string): Promise<{
  catalog: CollectibleSouvenir[]
  claims: ClaimedSouvenir[]
}> {
  const catalog = await loadSouvenirCatalog()
  try {
    return { catalog, claims: await listSouvenirClaimsForUser(userId) }
  } catch (error) {
    if (isSouvenirStoreUnavailable(error)) return { catalog, claims: [] }
    throw error
  }
}

export async function resolveSouvenir(slug: string): Promise<CollectibleSouvenir | null> {
  const key = souvenirSlugKey(slug)
  if (!key) return null
  try {
    const row = await getSouvenirDrop(key)
    if (row) return row
  } catch (error) {
    if (!isSouvenirStoreUnavailable(error)) throw error
  }
  return listCollectibleSouvenirs().find((item) => souvenirSlugKey(item.slug) === key) ?? null
}

export async function claimSouvenirForAccount(input: {
  userId: string
  slug: string
  walletAddress: string
}): Promise<
  | { ok: true; claim: ClaimedSouvenir; already: boolean }
  | { ok: false; error: "missing" | "closed" | "unavailable" }
> {
  const souvenir = await resolveSouvenir(input.slug)
  if (!souvenir) return { ok: false, error: "missing" }

  try {
    const existing = await getSouvenirClaim(input.userId, souvenir.slug)
    if (existing) return { ok: true, claim: existing, already: true }

    if (!isSouvenirClaimOpen(souvenir)) return { ok: false, error: "closed" }

    const seeded = listCollectibleSouvenirs().find((item) => souvenirSlugKey(item.slug) === souvenirSlugKey(souvenir.slug))
    if (seeded) {
      await insertSouvenirDrop({
        slug: seeded.slug,
        title: seeded.name,
        drop: seeded.drop,
        imageUrl: seeded.imagePath,
        merchantOrgId: null,
        claimStartsAt: seeded.claimStartsAt,
        claimEndsAt: seeded.claimEndsAt,
      }).catch(() => "conflict")
    }

    const saved = await insertSouvenirClaim({
      userId: input.userId,
      slug: souvenir.slug,
      walletAddress: input.walletAddress,
      title: souvenir.name,
      drop: souvenir.drop,
      imageUrl: souvenir.imagePath,
    })
    if (saved === "conflict") {
      const again = await getSouvenirClaim(input.userId, souvenir.slug)
      if (again) return { ok: true, claim: again, already: true }
      return { ok: false, error: "unavailable" }
    }
    return { ok: true, claim: saved, already: false }
  } catch (error) {
    if (isSouvenirStoreUnavailable(error)) return { ok: false, error: "unavailable" }
    throw error
  }
}
