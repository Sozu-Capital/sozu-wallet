import { describe, expect, it } from "vitest"
import { normalizeOfflineUsdc, offlineAmountFits, offlineAndroidIntent, offlinePhoneLink } from "@/lib/offline/offline-link"

const ACCOUNT = "CAMVPBC6XL42KGHQPOLBBZ5EKIHER3DCNY2FRZH677JS2KWH4RNILEJH"

describe("offline phone link", () => {
  it("keeps a chosen amount on the passkey account", () => {
    expect(normalizeOfflineUsdc("10.00")).toBe("10")
    expect(normalizeOfflineUsdc("2.50")).toBe("2.5")
    expect(normalizeOfflineUsdc("0")).toBeNull()
    expect(offlineAmountFits("4", 10)).toBe(true)
    expect(offlineAmountFits("12", 10)).toBe(false)
    expect(offlinePhoneLink(ACCOUNT, "4")).toBe(`sozu://link?addr=${ACCOUNT}&usdc=4`)
    expect(offlinePhoneLink(ACCOUNT, "12")).toBe(`sozu://link?addr=${ACCOUNT}&usdc=12`)
    expect(offlineAndroidIntent(ACCOUNT, "4")).toBe(
      `intent://link?addr=${ACCOUNT}&usdc=4#Intent;scheme=sozu;package=capital.sozu.mesh;end`,
    )
  })
})
