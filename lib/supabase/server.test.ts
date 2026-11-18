import { describe, expect, it, vi } from "vitest"

vi.mock("next/headers", () => ({ cookies: vi.fn() }))

const { bindAuthToWalletSession } = await import("./server")

function clientWithSupabaseUser(id: string | null) {
  const getUser = vi.fn(async () => ({ data: { user: id ? { id } : null }, error: null }))
  return { auth: { getUser } } as unknown as Parameters<typeof bindAuthToWalletSession>[0]
}

describe("bindAuthToWalletSession", () => {
  it("reports the Supabase user when it matches the wallet session", async () => {
    const client = bindAuthToWalletSession(clientWithSupabaseUser("user-a"), "user-a")
    expect((await client.auth.getUser()).data.user?.id).toBe("user-a")
  })

  it("reports no user once the wallet cookie is gone (after logout)", async () => {
    const client = bindAuthToWalletSession(clientWithSupabaseUser("user-a"), null)
    expect((await client.auth.getUser()).data.user).toBeNull()
  })

  it("reports no user when the cookies name different users", async () => {
    const client = bindAuthToWalletSession(clientWithSupabaseUser("user-a"), "user-b")
    expect((await client.auth.getUser()).data.user).toBeNull()
  })

  it("reports no user when there is no Supabase session", async () => {
    const client = bindAuthToWalletSession(clientWithSupabaseUser(null), "user-a")
    expect((await client.auth.getUser()).data.user).toBeNull()
  })
})
