import { describe, expect, it } from "vitest"
import { LIQUID_SOCIETY_SOUVENIR_SLUG, listCollectibleSouvenirs } from "@/lib/merch/catalog"
import {
  allocateSouvenirSlug,
  isSouvenirClaimOpen,
  mergeSouvenirCatalog,
  parseSouvenirLaunch,
} from "@/lib/merch/souvenir-window"

const NOW = Date.parse("2026-11-17T21:00:00.000-03:00")

describe("souvenir claim window", () => {
  it("lets a wallet claim only inside the timeframe", () => {
    const souvenir = {
      claimStartsAt: "2026-11-17T00:00:00.000-03:00",
      claimEndsAt: "2026-11-19T00:00:00.000-03:00",
    }
    expect(isSouvenirClaimOpen(souvenir, NOW)).toBe(true)
    expect(isSouvenirClaimOpen(souvenir, Date.parse("2026-11-16T23:00:00.000-03:00"))).toBe(false)
    expect(isSouvenirClaimOpen(souvenir, Date.parse("2026-11-19T00:00:00.000-03:00"))).toBe(false)
  })

  it("keeps Liquid Society claimable on the night before the event", () => {
    const seeded = listCollectibleSouvenirs().find((item) => item.slug === LIQUID_SOCIETY_SOUVENIR_SLUG)
    expect(seeded).toBeTruthy()
    expect(isSouvenirClaimOpen(seeded!, NOW)).toBe(true)
  })
})

describe("merchant souvenir launch", () => {
  it("takes an image, a title, and a claim window", () => {
    const parsed = parseSouvenirLaunch({
      title: "Noche Pizza",
      imageUrl: "data:image/jpeg;base64,aaaa",
      claimStartsAt: "2026-11-18T20:00:00.000-03:00",
      claimEndsAt: "2026-11-19T02:00:00.000-03:00",
      merchantName: "Da Bruno",
      merchantOrgId: "org_1",
    })
    expect(parsed).toMatchObject({
      title: "Noche Pizza",
      merchantName: "Da Bruno",
      merchantOrgId: "org_1",
    })
    if ("error" in parsed) throw new Error(parsed.error)
    expect(parsed.claimEndsAt > parsed.claimStartsAt).toBe(true)
  })

  it("rejects a window that already ended and a missing image", () => {
    expect(parseSouvenirLaunch({ title: "x", claimStartsAt: "2026-01-01", claimEndsAt: "2026-01-01" })).toEqual({
      error: "invalid_image",
    })
    expect(
      parseSouvenirLaunch({
        title: "x",
        imageUrl: "data:image/jpeg;base64,aa",
        claimStartsAt: "2026-11-19T00:00:00.000Z",
        claimEndsAt: "2026-11-18T00:00:00.000Z",
      }),
    ).toEqual({ error: "invalid_window" })
  })

  it("puts a merchant drop next to the seeded event badge", () => {
    const merged = mergeSouvenirCatalog([
      {
        slug: "noche-pizza-abc123",
        name: "Noche Pizza",
        drop: "Da Bruno",
        imagePath: "data:image/jpeg;base64,aa",
        claimStartsAt: "2026-11-18T00:00:00.000Z",
        claimEndsAt: "2026-11-19T00:00:00.000Z",
      },
    ])
    expect(merged.map((item) => item.slug)).toContain(LIQUID_SOCIETY_SOUVENIR_SLUG)
    expect(merged.map((item) => item.slug)).toContain("noche-pizza-abc123")
  })

  it("builds a stable slug from the title", () => {
    expect(allocateSouvenirSlug("Noche Pizza", "AbC-999")).toBe("noche-pizza-abc999")
  })
})
