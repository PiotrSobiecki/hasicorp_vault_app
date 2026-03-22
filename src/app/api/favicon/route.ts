import { NextResponse } from "next/server";

// Only allow valid hostnames — no path traversal, no protocol injection
const DOMAIN_RE = /^[a-z0-9][a-z0-9.-]{0,252}[a-z0-9]$/i;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get("domain");

  if (!domain || !DOMAIN_RE.test(domain)) {
    return new NextResponse(null, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=48`,
      // Next.js fetch cache — revalidate once per day
      { next: { revalidate: 86400 } },
    );

    if (!res.ok) return new NextResponse(null, { status: 404 });

    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") ?? "image/png";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        // Tell the browser it can cache the icon for 24 h too
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
