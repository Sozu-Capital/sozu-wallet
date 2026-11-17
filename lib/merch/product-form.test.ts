import { describe, expect, it } from "vitest"
import { productFormForName } from "@/lib/merch/product-form"

describe("product form", () => {
  it("uses a shirt for tees and a cap for a 5-panel", () => {
    expect(productFormForName("T-shirt")).toBe("shirt")
    expect(productFormForName("Polera UNBLCK Drop-002")).toBe("shirt")
    expect(productFormForName("5-panel")).toBe("cap")
    expect(productFormForName("Five panel")).toBe("cap")
  })

  it("keeps any other product as goods named on the receipt", () => {
    expect(productFormForName("Tote")).toBe("goods")
    expect(productFormForName("")).toBe("goods")
  })
})
