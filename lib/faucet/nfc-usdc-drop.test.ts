import { describe, expect, it } from "vitest"
import { NFC_USDC_DROP_PATH, nfcUsdcDropReturnPath } from "@/lib/faucet/nfc-usdc-drop"

describe("nfc usdc drop return", () => {
  it("allows only the standing wallet path", () => {
    expect(NFC_USDC_DROP_PATH).toBe("/get/usdc")
    expect(nfcUsdcDropReturnPath("/get/usdc")).toBe("/get/usdc")
    expect(nfcUsdcDropReturnPath(" /get/usdc ")).toBe("/get/usdc")
    expect(nfcUsdcDropReturnPath("/get/usdc?x=1")).toBeNull()
    expect(nfcUsdcDropReturnPath("/home")).toBeNull()
    expect(nfcUsdcDropReturnPath("https://app.sozu.capital/get/usdc")).toBeNull()
  })
})
