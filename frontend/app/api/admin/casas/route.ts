import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminAuthenticated } from "@/lib/requireAdmin";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const nome = String(body.nome ?? "").trim();
  const url = String(body.url ?? "").trim();
  const ativa = body.ativa === undefined ? true : Boolean(body.ativa);

  if (!nome || !url) {
    return NextResponse.json({ erro: "Nome e URL são obrigatórios" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("casas_aposta")
    .insert({ nome, url, ativa })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }
  return NextResponse.json({ sucesso: true, casa: data });
}
