import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth/session"
import {
  INVITE_GOAL,
  INVITE_REWARD_USD,
  INVITE_SHARING_ENABLED,
  buildInviteCode,
  inviteCodeMatchesUsername,
} from "@/lib/referral/invite-code"

export const dynamic = "force-dynamic"

/**
 * GET /api/wallet/referral/invite
 * Returns the caller's standing invite code and progress toward $40.
 * Sharing is disabled: confirmedInvites stays 0 until invites can be sent.
 */
export async function GET(request: Request) {
  const userId = getSessionUserId(request)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 })
  }

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .maybeSingle()

  if (profileError) {
    console.error("[referral invite] profile", profileError.message)
    return NextResponse.json({ error: "unavailable" }, { status: 503 })
  }

  const username = typeof profile?.username === "string" ? profile.username.trim() : ""
  if (!username) {
    return NextResponse.json({ error: "no_username" }, { status: 404 })
  }

  const { data: authUser, error: authError } = await db.auth.admin.getUserById(userId)
  if (authError || !authUser.user) {
    console.error("[referral invite] user", authError?.message)
    return NextResponse.json({ error: "unavailable" }, { status: 503 })
  }

  const meta = (authUser.user.user_metadata ?? {}) as Record<string, unknown>
  const existing = typeof meta.invite_code === "string" ? meta.invite_code : ""
  let code = existing

  if (!inviteCodeMatchesUsername(existing, username)) {
    code = buildInviteCode(username)
    const { error: updateError } = await db.auth.admin.updateUserById(userId, {
      user_metadata: { ...meta, invite_code: code },
    })
    if (updateError) {
      console.error("[referral invite] save", updateError.message)
      return NextResponse.json({ error: "unavailable" }, { status: 503 })
    }
  }

  return NextResponse.json({
    code,
    username,
    confirmedInvites: 0,
    goal: INVITE_GOAL,
    rewardUsd: INVITE_REWARD_USD,
    sharingEnabled: INVITE_SHARING_ENABLED,
  })
}
