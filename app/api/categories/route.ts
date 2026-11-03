import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth/session"

async function getUserId(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) return user.id
  return getSessionUserId(request)
}

export async function GET(request: Request) {
  const userId = await getUserId(request)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("expense_categories")
    .select("id, name, slug, icon, user_id")
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .order("name")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}
