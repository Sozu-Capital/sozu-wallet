import { describe, expect, it } from "vitest"
import { CITY_SPOTS, projectCityDots } from "@/lib/city/spots"

describe("city dots", () => {
  it("keeps north up and spreads the Santiago spots", () => {
    const dots = projectCityDots(CITY_SPOTS)
    const byName = new Map(dots.map((dot) => [dot.name, dot]))
    const swe = byName.get("Swe Store")
    const casa = byName.get("Casawork")
    const charlie = byName.get("Charlie Wok")
    const pandevilla = byName.get("Pandevilla")
    if (!swe || !casa || !charlie || !pandevilla) throw new Error("missing spot")

    expect(swe.x).toBeLessThan(casa.x)
    expect(charlie.y).toBeLessThan(pandevilla.y)
    expect(swe.href).toBe("/city/spot/2")
  })
})
