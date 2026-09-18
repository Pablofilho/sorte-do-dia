"""
Módulo de Coleta de Dados
Busca jogos do dia e odds nas APIs gratuitas
"""

import os
import requests
from datetime import datetime, date
from dotenv import load_dotenv
from modules.supabase_client import get_config
from modules.scraper_superbet import buscar_jogos as buscar_jogos_superbet

load_dotenv()

# API Football Key if needed
API_FOOTBALL_KEY = os.getenv("API_FOOTBALL_KEY", "")


# ─────────────────────────────────────────
# THE ODDS API — odds em tempo real
# ─────────────────────────────────────────

def buscar_jogos_com_odds(limite: int = 5) -> list[dict]:
    """
    Busca jogos com odds da The Odds API usando configurações do Supabase.
    """
    config_odds = get_config("odds_api")
    if not config_odds:
        print("[ERRO] Configuração 'odds_api' não encontrada no banco.")
        return []
        
    api_key = config_odds.get("chave")
    if not api_key:
        print("[ERRO] The Odds API Key não configurada no painel.")
        return []
        
    esportes = config_odds.get("esportes", ["soccer_brazil_campeonato"])
    esporte = esportes[0] if esportes else "soccer_brazil_campeonato"
    regioes = ",".join(config_odds.get("regioes", ["eu"]))
    
    url = f"https://api.the-odds-api.com/v4/sports/{esporte}/odds/"
    params = {
        "apiKey": api_key,
        "regions": regioes,
        "markets": "h2h",         
        "oddsFormat": "decimal",
        "dateFormat": "iso",
    }

    try:
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        dados = resp.json()

        jogos = []
        for jogo in dados[:limite]:
            bookmakers = jogo.get("bookmakers", [])
            if not bookmakers:
                continue

            # Pega odds do primeiro bookmaker disponível
            mercado = bookmakers[0].get("markets", [{}])[0]
            outcomes = mercado.get("outcomes", [])
            odds_dict = {o["name"]: o["price"] for o in outcomes}

            jogos.append({
                "time_casa":   jogo.get("home_team", ""),
                "time_fora":   jogo.get("away_team", ""),
                "data_hora":   jogo.get("commence_time", ""),
                "odd_casa":    odds_dict.get(jogo.get("home_team", ""), 0),
                "odd_empate":  odds_dict.get("Draw", 0),
                "odd_fora":    odds_dict.get(jogo.get("away_team", ""), 0),
                "bookmaker":   bookmakers[0].get("title", ""),
                "esporte":     esporte,
            })

        print(f"[DATA] {len(jogos)} jogos encontrados via The Odds API")
        return jogos

    except requests.exceptions.HTTPError as e:
        print(f"[ERRO] The Odds API: {e}")
        return []
    except Exception as e:
        print(f"[ERRO] buscar_jogos_com_odds: {e}")
        return []


# ─────────────────────────────────────────
# DADOS SIMULADOS — para testes sem API key
# ─────────────────────────────────────────

def jogos_simulados() -> list[dict]:
    """
    Retorna dados de jogos simulados para testar o pipeline
    sem precisar de chave de API.
    """
    hoje = date.today().strftime("%d/%m/%Y")
    return [
        {
            "time_casa":   "Flamengo",
            "time_fora":   "Palmeiras",
            "data_hora":   f"{hoje} 21:30",
            "odd_casa":    2.10,
            "odd_empate":  3.20,
            "odd_fora":    3.50,
            "bookmaker":   "Betano",
            "esporte":     "Brasileirão Série A",
            "dica":        "Flamengo vence",
            "confianca":   "Alta",
        },
        {
            "time_casa":   "Corinthians",
            "time_fora":   "São Paulo",
            "data_hora":   f"{hoje} 19:00",
            "odd_casa":    2.70,
            "odd_empate":  3.10,
            "odd_fora":    2.50,
            "bookmaker":   "Bet365",
            "esporte":     "Brasileirão Série A",
            "dica":        "São Paulo vence",
            "confianca":   "Média",
        },
        {
            "time_casa":   "Real Madrid",
            "time_fora":   "Barcelona",
            "data_hora":   f"{hoje} 16:00",
            "odd_casa":    1.85,
            "odd_empate":  3.80,
            "odd_fora":    4.20,
            "bookmaker":   "Betfair",
            "esporte":     "La Liga",
            "dica":        "Real Madrid vence",
            "confianca":   "Alta",
        },
    ]


# ─────────────────────────────────────────
# SELETOR INTELIGENTE DE DICA
# ─────────────────────────────────────────

def selecionar_melhor_dica(jogo: dict) -> dict:
    """
    Define automaticamente qual time tem mais chance de vencer
    com base na menor odd (favorito) e sugere o mercado.
    """
    odd_casa   = jogo.get("odd_casa", 99)
    odd_empate = jogo.get("odd_empate", 99)
    odd_fora   = jogo.get("odd_fora", 99)

    if odd_casa < odd_empate and odd_casa < odd_fora:
        jogo["dica"] = f"{jogo['time_casa']} vence"
        jogo["odd_dica"] = odd_casa
    elif odd_fora < odd_casa and odd_fora < odd_empate:
        jogo["dica"] = f"{jogo['time_fora']} vence"
        jogo["odd_dica"] = odd_fora
    else:
        jogo["dica"] = "Empate"
        jogo["odd_dica"] = odd_empate

    # Define confiança baseada na odd
    odd = jogo["odd_dica"]
    if odd <= 1.60:
        jogo["confianca"] = "Muito Alta ★★★"
    elif odd <= 2.00:
        jogo["confianca"] = "Alta ★★"
    elif odd <= 2.50:
        jogo["confianca"] = "Média ★"
    else:
        jogo["confianca"] = "Arriscada ⚠"

    return jogo


def coletar_dados(usar_simulacao: bool = False) -> list[dict]:
    """
    Ponto de entrada principal. Coleta jogos e adiciona dicas.
    Se usar_simulacao=True, usa dados locais sem API.
    """
    config_odds = get_config("odds_api")
    api_key_valida = config_odds and config_odds.get("chave")
    max_jogos = (config_odds or {}).get("max_jogos_por_video", 3)

    if usar_simulacao:
        print("[DATA] Usando dados simulados (modo simulação)")
        jogos = jogos_simulados()
    elif api_key_valida:
        jogos = buscar_jogos_com_odds()
    else:
        print("[DATA] Sem API key configurada — buscando jogos reais direto na Superbet")
        jogos = buscar_jogos_superbet(limite=max_jogos)
        if not jogos:
            print("[DATA] Nenhum jogo encontrado na Superbet, usando dados simulados")
            jogos = jogos_simulados()

    # Adiciona dica automática se não existir
    for i, jogo in enumerate(jogos):
        if "dica" not in jogo:
            jogos[i] = selecionar_melhor_dica(jogo)

    return jogos


if __name__ == "__main__":
    dados = coletar_dados(usar_simulacao=True)
    for j in dados:
        print(f"\n⚽ {j['time_casa']} x {j['time_fora']}")
        print(f"   Odds: {j['odd_casa']} / {j['odd_empate']} / {j['odd_fora']}")
        print(f"   Dica: {j['dica']} | Confiança: {j['confianca']}")
