import { describe, expect, it } from "vitest"
import {
  collectibleHomePath,
  readCollectibleReturn,
  souvenirDismissesToHome,
} from "@/lib/checkout/collectible-return"

const hash = "ab".repeat(32)

describe("collectible checkout return", () => {
  it("opens the profile on the paid collectible", () => {
    expect(collectibleHomePath(hash.toUpperCase())).toBe(
      `/home?profile=souvenirs&collectible=${hash}`,
    )
  })

  it("stays on home when the payment has no transaction hash", () => {
    expect(collectibleHomePath(null)).toBe("/home")
    expect(collectibleHomePath("already-submitted")).toBe("/home")
  })

  it("reads the return query and ignores other profile links", () => {
    expect(
      readCollectibleReturn({
        get: (name) => (name === "profile" ? "souvenirs" : name === "collectible" ? hash : null),
      }),
    ).toBe(hash)
    expect(
      readCollectibleReturn({
        get: (name) => (name === "profile" ? "open" : hash),
      }),
    ).toBeNull()
  })

  it("sends an outside tap on the returned collectible back to home", () => {
    expect(souvenirDismissesToHome(`receipt:${hash}`, hash)).toBe(true)
    expect(souvenirDismissesToHome(`receipt:${"c".repeat(64)}`, hash)).toBe(false)
    expect(souvenirDismissesToHome(`badge:event`, hash)).toBe(false)
    expect(souvenirDismissesToHome(`receipt:${hash}`, null)).toBe(false)
  })
})
