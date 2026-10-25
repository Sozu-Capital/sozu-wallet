import { describe, expect, it } from "vitest"
import { deposit, pendingCheque } from "@/lib/offline/deposit"

const CLASSIC_ACCOUNT = "GDVEU3DD4KOFECV66VIHWEZOYX4ZKR3WV27L464SIIPOU2IUI3JCZA57"
const OWNER = Uint8Array.from([
  234, 74, 108, 99, 226, 156, 82, 10, 190, 245, 80, 123, 19, 46, 197, 249, 149, 71, 118, 174, 190,
  190, 123, 146, 66, 30, 234, 105, 20, 70, 210, 44,
])
const DEVICE_KEY = hex("02515c3d6eb9e396b904d3feca7f54fdcd0cc1e997bf375dca515ad0a6c3b4035f")
const DEVICE_SIG = hex(
  "7adc1753ff3e4c0c9f3f3c49c4571ed53c63cbc2bfc3365ec4ee8313775abb215b4d87a3500c40b624e4b30aefc49a6e73278becf0c31d10f76ef24d4347a1d2",
)
const CHEQUE_BODY = new TextEncoder().encode("sozu-offline-deposit")
const PASSKEY_ASSERTION = Uint8Array.from(Array.from({ length: 64 }, () => 0xab))

const SIGNED_CHEQUE_BODY = hex(
  "01010101010101010101010101010101010101010101010101010101010101010101020202020202020202020202020202028096980000000000a086010000000000201d9a000000000010ff5365000000000303030303030303030303030303030303030303030303030303030303030303040404040404040404040404040404040404040404040404040404040404040402de0da91a51db50590ecebe84f7708733152db212a04dae042563a84b9b7d66ce",
)
const CHEQUE_SIGNATURE = hex(
  "e4f23c5df4e90828127a93ebd7028dcd90ab153aa996b80c576858fd52760e4d4eeacde9d69e6f25280627ca28adc71f559934aac683cb26e1b7d106fe99c090",
)
const CHEQUE_FRAME =
  "SOZU1:AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQICAgICAgICAgICAgICAgKAlpgAAAAAAKCGAQAAAAAAIB2aAAAAAAAQ_1NlAAAAAAMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQC3g2pGlHbUFkOzr6E93CHMxUtshKgTa4EJWOoS5t9Zs7k8jxd9OkIKBJ6k-vXAo3NkKsVOqmWuAxXaFj9UnYOTU7qzenWnm8lKAYnyiitxx9VmTSqxoPLJuG30Qb-mcCQ"

function hex(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value, "hex"))
}

function u64le(body: Uint8Array, offset: number): bigint {
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength)
  return (BigInt(view.getUint32(offset + 4, true)) << 32n) + BigInt(view.getUint32(offset, true))
}

function chequeFields(body: Uint8Array) {
  return {
    network: body[1],
    vault: body.slice(2, 34),
    noteId: body.slice(34, 50),
    amount: u64le(body, 50),
    fee: u64le(body, 58),
    cap: u64le(body, 66),
    expiry: u64le(body, 74),
    payee: body.slice(82, 114),
  }
}

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
      chequeBody: CHEQUE_BODY,
    })

    expect(stored?.deviceKey).toEqual(DEVICE_KEY)
    expect(stored?.signature).toEqual(DEVICE_SIG)
  })

  it("does not use a passkey assertion as the cheque signature", () => {
    const stored = deposit({
      classicAccount: CLASSIC_ACCOUNT,
      deviceKey: DEVICE_KEY,
      deviceKeySignature: PASSKEY_ASSERTION,
      chequeBody: CHEQUE_BODY,
    })

    expect(stored?.owner).toEqual(OWNER)
    expect(stored?.signature).toBeNull()
  })

  it("supplies no owner and does not sign when login has no classic account", () => {
    const signed = {
      deviceKey: DEVICE_KEY,
      deviceKeySignature: DEVICE_SIG,
      chequeBody: CHEQUE_BODY,
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

describe("pendingCheque", () => {
  const fields = chequeFields(SIGNED_CHEQUE_BODY)
  const signed = {
    owner: SIGNED_CHEQUE_BODY.slice(114, 146),
    caller: SIGNED_CHEQUE_BODY.slice(114, 146),
    deviceKey: SIGNED_CHEQUE_BODY.slice(146, 179),
    signature: CHEQUE_SIGNATURE,
  }

  it("frames a signed cheque and leaves it pending", () => {
    expect(pendingCheque(signed, fields)).toEqual({
      frame: CHEQUE_FRAME,
      status: "pending",
    })
  })

  it("does not frame a cheque when the deposit is missing", () => {
    expect(pendingCheque(null, fields)).toBeNull()
  })

  it("does not frame a cheque when the P-256 check fails", () => {
    expect(pendingCheque(signed, { ...fields, amount: fields.amount + 1n })).toBeNull()
    expect(pendingCheque({ ...signed, signature: null }, fields)).toBeNull()
  })

  it("does not frame a cheque from a passkey assertion", () => {
    expect(pendingCheque({ ...signed, signature: PASSKEY_ASSERTION }, fields)).toBeNull()
  })
})
