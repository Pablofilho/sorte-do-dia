// Busca jogos e odds reais direto da API pública que o site da Superbet usa
// para renderizar a própria página (mesmo dado que qualquer visitante vê,
// sem login). Roda no servidor (rota admin), não precisa de chave paga.

const BASE_URL = "https://production-superbet-offer-br.freetls.fastly.net";
const SPORT_ID_FUTEBOL = "5";

const TORNEIOS_PRIORITARIOS: Record<string, string> = {
  "1698": "Brasileirão Série A",
  "106": "Premier League",
  "80794": "UEFA Champions League",
};

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  Accept: "application/json",
  Referer: "https://superbet.bet.br/",
};

type OddsSuperbet = {
  price: number;
  metadata: { name?: string; code?: string; info?: string };
};
type MarketSuperbet = { name: string; odds: OddsSuperbet[] };
type EventoSuperbet = {
  event_id: number;
  fixture: {
    event_name: string;
    event_date: string;
    utc_date: string;
    tournament_id: number;
  };
  markets: MarketSuperbet[];
};

export type MercadoPick = {
  label: string;
  escolha: string;
  odd: number;
  descricao?: string;
};

export type Bilhete = {
  casa: string;
  suportado: true;
  timeCasa: string;
  timeFora: string;
  esporte: string;
  dataHora: string;
  mercados: Record<string, MercadoPick>;
  // Odds 1X2 completas (não só a favorita) — usadas no formato de vídeo atual.
  oddsResultadoFinal?: { casa: number; empate: number; fora: number };
};

// Mapeia chave interna de tipos_aposta -> nome do mercado na Superbet
const MERCADO_SUPERBET: Record<string, string> = {
  resultado_final: "Resultado Final",
  ambas_marcam: "Ambas as Equipes Marcam",
  dupla_chance: "Dupla Chance",
  over_under: "Total de Gols",
};

async function buscarEventos(diasAFrente = 3): Promise<EventoSuperbet[]> {
  const agora = new Date();
  agora.setUTCMinutes(0, 0, 0);
  const fim = new Date(agora.getTime() + diasAFrente * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    startDate: agora.toISOString(),
    endDate: fim.toISOString(),
    index: "active-prematch",
    sports: SPORT_ID_FUTEBOL,
  });

  const resp = await fetch(`${BASE_URL}/v3/pt-BR/events?${params}`, {
    headers: HEADERS,
    cache: "no-store",
  });
  if (!resp.ok) {
    throw new Error(`Superbet respondeu ${resp.status}`);
  }
  const data = await resp.json();
  return data.events ?? [];
}

// A listagem de eventos só traz o mercado pré-selecionado (Resultado Final).
// Pra pegar os demais mercados (BTTS, Dupla Chance, Total de Gols) é preciso
// buscar o detalhe do evento — que vem como um stream (SSE); lemos só o
// primeiro frame, que já contém o snapshot completo dos mercados.
async function buscarMercadosCompletos(eventId: number): Promise<MarketSuperbet[]> {
  const params = new URLSearchParams({
    events: String(eventId),
    includeOnly: "fixture,markets",
  });

  const resp = await fetch(`${BASE_URL}/v3/subscription/pt-BR/events?${params}`, {
    headers: HEADERS,
    cache: "no-store",
  });
  if (!resp.ok || !resp.body) return [];

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let totalBytes = 0;
  const LIMITE_BYTES = 3_000_000;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.length;
      buffer += decoder.decode(value, { stream: true });
      if (buffer.includes("\n") || totalBytes > LIMITE_BYTES) break;
    }
  } finally {
    reader.cancel().catch(() => {});
  }

  let texto = buffer.startsWith("data:") ? buffer.slice(5) : buffer;
  const fimLinha = texto.indexOf("\n");
  if (fimLinha !== -1) texto = texto.slice(0, fimLinha);

  try {
    const data = JSON.parse(texto);
    const evento = Array.isArray(data) ? data[0] : data;
    return evento?.markets ?? [];
  } catch {
    return [];
  }
}

function extrairMercado(
  evento: EventoSuperbet,
  tipoChave: string,
  linha?: number | null
): MercadoPick | null {
  const nomeMercado = MERCADO_SUPERBET[tipoChave];
  if (!nomeMercado) return null;

  const mercado = evento.markets.find((m) => m.name === nomeMercado);
  if (!mercado) return null;

  if (tipoChave === "over_under") {
    const alvoLinha = linha ?? 2.5;
    const acima = mercado.odds.find((o) =>
      o.metadata.name?.startsWith(`Mais de ${alvoLinha}`)
    );
    if (!acima) return null;
    return {
      label: `Mais de ${alvoLinha} gols`,
      escolha: acima.metadata.name ?? "",
      odd: acima.price,
      descricao: acima.metadata.info,
    };
  }

  // Para os demais mercados, escolhe a odd favorita (menor preço = mais provável)
  const melhor = [...mercado.odds].sort((a, b) => a.price - b.price)[0];
  if (!melhor) return null;
  return {
    label: nomeMercado,
    escolha: melhor.metadata.info ?? melhor.metadata.name ?? "",
    odd: melhor.price,
    descricao: melhor.metadata.info,
  };
}

function extrairOddsResultadoFinal(
  evento: EventoSuperbet
): { casa: number; empate: number; fora: number } | undefined {
  const mercado = evento.markets.find((m) => m.name === "Resultado Final");
  if (!mercado) return undefined;

  const porCodigo: Record<string, number> = {};
  for (const o of mercado.odds) {
    if (o.metadata.code) porCodigo[o.metadata.code] = o.price;
  }
  if (!("1" in porCodigo) || !("0" in porCodigo) || !("2" in porCodigo)) {
    return undefined;
  }
  return { casa: porCodigo["1"], empate: porCodigo["0"], fora: porCodigo["2"] };
}

export async function gerarBilhetesSuperbet(
  tiposAtivos: { chave: string; linha: number | null }[],
  limite: number
): Promise<Bilhete[]> {
  const eventos = await buscarEventos();

  const eventosFiltrados = eventos
    .filter((e) => TORNEIOS_PRIORITARIOS[String(e.fixture.tournament_id)])
    .filter((e) => e.fixture.event_name.includes("·"))
    .sort((a, b) => a.fixture.utc_date.localeCompare(b.fixture.utc_date));

  const precisaDetalhe = tiposAtivos.some((t) => t.chave !== "resultado_final");
  const bilhetes: Bilhete[] = [];

  for (const evento of eventosFiltrados) {
    if (bilhetes.length >= limite) break;

    const markets = precisaDetalhe
      ? await buscarMercadosCompletos(evento.event_id)
      : evento.markets;
    if (markets.length === 0) continue;
    const eventoCompleto: EventoSuperbet = { ...evento, markets };

    const mercados: Record<string, MercadoPick> = {};
    for (const tipo of tiposAtivos) {
      const pick = extrairMercado(eventoCompleto, tipo.chave, tipo.linha);
      if (pick) mercados[tipo.chave] = pick;
    }

    if (Object.keys(mercados).length === 0) continue;

    const [timeCasa, timeFora] = evento.fixture.event_name.split("·");

    bilhetes.push({
      casa: "Superbet",
      suportado: true,
      timeCasa: timeCasa.trim(),
      timeFora: timeFora.trim(),
      esporte: TORNEIOS_PRIORITARIOS[String(evento.fixture.tournament_id)],
      dataHora: evento.fixture.event_date, // "YYYY-MM-DD HH:MM:SS"
      mercados,
      oddsResultadoFinal: extrairOddsResultadoFinal(eventoCompleto),
    });
  }

  return bilhetes;
}
