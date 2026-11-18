import { NextRequest, NextResponse } from "next/server";
import { sozuPayOriginFromRequest } from "@/lib/sozupay-origin";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get("id");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing session id" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${sozuPayOriginFromRequest(request)}/api/checkout/public?id=${sessionId}`,
      {
        cache: "no-store",
      },
    );

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: data.error || `Failed to load session (${res.status})` },
        { status: res.status }
      );
    }

    const session = await res.json();
    return NextResponse.json(session);
  } catch (err) {
    console.error("[checkout/proxy] Error:", err);
    return NextResponse.json(
      { error: "Network error loading session" },
      { status: 500 }
    );
  }
}
