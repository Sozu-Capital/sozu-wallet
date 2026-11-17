import { NextRequest, NextResponse } from "next/server"
import { insertSouvenirDrop, isSouvenirStoreUnavailable, listSouvenirDropsForOrg } from "@/lib/db/souvenirs"
import { isSouvenirLaunchAuthorized } from "@/lib/merch/souvenir-launch-auth"
import { allocateSouvenirSlug, parseSouvenirLaunch } from "@/lib/merch/souvenir-window"

export async function GET(request: NextRequest) {
  if (!isSouvenirLaunchAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const orgId = request.nextUrl.searchParams.get("orgId")?.trim()
  if (!orgId) return NextResponse.json({ error: "invalid_org" }, { status: 400 })
  try {
    return NextResponse.json({ souvenirs: await listSouvenirDropsForOrg(orgId) })
  } catch (error) {
    if (isSouvenirStoreUnavailable(error)) {
      return NextResponse.json({ error: "unavailable" }, { status: 503 })
    }
    throw error
  }
}

/** Merchants on Sozu Pay create a souvenir every wallet can claim during the window. */
export async function POST(request: NextRequest) {
  if (!isSouvenirLaunchAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = parseSouvenirLaunch(await request.json().catch(() => ({})))
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const unique = parsed.merchantOrgId ?? crypto.randomUUID()
  let slug = parsed.slug ?? allocateSouvenirSlug(parsed.title, unique)

  try {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const saved = await insertSouvenirDrop({
        slug,
        title: parsed.title,
        drop: parsed.merchantName,
        imageUrl: parsed.imageUrl,
        merchantOrgId: parsed.merchantOrgId,
        claimStartsAt: parsed.claimStartsAt,
        claimEndsAt: parsed.claimEndsAt,
      })
      if (saved !== "conflict") {
        return NextResponse.json({ souvenir: saved }, { status: 201 })
      }
      slug = allocateSouvenirSlug(parsed.title, crypto.randomUUID())
    }
    return NextResponse.json({ error: "conflict" }, { status: 409 })
  } catch (error) {
    if (isSouvenirStoreUnavailable(error)) {
      return NextResponse.json({ error: "unavailable" }, { status: 503 })
    }
    throw error
  }
}
