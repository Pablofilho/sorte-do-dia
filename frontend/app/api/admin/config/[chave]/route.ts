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
  const valor = await request.json().catch(() => null);

  if (valor === null) {
    return NextResponse.json({ erro: "Corpo inválido" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("configuracoes")
    .update({ valor })
    .eq("chave", chave)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }
  return NextResponse.json({ sucesso: true, config: data });
}
