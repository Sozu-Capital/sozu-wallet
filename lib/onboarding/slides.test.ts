import { describe, expect, it } from "vitest"
import {
  WALLET_ACTIVATION_SLIDE_COUNT,
  activationCta,
  activationSlides,
} from "./slides"

const BANNED = [
  /15\s*%/,
  /\bAPY\b/i,
  /BNPL/i,
  /buy now/i,
  /compra ahora/i,
  /única llave/i,
  /only key/i,
  /solo tú/i,
  /only you/i,
  /crédito descentralizado/i,
  /decentralized credit/i,
  /checkout/i,
]

function joined(language: "es" | "en"): string {
  return activationSlides(language)
    .flatMap((slide) => [slide.step, slide.title, slide.body, slide.note])
    .join("\n")
}

describe("activation onboarding copy", () => {
  it("keeps four screens in each language", () => {
    expect(activationSlides("es")).toHaveLength(WALLET_ACTIVATION_SLIDE_COUNT)
    expect(activationSlides("en")).toHaveLength(WALLET_ACTIVATION_SLIDE_COUNT)
  })

  it("states the account, the passkey, USDC, and home actions", () => {
    const es = joined("es")
    const en = joined("en")
    expect(es).toContain("USDC")
    expect(es).toContain("Stellar")
    expect(es).toContain("llave de acceso")
    expect(es).toContain("Pagar")
    expect(es).toContain("Depositar")
    expect(es).toContain("no ofrece rendimiento ni préstamos")
    expect(en).toContain("passkey")
    expect(en).toContain("Pay")
    expect(en).toContain("Deposit")
    expect(en).toContain("does not offer yield or loans")
  })

  it("does not repeat the old marketing claims", () => {
    for (const language of ["es", "en"] as const) {
      const text = joined(language)
      for (const pattern of BANNED) {
        expect(text, `${language} matches ${pattern}`).not.toMatch(pattern)
      }
    }
  })

  it("names the last action as opening the wallet", () => {
    expect(activationCta("es", false)).toBe("Continuar")
    expect(activationCta("es", true)).toBe("Abrir billetera")
    expect(activationCta("en", false)).toBe("Continue")
    expect(activationCta("en", true)).toBe("Open wallet")
  })
})
