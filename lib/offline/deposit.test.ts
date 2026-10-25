import { describe, expect, it } from "vitest"
import { deposit } from "@/lib/offline/deposit"

const CLASSIC_ACCOUNT = "GDVEU3DD4KOFECV66VIHWEZOYX4ZKR3WV27L464SIIPOU2IUI3JCZA57"
const OWNER = Uint8Array.from([
  234, 74, 108, 99, 226, 156, 82, 10, 190, 245, 80, 123, 19, 46, 197, 249, 149, 71, 118, 174, 190,
  190, 123, 146, 66, 30, 234, 105, 20, 70, 210, 44,
])
const DEVICE_KEY = Uint8Array.from([
  2, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17,
  17, 17, 17, 17, 17, 17, 17, 17,
])

describe("deposit", () => {
  it("stores the logged-in classic account as the 32-byte owner", () => {
    const stored = deposit({ classicAccount: CLASSIC_ACCOUNT, deviceKey: DEVICE_KEY })

    expect(stored?.owner).toEqual(OWNER)
    expect(stored?.caller).toEqual(OWNER)
  })
})
