import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });

  const { data, error } = await supabase
    .from("document_analyses")
    .select("*, analysis_generations!analysis_generations_analysis_id_fkey(*)")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Analiz bulunamadı." }, { status: 404 });
  return NextResponse.json(data);
}
