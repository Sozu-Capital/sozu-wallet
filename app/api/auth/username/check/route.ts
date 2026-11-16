import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { getWalletTexts, type WalletLanguage } from "@/lib/wallet-texts"
import { findCanonicalTagOwner } from "@/lib/wallet/tag-owner"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

function resolveLang(raw: unknown): WalletLanguage {
  return raw === "en" ? "en" : "es"
}

/**
 * POST /api/auth/username/check
 * Check if a username/tag is available for registration
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, lang: rawLang } = body
    const lang = resolveLang(rawLang)
    const t = getWalletTexts(lang)

    if (!username || typeof username !== "string") {
      return NextResponse.json(
        { 
          available: false,
          error: lang === "es" ? "Se requiere un nombre de usuario" : "Username is required",
        },
        { status: 400, headers: corsHeaders(request) }
      )
    }

    if (username.length < 3 || username.length > 30) {
      return NextResponse.json(
        { 
          available: false,
          error: lang === "es"
            ? "El nombre debe tener entre 3 y 30 caracteres"
            : "Username must be between 3 and 30 characters",
        },
        { status: 400, headers: corsHeaders(request) }
      )
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json(
        { 
          available: false,
          error: lang === "es"
            ? "Solo letras, números y guion bajo"
            : "Username can only contain letters, numbers, and underscores",
        },
        { status: 400, headers: corsHeaders(request) }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseServiceKey || !supabaseUrl) {
      console.error("[Username Check] Missing Supabase service credentials")
      return NextResponse.json(
        { 
          available: false,
          error: lang === "es" ? "Servicio no disponible" : "Service not available",
          message: t.authCouldNotCheck,
        },
        { status: 500, headers: corsHeaders(request) }
      )
    }
    
    const { createClient: createServiceClient } = await import("@supabase/supabase-js")
    const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey)
    const owner = await findCanonicalTagOwner(serviceClient, username)
    let existingProfile: { id: string; username: string; recovery_pin_hash?: string | null } | null = null
    let checkError: { message?: string; code?: string } | null = null
    if (owner) {
      const loaded = await serviceClient
        .from("profiles")
        .select("id, username, recovery_pin_hash")
        .eq("id", owner.id)
        .maybeSingle()
      existingProfile = loaded.data
      checkError = loaded.error
    }

    if (checkError && (checkError.message?.includes("recovery_pin_hash") || checkError.code === "42703") && owner) {
      const retry = await serviceClient.from("profiles").select("id, username").eq("id", owner.id).maybeSingle()
      existingProfile = retry.data
        ? { ...retry.data, recovery_pin_hash: null }
        : null
      checkError = retry.error
    }
    
    if (checkError && checkError.code !== "PGRST116") {
      console.error("[Username Check] Error checking for existing username:", checkError)
      return NextResponse.json(
        { 
          available: false,
          error: lang === "es" ? "Error al verificar disponibilidad" : "Error checking username availability",
          message: t.authCouldNotCheck,
        },
        { status: 500, headers: corsHeaders(request) }
      )
    }
    
    if (existingProfile) {
      const pinEnabled = Boolean((existingProfile as { recovery_pin_hash?: string | null }).recovery_pin_hash)
      return NextResponse.json(
        {
          available: false,
          exists: true,
          pinEnabled,
          message: pinEnabled ? t.authUsernameTakenPasskeyPin : t.authUsernameTakenPasskey,
        },
        { status: 200, headers: corsHeaders(request) }
      )
    }

    return NextResponse.json(
      {
        available: true,
        exists: false,
        pinEnabled: false,
        message: t.authUsernameFree,
      },
      { status: 200, headers: corsHeaders(request) }
    )
  } catch (error) {
    console.error("[Username Check] Unexpected error:", error)
    return NextResponse.json(
      { 
        available: false,
        error: "Internal server error",
        message: getWalletTexts("es").authCouldNotCheck,
      },
      { status: 500, headers: corsHeaders(request) }
    )
  }
}
