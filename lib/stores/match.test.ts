import { describe, expect, it } from "vitest"
import { pickStore } from "./match"

describe("pickStore", () => {
  const stores = [
    { id: "a", name: "Pandevilla" },
    { id: "b", name: "Charlie Wok" },
  ]

  it("matches the store name ignoring case and surrounding space", () => {
    expect(pickStore("  pandevilla ", stores)?.id).toBe("a")
  })

  it("uses the only result when the name is not exact", () => {
    expect(pickStore("Swe", [{ id: "s", name: "Swe Store" }])?.id).toBe("s")
  })

  it("returns null when several stores share the query and none match exactly", () => {
    expect(pickStore("store", stores)).toBeNull()
  })
})
