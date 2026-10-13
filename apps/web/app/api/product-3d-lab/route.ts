import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ProductVisualizationSchema } from "@/lib/features/product-3d/catalog";
import { requireSameOriginJson } from "@/lib/features/manufacturing/http-security";
import { requireWorkOrderActor } from "@/lib/features/work-orders/security";

/** Local visual QA artifacts only. Unavailable in production. No arbitrary path or database writes. */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== "development")
    return new NextResponse(null, { status: 404 });
  try {
    await requireWorkOrderActor();
    requireSameOriginJson(request, 1_050_000);
    const text = await request.text();
    if (Buffer.byteLength(text) > 1_050_000)
      return new NextResponse(null, { status: 413 });
    const v = ProductVisualizationSchema.parse(JSON.parse(text));
    if (!v.image)
      return NextResponse.json(
        { error: "Görsel hazırlanmadı" },
        { status: 400 },
      );
    const directory = path.resolve(
      process.cwd(),
      "../../docs/product-3d/previews",
    );
    const extension = v.image.startsWith("data:image/png") ? "png" : "jpg",
      filename = `${v.configuration.kind}.${extension}`;
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, filename),
      Buffer.from(v.image.split(",")[1], "base64"),
    );
    return NextResponse.json(
      { file: filename },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Yerel inceleme görseli kaydedilemedi" },
      { status: 400 },
    );
  }
}
