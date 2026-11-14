import { afterEach, describe, expect, it, vi } from "vitest"
import { login, SOZU_CONNECT_ORIGIN } from "./index"

const ACCOUNT = "CAMVPBC6XL42KGHQPOLBBZ5EKIHER3DCNY2FRZH677JS2KWH4RNILEJH"

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

describe("login", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("opens the staging auth page and resolves the posted account", async () => {
    const { open, post } = installWindow()
    const pending = login()

    expect(open).toHaveBeenCalledOnce()
    const [url, name, features] = open.mock.calls[0] as [string, string, string]
    expect(url).toBe("https://dev.sozu.capital/auth?connect=1")
    expect(name).toBe("sozu-connect")
    expect(features).not.toContain("noopener")

    post({
      type: "sozu-connect",
      username: " ada ",
      accountId: ACCOUNT.toLowerCase(),
      token: "secret",
    })

    await expect(pending).resolves.toEqual({ username: "ada", accountId: ACCOUNT })
  })

  it("ignores messages from another origin or window", async () => {
    const { popup, post } = installWindow()
    const pending = login()
    let settled = false
    pending.then(() => {
      settled = true
    })

    post({ type: "sozu-connect", username: "ada", accountId: ACCOUNT }, "https://evil.example")
    post({ type: "sozu-connect", username: "ada", accountId: ACCOUNT }, SOZU_CONNECT_ORIGIN, {})
    post({ type: "other", username: "ada", accountId: ACCOUNT })
    await Promise.resolve()
    expect(settled).toBe(false)

    post({ type: "sozu-connect", username: "ada", accountId: ACCOUNT }, SOZU_CONNECT_ORIGIN, popup)
    await expect(pending).resolves.toEqual({ username: "ada", accountId: ACCOUNT })
  })

  it("rejects when the browser blocks the popup", async () => {
    installWindow()
    vi.stubGlobal("window", {
      ...window,
      open: () => null,
    })
    await expect(login()).rejects.toThrow(/blocked/)
  })
})
