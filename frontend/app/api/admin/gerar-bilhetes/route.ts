import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminAuthenticated } from "@/lib/requireAdmin";
import { gerarBilhetesSuperbet } from "@/lib/scraperSuperbet";

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const [{ data: casas }, { data: tipos }, { data: configs }] = await Promise.all([
    supabase.from("casas_aposta").select("*").eq("ativa", true),
    supabase.from("tipos_aposta").select("*").eq("ativa", true),
    supabase.from("configuracoes").select("*").eq("chave", "odds_api"),
  ]);

  const maxJogos =
    (configs?.[0]?.valor as { max_jogos_por_video?: number } | undefined)
      ?.max_jogos_por_video ?? 3;

  const tiposAtivos = (tipos ?? []).map((t) => ({ chave: t.chave, linha: t.linha }));

  const resultados = [];

  for (const casa of casas ?? []) {
    if (casa.nome.trim().toLowerCase() === "superbet") {
      try {
        const bilhetes = await gerarBilhetesSuperbet(tiposAtivos, maxJogos);
        resultados.push(...bilhetes);
      } catch (e) {
        resultados.push({
          casa: casa.nome,
          suportado: false as const,
          erro: e instanceof Error ? e.message : "Erro ao buscar jogos",
        });
      }
    } else {
      resultados.push({ casa: casa.nome, suportado: false as const });
    }
  }

  return NextResponse.json({ bilhetes: resultados });
}
