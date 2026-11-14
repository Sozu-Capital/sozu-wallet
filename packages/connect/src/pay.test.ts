import { afterEach, describe, expect, it, vi } from "vitest"
import { login, pay, SOZU_CONNECT_ORIGIN } from "./index"

const ACCOUNT = "CAMVPBC6XL42KGHQPOLBBZ5EKIHER3DCNY2FRZH677JS2KWH4RNILEJH"
const DEST = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"
const HASH = "ab".repeat(32)

type Listener = (event: MessageEvent) => void

function installWindow() {
  const listeners = new Set<Listener>()
  const popup = { closed: false }
  const open = vi.fn(() => popup)
  vi.stubGlobal("window", {
    open,
    addEventListener: (_type: string, listener: Listener) => {
      listeners.add(listener)
    },
    removeEventListener: (_type: string, listener: Listener) => {
      listeners.delete(listener)
    },
  })

  return {
    open,
    popup,
    post(data: unknown, origin = SOZU_CONNECT_ORIGIN, source: unknown = popup) {
      const event = { data, origin, source } as MessageEvent
      for (const listener of listeners) listener(event)
    },
  }
}

describe("pay", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("opens the connect popup with the amount and address and resolves the transaction", async () => {
    const { open, post } = installWindow()
    const pending = pay({ amount: "5.50", to: DEST })

    const [url, name, features] = open.mock.calls[0] as [string, string, string]
    const parsed = new URL(url)
    expect(parsed.origin).toBe("https://dev.sozu.capital")
    expect(parsed.pathname).toBe("/auth")
    expect(parsed.searchParams.get("connect")).toBe("1")
    expect(parsed.searchParams.get("amount")).toBe("5.50")
    expect(parsed.searchParams.get("to")).toBe(DEST)
    expect(name).toBe("sozu-connect")
    expect(features).not.toContain("noopener")

    post({
      type: "sozu-connect",
      txHash: HASH.toUpperCase(),
      username: " ada ",
      accountId: ACCOUNT.toLowerCase(),
    })

    await expect(pending).resolves.toEqual({
      txHash: HASH,
      username: "ada",
      accountId: ACCOUNT,
    })
  })

  it("rejects a second pay while the first popup is still open", async () => {
    const { post } = installWindow()
    const first = pay({ amount: "5", to: DEST })
    await expect(pay({ amount: "9", to: DEST })).rejects.toThrow(/already has a popup open/)
    post({
      type: "sozu-connect",
      txHash: HASH,
      username: "ada",
      accountId: ACCOUNT,
    })
    await expect(first).resolves.toMatchObject({ txHash: HASH, username: "ada" })
  })

  it("rejects a bad amount or destination before opening the popup", async () => {
    const { open } = installWindow()
    await expect(pay({ amount: "1.12345678", to: DEST })).rejects.toThrow(/7 decimals/)
    await expect(pay({ amount: "0", to: DEST })).rejects.toThrow(/positive/)
    await expect(pay({ amount: "5", to: "ada" })).rejects.toThrow(/G or C/)
    expect(open).not.toHaveBeenCalled()
  })

  it("resolves a short Circle balance without a transaction", async () => {
    const { post } = installWindow()
    const pending = pay({ amount: "5", to: DEST })
    post({
      type: "sozu-connect",
      username: "ada",
      accountId: ACCOUNT,
      error: "insufficient_funds",
    })
    await expect(pending).resolves.toEqual({
      username: "ada",
      accountId: ACCOUNT,
      error: "insufficient_funds",
    })
  })

  it("does not resolve login() from a payment message", async () => {
    const { post } = installWindow()
    const pending = login()
    let settled = false
    pending.then(() => {
      settled = true
    })
    post({
      type: "sozu-connect",
      txHash: HASH,
      username: "ada",
      accountId: ACCOUNT,
    })
    await Promise.resolve()
    expect(settled).toBe(false)
    post({ type: "sozu-connect", username: "ada", accountId: ACCOUNT })
    await expect(pending).resolves.toEqual({ username: "ada", accountId: ACCOUNT })
  })
})
