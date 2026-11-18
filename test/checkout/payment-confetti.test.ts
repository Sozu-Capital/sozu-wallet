import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { PaymentConfetti } from "@/components/checkout/payment-confetti"

describe("payment confetti", () => {
  it("paints a light burst that stays out of the way", () => {
    const html = renderToStaticMarkup(createElement(PaymentConfetti))
    expect(html).toContain('data-payment-confetti=""')
    expect(html).toContain("pointer-events-none")
    expect(html).toContain("sozu-confetti-fall")
    expect(html).toContain("prefers-reduced-motion:reduce")
  })
})