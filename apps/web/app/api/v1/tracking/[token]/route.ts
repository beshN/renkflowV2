import { NextResponse } from "next/server";
import { publicTracking } from "@/lib/features/manufacturing/platform.service";
import { consumeRateLimit, getClientIp, rateLimitResponse } from "@/lib/security/rate-limit";
export const dynamic = "force-dynamic";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const limit = await consumeRateLimit("publicTrackingRead", getClientIp(req.headers));
  if (!limit.allowed) return rateLimitResponse(limit);
  const data = await publicTracking((await params).token);
  return NextResponse.json(
    data
      ? { data }
      : { error: "Takip bağlantısı geçersiz veya süresi dolmuş." },
    {
      status: data ? 200 : 404,
      headers: {
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex",
      },
    },
  );
}
