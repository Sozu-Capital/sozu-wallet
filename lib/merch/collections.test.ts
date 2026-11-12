import { describe, expect, it } from "vitest"
import { heldCollectibleSlugs } from "@/lib/merch/collections"
import { panelIndex, panelAuthReturnPath } from "@/lib/shell/panels"

const ITEM = `C${"A".repeat(55)}`
const OTHER = `C${"B".repeat(55)}`

describe("collectible holdings", () => {
  it("maps a registered contract balance to a card and ignores an unknown token", () => {
    const slugs = heldCollectibleSlugs(
      [
        { slug: "liquid-society", contractId: ITEM },
        { slug: "unrecorded", contractId: null },
      ],
      { [ITEM]: 1, [OTHER]: 4 },
    )
    expect(slugs).toEqual(["liquid-society"])
  })

  it("treats a zero balance and a failed read as not held", () => {
    expect(
      heldCollectibleSlugs([{ slug: "liquid-society", contractId: ITEM }], { [ITEM]: 0 }),
    ).toEqual([])
    expect(
      heldCollectibleSlugs([{ slug: "liquid-society", contractId: ITEM }], { [ITEM]: null }),
    ).toEqual([])
  })
})

describe("panel deep link", () => {
  it("opens collections from the collections panel name", () => {
    expect(panelIndex("collections")).toBe(3)
    expect(panelIndex("history")).toBe(2)
    expect(panelIndex("nope")).toBe(1)
    expect(panelAuthReturnPath("/home?panel=collections")).toBe("/home?panel=collections")
    expect(panelAuthReturnPath("/item/liquid-society")).toBeNull()
  })
})
