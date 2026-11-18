import type { CollectibleSouvenir } from "@/lib/merch/catalog"
import { listCollectibleSouvenirs } from "@/lib/merch/catalog"

const TITLE_MAX = 80
const DROP_MAX = 120
const IMAGE_MAX = 180_000
const SLUG_MAX = 80

const DATA_IMAGE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/
const PATH_IMAGE = /^\/merch\/[a-z0-9._/-]+\.(?:svg|png|jpe?g|webp)$/i
const HTTPS_IMAGE = /^https:\/\/[^\s]+$/i

export function souvenirSlugKey(slug: string): string {
  return slug.trim().toLowerCase()
}

export function isSouvenirClaimOpen(
  souvenir: Pick<CollectibleSouvenir, "claimStartsAt" | "claimEndsAt">,
  nowMs: number = Date.now(),
): boolean {
  const start = Date.parse(souvenir.claimStartsAt)
  const end = Date.parse(souvenir.claimEndsAt)
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return false
  return nowMs >= start && nowMs < end
}

export function mergeSouvenirCatalog(
  extra: readonly CollectibleSouvenir[],
  seeded: readonly CollectibleSouvenir[] = listCollectibleSouvenirs(),
): CollectibleSouvenir[] {
  const bySlug = new Map<string, CollectibleSouvenir>()
  for (const souvenir of seeded) {
    bySlug.set(souvenirSlugKey(souvenir.slug), souvenir)
  }
  for (const souvenir of extra) {
    bySlug.set(souvenirSlugKey(souvenir.slug), souvenir)
  }
  return [...bySlug.values()]
}

export function parseSouvenirImage(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const value = raw.trim()
  if (!value || value.length > IMAGE_MAX) return null
  if (DATA_IMAGE.test(value) || PATH_IMAGE.test(value) || HTTPS_IMAGE.test(value)) return value
  return null
}

export type SouvenirLaunchInput = {
  title: string
  imageUrl: string
  claimStartsAt: string
  claimEndsAt: string
  merchantOrgId: string | null
  merchantName: string
  slug?: string
}

export function parseSouvenirLaunch(body: unknown): SouvenirLaunchInput | { error: string } {
  if (!body || typeof body !== "object") return { error: "invalid_body" }
  const row = body as Record<string, unknown>
  const title = typeof row.title === "string" ? row.title.trim() : ""
  if (title.length < 1 || title.length > TITLE_MAX) return { error: "invalid_title" }
  const imageUrl = parseSouvenirImage(row.imageUrl)
  if (!imageUrl) return { error: "invalid_image" }
  const claimStartsAt = typeof row.claimStartsAt === "string" ? row.claimStartsAt.trim() : ""
  const claimEndsAt = typeof row.claimEndsAt === "string" ? row.claimEndsAt.trim() : ""
  const start = Date.parse(claimStartsAt)
  const end = Date.parse(claimEndsAt)
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return { error: "invalid_window" }
  const merchantName =
    typeof row.merchantName === "string" && row.merchantName.trim()
      ? row.merchantName.trim().slice(0, DROP_MAX)
      : title
  const merchantOrgId =
    typeof row.merchantOrgId === "string" && row.merchantOrgId.trim()
      ? row.merchantOrgId.trim().slice(0, 80)
      : null
  const slug =
    typeof row.slug === "string" && /^[a-z0-9-]{3,80}$/.test(row.slug.trim().toLowerCase())
      ? row.slug.trim().toLowerCase()
      : undefined
  return {
    title,
    imageUrl,
    claimStartsAt: new Date(start).toISOString(),
    claimEndsAt: new Date(end).toISOString(),
    merchantOrgId,
    merchantName,
    slug,
  }
}

export function slugFromSouvenirTitle(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
  return base.length >= 2 ? base : "souvenir"
}

export function allocateSouvenirSlug(title: string, unique: string): string {
  const root = slugFromSouvenirTitle(title)
  const suffix = unique.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 8) || "drop"
  return `${root}-${suffix}`.slice(0, SLUG_MAX)
}
