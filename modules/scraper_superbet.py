"""
Scraper — Superbet
Busca jogos e odds reais de "Resultado Final" (1X2) direto da API pública
que o site da Superbet usa para renderizar a própria página (mesmo dado
que qualquer visitante vê, sem login).

Não depende de chave de API paga — usa o endpoint público de eventos.
"""

import requests
from datetime import datetime, timedelta, timezone

BASE_URL = "https://production-superbet-offer-br.freetls.fastly.net"
SPORT_ID_FUTEBOL = "5"

# Torneios que o projeto prioriza (mesmo espírito da config antiga de odds_api.esportes)
TORNEIOS_PRIORITARIOS = {
    "1698":  "Brasileirão Série A",
    "106":   "Premier League",
    "80794": "UEFA Champions League",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Referer": "https://superbet.bet.br/",
}

TIMEOUT = 15


def _buscar_eventos(dias_a_frente: int = 3) -> list[dict]:
    """Busca eventos de futebol pré-jogo dos próximos N dias."""
    agora = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    params = {
        "startDate": agora.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
        "endDate": (agora + timedelta(days=dias_a_frente)).strftime("%Y-%m-%dT%H:%M:%S.000Z"),
        "index": "active-prematch",
        "sports": SPORT_ID_FUTEBOL,
    }
    resp = requests.get(f"{BASE_URL}/v3/pt-BR/events", headers=HEADERS, params=params, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json().get("events", [])


def _extrair_odds_1x2(evento: dict) -> dict | None:
    """Extrai as odds de Resultado Final (1X2) de um evento, se existirem."""
    for mercado in evento.get("markets", []):
        if mercado.get("name") != "Resultado Final":
            continue
        odds_por_codigo = {}
        for odd in mercado.get("odds", []):
            codigo = odd.get("metadata", {}).get("code")
            preco = odd.get("price")
            if codigo is not None and preco is not None:
                odds_por_codigo[codigo] = preco
        if {"1", "0", "2"}.issubset(odds_por_codigo.keys()):
            return {
                "odd_casa":   odds_por_codigo["1"],
                "odd_empate": odds_por_codigo["0"],
                "odd_fora":   odds_por_codigo["2"],
            }
    return None


def buscar_jogos(limite: int = 5) -> list[dict]:
    """
    Busca jogos reais (Brasileirão, Premier League, Champions League) com
    odds de Resultado Final direto da Superbet.
    Retorna lista no mesmo formato usado pelo restante do pipeline.
    """
    try:
        eventos = _buscar_eventos()
    except Exception as e:
        print(f"[SCRAPER] Erro ao buscar eventos da Superbet: {e}")
        return []

    jogos = []
    for evento in eventos:
        fixture = evento.get("fixture", {})
        tournament_id = str(fixture.get("tournament_id", ""))
        if tournament_id not in TORNEIOS_PRIORITARIOS:
            continue

        nome_evento = fixture.get("event_name", "")
        if "·" not in nome_evento:
            continue
        time_casa, _, time_fora = nome_evento.partition("·")

        odds = _extrair_odds_1x2(evento)
        if not odds:
            continue

        data_hora = fixture.get("event_date", "")  # "YYYY-MM-DD HH:MM:SS"
        try:
            dt = datetime.strptime(data_hora, "%Y-%m-%d %H:%M:%S")
            data_hora_fmt = dt.strftime("%d/%m/%Y %H:%M")
        except ValueError:
            data_hora_fmt = data_hora

        jogos.append({
            "time_casa":  time_casa.strip(),
            "time_fora":  time_fora.strip(),
            "data_hora":  data_hora_fmt,
            "odd_casa":   odds["odd_casa"],
            "odd_empate": odds["odd_empate"],
            "odd_fora":   odds["odd_fora"],
            "bookmaker":  "Superbet",
            "esporte":    TORNEIOS_PRIORITARIOS[tournament_id],
            "_kickoff":   fixture.get("utc_date", ""),
        })

    jogos.sort(key=lambda j: j["_kickoff"])
    for j in jogos:
        j.pop("_kickoff", None)

    print(f"[SCRAPER] {len(jogos)} jogo(s) encontrado(s) na Superbet (Brasileirão/Premier League/Champions)")
    return jogos[:limite]


if __name__ == "__main__":
    for j in buscar_jogos():
        print(f"\n⚽ {j['time_casa']} x {j['time_fora']} — {j['esporte']} — {j['data_hora']}")
        print(f"   Odds: {j['odd_casa']} / {j['odd_empate']} / {j['odd_fora']}")
