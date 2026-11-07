import { NextResponse } from "next/server"
import { clearSessionCookie } from "@/lib/auth/session"

export async function POST() {
  return clearSessionCookie(NextResponse.json({ success: true }))
}
