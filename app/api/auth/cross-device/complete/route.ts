/**
 * Cross-Device Registration Completion
 *
 * Phone calls this AFTER client-side verifyRegistration succeeds, so the
 * desktop poller can finish. Does not import client-only Turnkey helpers.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { requireSession } from "@/lib/auth/session"

export async function POST(request: NextRequest) {
  try {
    const auth = requireSession(request)
    if (auth.error) return auth.error

    const body = await request.json()
    const sessionId =
      typeof body?.sessionId === "string" ? body.sessionId.trim() : ""
    const username =
      typeof body?.username === "string" ? body.username.trim() : ""
    const userId = auth.userId
    const credentialId =
      typeof body?.credentialId === "string"
        ? body.credentialId.trim()
        : typeof body?.credential?.id === "string"
          ? body.credential.id.trim()
          : ""

    if (!sessionId || !username) {
      return NextResponse.json(
        { error: "Missing required fields (sessionId, username)" },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: "Service not available" }, { status: 500 })
    }

    const supabase = createServiceClient(supabaseUrl, supabaseServiceKey)

    const { data: session, error: sessionError } = await supabase
      .from("cross_device_sessions")
      .select("*")
      .eq("session_id", sessionId)
      .maybeSingle()

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    if (session.username !== username) {
      return NextResponse.json({ error: "Username mismatch" }, { status: 400 })
    }

    if (new Date(session.expires_at) < new Date()) {
      return NextResponse.json({ error: "Session expired" }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .maybeSingle()
    if (profile?.username !== session.username) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (session.completed) {
      return NextResponse.json({
        success: true,
        userId: session.user_id,
        username: session.username,
        alreadyCompleted: true,
      })
    }

    const { error: updateError } = await supabase
      .from("cross_device_sessions")
      .update({
        completed: true,
        user_id: userId,
        credential_id: credentialId || null,
        completed_at: new Date().toISOString(),
      })
      .eq("session_id", sessionId)

    if (updateError) {
      console.error("[Cross-Device Complete] Error updating session:", updateError)
      return NextResponse.json(
        { error: "Failed to update session" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      userId,
      username,
    })
  } catch (error) {
    console.error("[Cross-Device Complete] Error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
