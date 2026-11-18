import { describe, expect, it } from "vitest"
import { payOriginForWalletHost, sozuPayOriginFromRequest } from "@/lib/sozupay-origin"

describe("payOriginForWalletHost", () => {
  it("sends staging wallet to staging pay even if env points at production", () => {
    expect(payOriginForWalletHost("dev.sozu.capital", "https://pay.sozu.capital")).toBe(
      "https://dev.pay.sozu.capital",
    )
  })

  it("sends production wallet to production pay", () => {
    expect(payOriginForWalletHost("app.sozu.capital", "https://dev.pay.sozu.capital")).toBe(
      "https://pay.sozu.capital",
    )
  })

  it("uses the env origin for unknown hosts", () => {
    expect(payOriginForWalletHost("localhost:3000", "http://localhost:3001")).toBe(
      "http://localhost:3001",
    )
    expect(payOriginForWalletHost("sozu-wallet-git-preview.vercel.app", null)).toBe(
      "https://pay.sozu.capital",
    )
  })
})

describe("sozuPayOriginFromRequest", () => {
  it("prefers x-forwarded-host so Vercel staging hits staging pay", () => {
    const request = new Request("https://dev.sozu.capital/api/checkout/proxy?id=cs_1", {
      headers: {
        host: "dev.sozu.capital",
        "x-forwarded-host": "dev.sozu.capital",
      },
    })
    expect(sozuPayOriginFromRequest(request)).toBe("https://dev.pay.sozu.capital")
  })
})
