import { afterEach, describe, expect, it, vi } from "vitest"
import {
  deliverSozuConnectResult,
  isSozuConnectSearch,
  sozuConnectSignupFailed,
  sozuConnectSuccess,
} from "./popup-result"

const ACCOUNT = "CAMVPBC6XL42KGHQPOLBBZ5EKIHER3DCNY2FRZH677JS2KWH4RNILEJH"
const CLASSIC = "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37"

describe("isSozuConnectSearch", () => {
  it("is connect mode only for connect=1", () => {
    expect(isSozuConnectSearch(new URLSearchParams("connect=1"))).toBe(true)
    expect(isSozuConnectSearch(new URLSearchParams("connect=0"))).toBe(false)
    expect(isSozuConnectSearch(new URLSearchParams(""))).toBe(false)
  })
})

describe("sozuConnectSuccess", () => {
  it("returns username and the C account", () => {
    expect(sozuConnectSuccess("ada", ACCOUNT)).toEqual({
      type: "sozu-connect",
      username: "ada",
      accountId: ACCOUNT,
    })
  })

  it("uppercases a C account and drops every other field", () => {
    const message = sozuConnectSuccess("  ada  ", ACCOUNT.toLowerCase())
    expect(message).toEqual({
      type: "sozu-connect",
      username: "ada",
      accountId: ACCOUNT,
    })
    expect(Object.keys(message ?? {}).sort()).toEqual(["accountId", "type", "username"])
  })

  it("refuses a missing C account, a G address, and a placeholder username", () => {
    expect(sozuConnectSuccess("ada", null)).toBeNull()
    expect(sozuConnectSuccess("ada", "")).toBeNull()
    expect(sozuConnectSuccess("ada", CLASSIC)).toBeNull()
    expect(sozuConnectSuccess("", ACCOUNT)).toBeNull()
    expect(sozuConnectSuccess("user", ACCOUNT)).toBeNull()
    expect(sozuConnectSuccess("ada", "not-an-account")).toBeNull()
  })
})

describe("sozuConnectSignupFailed", () => {
  it("is the failure the opener rejects", () => {
    expect(sozuConnectSignupFailed()).toEqual({
      type: "sozu-connect",
      error: "signup_failed",
    })
  })
})

describe("deliverSozuConnectResult", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("posts the public message to the opener and closes", () => {
    const posted: Array<{ data: unknown; origin: string }> = []
    let closed = false
    vi.stubGlobal("window", {
      opener: {
        closed: false,
        postMessage: (data: unknown, origin: string) => {
          posted.push({ data, origin })
        },
      },
      close: () => {
        closed = true
      },
    })

    const message = sozuConnectSuccess("ada", ACCOUNT)
    expect(message).not.toBeNull()
    deliverSozuConnectResult(message!)

    expect(posted).toEqual([{ data: message, origin: "*" }])
    expect(closed).toBe(true)
  })

  it("closes without posting when nothing opened the popup", () => {
    let closed = false
    vi.stubGlobal("window", {
      opener: null,
      close: () => {
        closed = true
      },
    })

    deliverSozuConnectResult(sozuConnectSignupFailed())
    expect(closed).toBe(true)
  })
})
