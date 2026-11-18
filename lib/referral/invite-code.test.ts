import { describe, expect, it } from "vitest"
import {
  INVITE_GOAL,
  INVITE_REWARD_USD,
  INVITE_SHARING_ENABLED,
  buildInviteCode,
  inviteCodeMatchesUsername,
  inviteSlug,
} from "./invite-code"

describe("invite codes", () => {
  it("builds a username plus a short hash", () => {
    expect(buildInviteCode("Joaquin", "k4m2")).toBe("joaquin-k4m2")
    expect(buildInviteCode("$Luna_Sozu", "ab3d")).toBe("luna_sozu-ab3d")
  })

  it("keeps the code tied to that username", () => {
    const code = buildInviteCode("joaquin", "k4m2")
    expect(inviteCodeMatchesUsername(code, "Joaquin")).toBe(true)
    expect(inviteCodeMatchesUsername(code, "someoneelse")).toBe(false)
    expect(inviteCodeMatchesUsername("joaquin-k4m2-extra", "joaquin")).toBe(false)
  })

  it("falls back when the username has no usable characters", () => {
    expect(inviteSlug("$$$")).toBe("sozu")
    expect(buildInviteCode("...", "k4m2")).toBe("sozu-k4m2")
  })

  it("pays $40 after 20 confirmed invites, and sharing is off", () => {
    expect(INVITE_GOAL).toBe(20)
    expect(INVITE_REWARD_USD).toBe(40)
    expect(INVITE_SHARING_ENABLED).toBe(false)
  })
})
