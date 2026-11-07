import { afterEach, describe, expect, it, vi } from "vitest"
import { sendWaitlistConfirmation, waitlistConfirmLetter } from "./confirm-email"

describe("waitlist confirmation letter", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("tells a Spanish signup they are on the first closed beta, in black ink", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.sozu.capital")
    const letter = waitlistConfirmLetter("es", "ana@sozu.capital")

    expect(letter.subject).toBe("Estás en la primera lista")
    expect(letter.text).toContain("experimento de finanzas descentralizadas en Chile")
    expect(letter.text).toContain("primera lista del beta cerrado")
    expect(letter.text).toContain("Los premios van en camino.")
    expect(letter.text).toContain("honrarla durante toda nuestra relación comercial")
    expect(letter.html).toContain("color:#000000")
    expect(letter.html).toContain('src="https://app.sozu.capital/waitlist/knight.png"')
    expect(letter.html).toContain('align="right"')
    expect(letter.html).toContain("ana@sozu.capital")
  })

  it("writes the English letter when the signup was in English", () => {
    const letter = waitlistConfirmLetter("en", "ada@sozu.capital")
    expect(letter.subject).toBe("You're on the first list")
    expect(letter.text).toContain("decentralized-finance experiment in Chile")
    expect(letter.text).toContain("first closed-beta list")
    expect(letter.text).toContain("throughout our business relationship")
  })

  it("does not call Resend when the key is missing", async () => {
    vi.stubEnv("RESEND_API_KEY", "")
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const result = await sendWaitlistConfirmation({ email: "ana@sozu.capital", locale: "es" })

    expect(result).toEqual({ sent: false, skipped: true, error: "no_resend_key" })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})