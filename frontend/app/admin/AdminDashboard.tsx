"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Casa = { id: number; nome: string; url: string; ativa: boolean };
type Tipo = {
  chave: string;
  label: string;
  mercado: string;
  linha: number | null;
  ativa: boolean;
};
type ConfigRow = { chave: string; valor: Record<string, unknown> };
type Agendamento = { ativo: boolean; horarios: string[] };
type OddsApiConfig = {
  chave?: string;
  esportes?: string[];
  regioes?: string[];
  max_jogos_por_video?: number;
};

type MercadoPick = { label: string; escolha: string; odd: number; descricao?: string };
type BilheteSuportado = {
  casa: string;
  suportado: true;
  timeCasa: string;
  timeFora: string;
  esporte: string;
  dataHora: string;
  mercados: Record<string, MercadoPick>;
  oddsResultadoFinal?: { casa: number; empate: number; fora: number };
};
type BilheteNaoSuportado = { casa: string; suportado: false; erro?: string };
type Bilhete = BilheteSuportado | BilheteNaoSuportado;

async function chamarApi(url: string, method: string, body?: unknown) {
  const resp = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data.erro ?? `Erro ${resp.status}`);
  }
  return data;
}

export default function AdminDashboard({
  casasIniciais,
  tiposIniciais,
  configsIniciais,
}: {
  casasIniciais: Casa[];
  tiposIniciais: Tipo[];
  configsIniciais: ConfigRow[];
}) {
  const router = useRouter();
  const [casas, setCasas] = useState<Casa[]>(casasIniciais);
  const [tipos, setTipos] = useState<Tipo[]>(tiposIniciais);

  const agendamentoInicial = (configsIniciais.find((c) => c.chave === "agendamento")
    ?.valor ?? { ativo: false, horarios: [] }) as Agendamento;
  const oddsApiInicial = (configsIniciais.find((c) => c.chave === "odds_api")?.valor ??
    {}) as OddsApiConfig;

  const [agendamento, setAgendamento] = useState<Agendamento>(agendamentoInicial);
  const [maxJogos, setMaxJogos] = useState<number>(oddsApiInicial.max_jogos_por_video ?? 3);
  const [novoHorario, setNovoHorario] = useState("");

  const [novaCasaNome, setNovaCasaNome] = useState("");
  const [novaCasaUrl, setNovaCasaUrl] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const [bilhetes, setBilhetes] = useState<Bilhete[]>([]);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [gerandoBilhetes, setGerandoBilhetes] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [mensagemBilhetes, setMensagemBilhetes] = useState("");

  function mostrarErro(e: unknown) {
    setErro(e instanceof Error ? e.message : "Erro inesperado");
    setTimeout(() => setErro(""), 5000);
  }

  async function handleLogout() {
    await chamarApi("/api/admin/logout", "POST");
    router.push("/");
    router.refresh();
  }

  // ── Casas de Aposta ─────────────────────────────────
  async function adicionarCasa(e: React.FormEvent) {
    e.preventDefault();
    if (!novaCasaNome.trim() || !novaCasaUrl.trim()) return;
    try {
      const { casa } = await chamarApi("/api/admin/casas", "POST", {
        nome: novaCasaNome,
        url: novaCasaUrl,
        ativa: true,
      });
      setCasas((prev) => [...prev, casa]);
      setNovaCasaNome("");
      setNovaCasaUrl("");
    } catch (e) {
      mostrarErro(e);
    }
  }

  async function alternarCasa(casa: Casa) {
    try {
      const { casa: atualizada } = await chamarApi(`/api/admin/casas/${casa.id}`, "PUT", {
        ativa: !casa.ativa,
      });
      setCasas((prev) => prev.map((c) => (c.id === casa.id ? atualizada : c)));
    } catch (e) {
      mostrarErro(e);
    }
  }

  async function removerCasa(id: number) {
    try {
      await chamarApi(`/api/admin/casas/${id}`, "DELETE");
      setCasas((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      mostrarErro(e);
    }
  }

  // ── Tipos de Aposta ─────────────────────────────────
  async function alternarTipo(tipo: Tipo) {
    try {
      const { tipo: atualizado } = await chamarApi(`/api/admin/tipos/${tipo.chave}`, "PUT", {
        ativa: !tipo.ativa,
      });
      setTipos((prev) => prev.map((t) => (t.chave === tipo.chave ? atualizado : t)));
    } catch (e) {
      mostrarErro(e);
    }
  }

  // ── Configurações ─────────────────────────────────
  async function salvarAgendamento(novoAgendamento: Agendamento) {
    setSalvando(true);
    try {
      await chamarApi("/api/admin/config/agendamento", "PUT", novoAgendamento);
      setAgendamento(novoAgendamento);
    } catch (e) {
      mostrarErro(e);
    } finally {
      setSalvando(false);
    }
  }

  function adicionarHorario() {
    if (!novoHorario) return;
    if (agendamento.horarios.includes(novoHorario)) return;
    const horarios = [...agendamento.horarios, novoHorario].sort();
    salvarAgendamento({ ...agendamento, horarios });
    setNovoHorario("");
  }

  function removerHorario(h: string) {
    salvarAgendamento({ ...agendamento, horarios: agendamento.horarios.filter((x) => x !== h) });
  }

  async function salvarMaxJogos() {
    setSalvando(true);
    try {
      await chamarApi("/api/admin/config/odds_api", "PUT", {
        ...oddsApiInicial,
        max_jogos_por_video: maxJogos,
      });
    } catch (e) {
      mostrarErro(e);
    } finally {
      setSalvando(false);
    }
  }

  // ── Gerar Bilhetes ─────────────────────────────────
  async function gerarBilhetes() {
    setGerandoBilhetes(true);
    setMensagemBilhetes("");
    try {
      const { bilhetes: novosBilhetes } = await chamarApi(
        "/api/admin/gerar-bilhetes",
        "POST"
      );
      setBilhetes(novosBilhetes);
      setSelecionados(
        new Set(
          (novosBilhetes as Bilhete[])
            .map((b, i) => (b.suportado ? i : -1))
            .filter((i) => i !== -1)
        )
      );
    } catch (e) {
      mostrarErro(e);
    } finally {
      setGerandoBilhetes(false);
    }
  }

  function alternarSelecao(indice: number) {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(indice)) novo.delete(indice);
      else novo.add(indice);
      return novo;
    });
  }

  function derivarDicaEConfianca(b: BilheteSuportado): { dica: string; confianca: string } {
    const principal = b.mercados.resultado_final;
    let odd: number;
    let dica: string;

    if (principal) {
      odd = principal.odd;
      const info = principal.descricao ?? principal.escolha;
      dica = info.includes("empate")
        ? "Empate"
        : info.replace(" vence a partida", " vence");
    } else {
      const [chave, pick] = Object.entries(b.mercados)[0] ?? [];
      odd = pick?.odd ?? 99;
      dica = pick ? `${pick.label}: ${pick.escolha}` : chave ?? "Apostar com cautela";
    }

    let confianca: string;
    if (odd <= 1.6) confianca = "Muito Alta ★★★";
    else if (odd <= 2.0) confianca = "Alta ★★";
    else if (odd <= 2.5) confianca = "Média ★";
    else confianca = "Arriscada ⚠";

    return { dica, confianca };
  }

  function formatarDataHora(bruta: string): string {
    // "YYYY-MM-DD HH:MM:SS" -> "DD/MM/YYYY HH:MM"
    const m = bruta.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/);
    if (!m) return bruta;
    const [, ano, mes, dia, hora, min] = m;
    return `${dia}/${mes}/${ano} ${hora}:${min}`;
  }

  async function confirmarSelecao() {
    setConfirmando(true);
    setMensagemBilhetes("");
    try {
      const jogos = bilhetes
        .map((b, i) => ({ b, i }))
        .filter(({ b, i }) => b.suportado && selecionados.has(i))
        .map(({ b }) => {
          const bilhete = b as BilheteSuportado;
          const { dica, confianca } = derivarDicaEConfianca(bilhete);
          return {
            time_casa: bilhete.timeCasa,
            time_fora: bilhete.timeFora,
            esporte: bilhete.esporte,
            data_hora: formatarDataHora(bilhete.dataHora),
            bookmaker: bilhete.casa,
            odd_casa: bilhete.oddsResultadoFinal?.casa ?? 0,
            odd_empate: bilhete.oddsResultadoFinal?.empate ?? 0,
            odd_fora: bilhete.oddsResultadoFinal?.fora ?? 0,
            dica,
            confianca,
          };
        });

      if (jogos.length === 0) {
        setMensagemBilhetes("Selecione ao menos um bilhete antes de confirmar.");
        return;
      }

      const hoje = new Date().toISOString().slice(0, 10);
      await chamarApi("/api/admin/config/bilhetes_do_dia", "PUT", { data: hoje, jogos });
      setMensagemBilhetes(
        `${jogos.length} bilhete(s) confirmado(s) — serão usados na próxima geração de vídeo.`
      );
    } catch (e) {
      mostrarErro(e);
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a1a0a] text-[#f0fdf4] p-8 font-sans">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#facc15]">Painel Admin</h1>
          <p className="text-[#86efac] mt-1">Sorte do Dia — Gerenciamento</p>
        </div>
        <button
          onClick={handleLogout}
          className="bg-[#1e4a1e] text-[#f0fdf4] px-4 py-2 rounded hover:bg-[#2a6a2a] transition text-sm"
        >
          Sair
        </button>
      </header>

      {erro && (
        <div className="mb-6 bg-red-900/50 text-red-300 border border-red-800 rounded px-4 py-2">
          {erro}
        </div>
      )}

      <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Casas de Aposta */}
        <section className="bg-[#122012] border border-[#1e4a1e] rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4 border-b border-[#1e4a1e] pb-2">
            Casas de Aposta
          </h2>
          <div className="space-y-3 mb-4">
            {casas.map((casa) => (
              <div
                key={casa.id}
                className="bg-[#0f2a0f] p-3 rounded-lg flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{casa.nome}</div>
                  <div className="text-xs text-[#4b7a4b] truncate">{casa.url}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <label className="flex items-center gap-1 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={casa.ativa}
                      onChange={() => alternarCasa(casa)}
                    />
                    Ativa
                  </label>
                  <button
                    onClick={() => removerCasa(casa.id)}
                    className="text-red-400 hover:text-red-300 text-sm px-2"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
            {casas.length === 0 && (
              <p className="text-[#4b7a4b] text-sm">Nenhuma casa cadastrada.</p>
            )}
          </div>
          <form onSubmit={adicionarCasa} className="flex flex-col gap-2 border-t border-[#1e4a1e] pt-4">
            <input
              placeholder="Nome (ex: Bet365)"
              value={novaCasaNome}
              onChange={(e) => setNovaCasaNome(e.target.value)}
              className="bg-[#0a1a0a] border border-[#1e4a1e] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#22c55e]"
            />
            <input
              placeholder="URL (https://...)"
              value={novaCasaUrl}
              onChange={(e) => setNovaCasaUrl(e.target.value)}
              className="bg-[#0a1a0a] border border-[#1e4a1e] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#22c55e]"
            />
            <button
              type="submit"
              className="bg-[#22c55e] text-black font-semibold py-2 rounded hover:bg-[#4ade80] transition text-sm"
            >
              Adicionar casa
            </button>
          </form>
        </section>

        {/* Tipos de Aposta */}
        <section className="bg-[#122012] border border-[#1e4a1e] rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4 border-b border-[#1e4a1e] pb-2">
            Tipos de Aposta buscados
          </h2>
          <div className="space-y-2">
            {tipos.map((tipo) => (
              <label
                key={tipo.chave}
                className="bg-[#0f2a0f] p-3 rounded-lg flex items-center justify-between gap-3 cursor-pointer"
              >
                <div>
                  <div className="font-medium">{tipo.label}</div>
                  <div className="text-xs text-[#4b7a4b]">
                    mercado: {tipo.mercado}
                    {tipo.linha !== null ? ` · linha ${tipo.linha}` : ""}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={tipo.ativa}
                  onChange={() => alternarTipo(tipo)}
                />
              </label>
            ))}
            {tipos.length === 0 && (
              <p className="text-[#4b7a4b] text-sm">Nenhum tipo cadastrado.</p>
            )}
          </div>
        </section>

        {/* Gerar Bilhetes */}
        <section className="bg-[#122012] border border-[#1e4a1e] rounded-xl p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4 border-b border-[#1e4a1e] pb-2">
            <h2 className="text-xl font-semibold">Gerar Bilhetes</h2>
            <button
              onClick={gerarBilhetes}
              disabled={gerandoBilhetes}
              className="bg-[#22c55e] text-black font-semibold px-4 py-2 rounded hover:bg-[#4ade80] transition text-sm disabled:opacity-50"
            >
              {gerandoBilhetes ? "Buscando..." : "Gerar bilhetes"}
            </button>
          </div>

          {bilhetes.length === 0 ? (
            <p className="text-[#4b7a4b] text-sm">
              Busca um jogo por casa de aposta ativa (respeitando os tipos de aposta
              marcados acima) pra você revisar antes de confirmar pro vídeo.
            </p>
          ) : (
            <>
              <div className="space-y-3 mb-4">
                {bilhetes.map((b, i) =>
                  b.suportado ? (
                    <label
                      key={i}
                      className="bg-[#0f2a0f] p-4 rounded-lg flex items-start gap-3 cursor-pointer block"
                    >
                      <input
                        type="checkbox"
                        checked={selecionados.has(i)}
                        onChange={() => alternarSelecao(i)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            {b.timeCasa} x {b.timeFora}
                          </span>
                          <span className="text-xs text-[#4b7a4b]">{b.casa}</span>
                        </div>
                        <div className="text-xs text-[#4b7a4b] mb-2">
                          {b.esporte} · {formatarDataHora(b.dataHora)}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(b.mercados).map(([chave, m]) => (
                            <span
                              key={chave}
                              className="bg-[#0a1a0a] border border-[#1e4a1e] rounded px-2 py-1 text-xs"
                            >
                              {m.label}: <span className="text-[#facc15]">{m.escolha}</span>{" "}
                              ({m.odd})
                            </span>
                          ))}
                        </div>
                      </div>
                    </label>
                  ) : (
                    <div
                      key={i}
                      className="bg-[#0f2a0f] p-4 rounded-lg flex items-center justify-between opacity-60"
                    >
                      <span className="font-medium">{b.casa}</span>
                      <span className="text-xs text-[#4b7a4b]">
                        {b.erro ?? "Sem busca automática ainda"}
                      </span>
                    </div>
                  )
                )}
              </div>
              <button
                onClick={confirmarSelecao}
                disabled={confirmando}
                className="bg-[#facc15] text-black font-semibold px-4 py-2 rounded hover:bg-[#fde047] transition text-sm disabled:opacity-50"
              >
                {confirmando ? "Confirmando..." : "Confirmar seleção pro vídeo"}
              </button>
            </>
          )}
          {mensagemBilhetes && (
            <p className="text-sm text-[#86efac] mt-3">{mensagemBilhetes}</p>
          )}
        </section>

        {/* Configurações Gerais */}
        <section className="bg-[#122012] border border-[#1e4a1e] rounded-xl p-6 lg:col-span-2">
          <h2 className="text-xl font-semibold mb-4 border-b border-[#1e4a1e] pb-2">
            Configurações Gerais
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-medium mb-2">Agendamento automático</h3>
              <label className="flex items-center gap-2 mb-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agendamento.ativo}
                  onChange={() => salvarAgendamento({ ...agendamento, ativo: !agendamento.ativo })}
                />
                Ativo
              </label>

              <div className="flex flex-wrap gap-2 mb-3">
                {agendamento.horarios.map((h) => (
                  <span
                    key={h}
                    className="bg-[#0f2a0f] border border-[#1e4a1e] rounded-full px-3 py-1 text-sm flex items-center gap-2"
                  >
                    {h}
                    <button
                      onClick={() => removerHorario(h)}
                      className="text-red-400 hover:text-red-300"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="time"
                  value={novoHorario}
                  onChange={(e) => setNovoHorario(e.target.value)}
                  className="bg-[#0a1a0a] border border-[#1e4a1e] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#22c55e]"
                />
                <button
                  onClick={adicionarHorario}
                  className="bg-[#1e4a1e] px-3 py-2 rounded text-sm hover:bg-[#2a6a2a] transition"
                >
                  Adicionar horário
                </button>
              </div>
              <p className="text-xs text-[#4b7a4b] mt-2">
                O agendamento real de execução é feito via cron no servidor — isso aqui só
                reflete a configuração usada.
              </p>
            </div>

            <div>
              <h3 className="font-medium mb-2">Vídeo</h3>
              <label className="block text-sm text-[#86efac] mb-1">
                Máximo de jogos por vídeo
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={maxJogos}
                  onChange={(e) => setMaxJogos(Number(e.target.value))}
                  className="bg-[#0a1a0a] border border-[#1e4a1e] rounded px-3 py-2 text-sm w-24 focus:outline-none focus:border-[#22c55e]"
                />
                <button
                  onClick={salvarMaxJogos}
                  disabled={salvando}
                  className="bg-[#1e4a1e] px-3 py-2 rounded text-sm hover:bg-[#2a6a2a] transition disabled:opacity-50"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
