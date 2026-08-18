import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { queueDocumentAnalysis } from "@/lib/analysis/queue";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: analysis } = await supabase
    .from("document_analyses")
    .select("document_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!analysis) return NextResponse.json({ error: "Analiz bulunamadı." }, { status: 404 });
  if (analysis.status !== "failed") {
    return NextResponse.json({ error: "Yalnızca başarısız analiz yeniden denenebilir." }, { status: 409 });
  }

  try {
    const result = await queueDocumentAnalysis(analysis.document_id);
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Yeniden deneme başlatılamadı." },
      { status: 400 },
    );
  }
}
