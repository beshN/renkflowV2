import { NextResponse } from "next/server";
import { queueDocumentAnalysis } from "@/lib/analysis/queue";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await queueDocumentAnalysis(id);
    return NextResponse.json(result, { status: result.reused ? 200 : 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analiz başlatılamadı.";
    const status = message.includes("limit") || message.includes("sınır") ? 429 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
