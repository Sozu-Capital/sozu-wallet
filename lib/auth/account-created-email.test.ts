import { afterEach, describe, expect, it, vi } from "vitest"
import { accountCreatedLetter, accountEmailLocale, sendAccountCreatedEmail } from "./account-created-email"

describe("account created letter", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("tells a Spanish signup the passkey is the only access and the email is the backup", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.sozu.capital")
    const letter = accountCreatedLetter("es", "ana@sozu.capital", "@Ana")

    expect(letter.subject).toBe("Tu cuenta Sozu está lista")
    expect(letter.text).toContain("Solo vos tenés acceso.")
    expect(letter.text).toContain("@Ana")
    expect(letter.text).toContain("Nadie más puede entrar.")
    expect(letter.text).toContain("No pierdas esa llave.")
    expect(letter.text).toContain("este correo es el respaldo rápido")
    expect(letter.html).toContain("ana@sozu.capital")
    expect(letter.html).toContain('src="https://app.sozu.capital/waitlist/knight.png"')
    expect(letter.html).toContain('align="right"')
  })

  it("writes the English letter when signup was in English", () => {
    const letter = accountCreatedLetter("en", "ada@sozu.capital", "ada")

    expect(letter.subject).toBe("Your Sozu account is ready")
    expect(letter.text).toContain("Only you have access.")
    expect(letter.text).toContain("Nobody else can get in.")
    expect(letter.text).toContain("Don't lose that passkey.")
    expect(letter.text).toContain("this email is the quick backup")
  })

  it("defaults the letter to Spanish", () => {
    expect(accountEmailLocale("en")).toBe("en")
    expect(accountEmailLocale("es")).toBe("es")
    expect(accountEmailLocale(undefined)).toBe("es")
  })

  it("does not call Resend when the key is missing", async () => {
    vi.stubEnv("RESEND_API_KEY", "")
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const result = await sendAccountCreatedEmail({
      email: "ana@sozu.capital",
      locale: "es",
      tag: "ana",
    })

    expect(result).toEqual({ sent: false, skipped: true, error: "no_resend_key" })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})