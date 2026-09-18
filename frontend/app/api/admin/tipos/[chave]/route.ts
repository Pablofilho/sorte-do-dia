import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminAuthenticated } from "@/lib/requireAdmin";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ chave: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  }

  const { chave } = await params;
  const body = await request.json().catch(() => ({}));

  const updates: Record<string, unknown> = {};
  if (typeof body.ativa === "boolean") updates.ativa = body.ativa;
  if (typeof body.linha === "number") updates.linha = body.linha;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("tipos_aposta")
    .update(updates)
    .eq("chave", chave)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }
  return NextResponse.json({ sucesso: true, tipo: data });
}
