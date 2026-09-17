"""
Pipeline Principal — Orquestrador do projeto TikTok Apostas
Executa: Coleta → Geração → Log no Supabase
"""

import os
import sys
import time
import schedule
from datetime import datetime, date
from dotenv import load_dotenv

# Adiciona o diretório raiz ao path
sys.path.insert(0, os.path.dirname(__file__))

load_dotenv()

from modules.data_collector  import coletar_dados
from modules.video_generator import gerar_video
from modules.supabase_client import salvar_historico, get_config

LOG_DIR = os.path.join(os.path.dirname(__file__), "logs")
os.makedirs(LOG_DIR, exist_ok=True)

# Armazena os logs da execução atual
current_logs = []

def log(mensagem: str, nivel: str = "INFO"):
    """Registra mensagem no console, no log local e na lista em memória para o Supabase."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    linha = f"[{timestamp}] [{nivel}] {mensagem}"
    print(linha)
    
    current_logs.append({"tempo": timestamp, "nivel": nivel, "mensagem": mensagem})

    log_path = os.path.join(LOG_DIR, f"pipeline_{date.today().strftime('%Y-%m-%d')}.log")
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(linha + "\n")

def executar_pipeline(usar_simulacao: bool = False):
    """
    Executa o pipeline completo:
    1. Coleta dados de jogos e odds (agora lendo infos do Supabase)
    2. Gera o vídeo TikTok
    3. Salva histórico e logs no Supabase
    """
    global current_logs
    current_logs = []
    
    log("=" * 55)
    log("🚀 INICIANDO PIPELINE — SORTE DO DIA")
    log("=" * 55)

    status_final = "erro"
    jogos_salvos = []
    video_url = None

    try:
        # ── ETAPA 1: Coleta de Dados ──────────────────────
        log("📡 Etapa 1/3 — Coletando jogos do dia...")
        jogos = coletar_dados(usar_simulacao=usar_simulacao)

        if not jogos:
            log("Nenhum jogo encontrado para hoje.", nivel="WARN")
            status_final = "aviso"
            return

        log(f"✅ {len(jogos)} jogo(s) coletado(s)")
        jogos_salvos = [
            {
                "partida":    f"{j.get('time_casa')} x {j.get('time_fora')}",
                "dica":       j.get("dica"),
                "confianca":  j.get("confianca"),
                "odd_dica":   j.get("odd_dica", j.get("odd_casa")),
            }
            for j in jogos
        ]

        # ── ETAPA 2: Geração do Vídeo ─────────────────────
        log("🎬 Etapa 2/3 — Gerando vídeo TikTok...")
        hoje = date.today().strftime("%Y-%m-%d")
        nome_video = f"sorte_do_dia_{hoje}.mp4"
        caminho_video = gerar_video(jogos, nome_video)

        if not caminho_video or not os.path.exists(caminho_video):
            log("Falha ao gerar o vídeo.", nivel="ERROR")
            return

        log(f"✅ Vídeo gerado: {caminho_video}")
        
        # ── ETAPA 3: Finalização (sem Google Drive) ───────
        log("☁️  Etapa 3/3 — Concluindo e registrando no banco...")
        # Como o frontend vai servir ou você fará o upload manual, salvamos o caminho relativo.
        video_url = f"/videos/{nome_video}" 
        
        status_final = "sucesso"

    except Exception as e:
        log(f"ERRO no pipeline: {e}", nivel="ERROR")
        import traceback
        log(traceback.format_exc(), nivel="ERROR")

    finally:
        log("=" * 55)
        log(f"Pipeline finalizado — Status: {status_final.upper()}")
        log("=" * 55)
        
        # Salva o relatório no Supabase!
        try:
            salvar_historico(status_final, jogos_salvos, video_url, current_logs)
            log("📋 Relatório salvo no Supabase!")
        except Exception as e:
            log(f"Erro ao salvar no Supabase: {e}", nivel="ERROR")

def iniciar_agendador():
    """Lê os horários do Supabase e agenda a execução."""
    config_agendamento = get_config("agendamento")
    if not config_agendamento or not config_agendamento.get("ativo"):
        print("⏰ Agendamento desativado no painel.")
        return
        
    horarios = config_agendamento.get("horarios", ["10:00", "15:00"])
    
    log(f"⏰ Agendador iniciado. Horários: {', '.join(horarios)}")

    for horario in horarios:
        schedule.every().day.at(horario).do(executar_pipeline)

    while True:
        schedule.run_pending()
        time.sleep(60)

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Pipeline TikTok — Sorte do Dia")
    parser.add_argument(
        "--modo",
        choices=["agora", "agendar", "teste"],
        default="teste",
        help="agora=executa uma vez | agendar=modo contínuo | teste=dados simulados"
    )
    args = parser.parse_args()

    if args.modo == "teste":
        print("\n🧪 Modo TESTE — usando dados simulados\n")
        executar_pipeline(usar_simulacao=True)
    elif args.modo == "agora":
        print("\n▶️  Executando pipeline com dados reais...\n")
        executar_pipeline(usar_simulacao=False)
    elif args.modo == "agendar":
        iniciar_agendador()
