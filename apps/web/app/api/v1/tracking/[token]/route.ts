import { NextResponse } from "next/server";
import { publicTracking } from "@/lib/features/manufacturing/platform.service";
export const dynamic = "force-dynamic";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
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
