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
const DEVICE_SIG = Uint8Array.from(Array.from({ length: 64 }, (_, i) => i + 1))
const PASSKEY_ASSERTION = Uint8Array.from(Array.from({ length: 64 }, () => 0xab))

describe("deposit", () => {
  it("stores the logged-in classic account as the 32-byte owner", () => {
    const stored = deposit({ classicAccount: CLASSIC_ACCOUNT, deviceKey: DEVICE_KEY })

    expect(stored?.owner).toEqual(OWNER)
    expect(stored?.caller).toEqual(OWNER)
  })

  it("signs the cheque with the device key", () => {
    const stored = deposit({
      classicAccount: CLASSIC_ACCOUNT,
      deviceKey: DEVICE_KEY,
      deviceKeySignature: DEVICE_SIG,
      passkeyAssertion: PASSKEY_ASSERTION,
    })

    expect(stored?.deviceKey).toEqual(DEVICE_KEY)
    expect(stored?.signature).toEqual(DEVICE_SIG)
  })

  it("does not use a passkey assertion as the cheque signature", () => {
    const stored = deposit({
      classicAccount: CLASSIC_ACCOUNT,
      deviceKey: DEVICE_KEY,
      passkeyAssertion: PASSKEY_ASSERTION,
    })

    expect(stored?.owner).toEqual(OWNER)
    expect(stored?.signature).toBeNull()
  })

  it("supplies no owner and does not sign when login has no classic account", () => {
    const signed = {
      deviceKey: DEVICE_KEY,
      deviceKeySignature: DEVICE_SIG,
      passkeyAssertion: PASSKEY_ASSERTION,
    }

    expect(deposit({ classicAccount: null, ...signed })).toBeNull()
    expect(deposit({ classicAccount: "", ...signed })).toBeNull()
    expect(
      deposit({
        classicAccount: "CAEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBEEQTD2L",
        ...signed,
      }),
    ).toBeNull()
  })
})
