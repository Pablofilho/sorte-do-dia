"""
Servidor Web Flask — Painel de Controle do Bot
Sorte do Dia | @sortedodia01
"""

import os
import sys
import json
import subprocess
import threading
from datetime import datetime, date
from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_cors import CORS

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

BASE_DIR    = os.path.dirname(os.path.dirname(__file__))
CONFIG_PATH = os.path.join(BASE_DIR, "config.json")
OUTPUT_DIR  = os.path.join(BASE_DIR, "output")
LOG_DIR     = os.path.join(BASE_DIR, "logs")

app = Flask(__name__)
CORS(app)

# ─── Estado global do pipeline ────────────────────────────
pipeline_status = {
    "rodando": False,
    "ultimo_log": [],
    "ultimo_resultado": None,
}


# ─────────────────────────────────────────────────────────
# HELPERS DE CONFIG
# ─────────────────────────────────────────────────────────

def ler_config() -> dict:
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def salvar_config(config: dict):
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)


# ─────────────────────────────────────────────────────────
# ROTAS DE PÁGINAS
# ─────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


# ─────────────────────────────────────────────────────────
# API — DASHBOARD
# ─────────────────────────────────────────────────────────

@app.route("/api/dashboard")
def api_dashboard():
    """Retorna dados para o dashboard principal."""
    config = ler_config()

    # Conta vídeos gerados
    videos = []
    if os.path.exists(OUTPUT_DIR):
        for f in sorted(os.listdir(OUTPUT_DIR), reverse=True):
            if f.endswith(".mp4"):
                caminho = os.path.join(OUTPUT_DIR, f)
                stat = os.stat(caminho)
                videos.append({
                    "nome":     f,
                    "tamanho":  round(stat.st_size / (1024 * 1024), 2),
                    "criado":   datetime.fromtimestamp(stat.st_mtime).strftime("%d/%m/%Y %H:%M"),
                    "url":      f"/api/videos/{f}",
                })

    # Último relatório
    ultimo_relatorio = None
    if os.path.exists(LOG_DIR):
        relatorios = sorted([f for f in os.listdir(LOG_DIR) if f.startswith("relatorio_")], reverse=True)
        if relatorios:
            with open(os.path.join(LOG_DIR, relatorios[0]), "r", encoding="utf-8") as f:
                ultimo_relatorio = json.load(f)

    return jsonify({
        "total_videos":       len(videos),
        "videos_recentes":    videos[:5],
        "pipeline_rodando":   pipeline_status["rodando"],
        "ultimo_resultado":   pipeline_status["ultimo_resultado"],
        "ultimo_relatorio":   ultimo_relatorio,
        "casas_ativas":       sum(1 for c in config["casas_de_aposta"] if c["ativa"]),
        "apostas_ativas":     sum(1 for t in config["tipos_de_aposta"].values() if t["ativo"]),
        "agendamento_ativo":  config["agendamento"]["ativo"],
        "horarios":           config["agendamento"]["horarios"],
    })


# ─────────────────────────────────────────────────────────
# API — CASAS DE APOSTA
# ─────────────────────────────────────────────────────────

@app.route("/api/casas", methods=["GET"])
def api_casas_get():
    config = ler_config()
    return jsonify(config["casas_de_aposta"])

@app.route("/api/casas", methods=["POST"])
def api_casas_adicionar():
    """Adiciona uma nova casa de aposta."""
    config = ler_config()
    dados = request.get_json()

    nova_casa = {
        "id":    max((c["id"] for c in config["casas_de_aposta"]), default=0) + 1,
        "nome":  dados.get("nome", "").strip(),
        "url":   dados.get("url", "").strip(),
        "ativa": dados.get("ativa", True),
    }

    if not nova_casa["nome"] or not nova_casa["url"]:
        return jsonify({"erro": "Nome e URL são obrigatórios"}), 400

    config["casas_de_aposta"].append(nova_casa)
    salvar_config(config)
    return jsonify({"sucesso": True, "casa": nova_casa})

@app.route("/api/casas/<int:casa_id>", methods=["PUT"])
def api_casas_atualizar(casa_id: int):
    """Atualiza uma casa de aposta (nome, url, ativa)."""
    config = ler_config()
    dados = request.get_json()

    for casa in config["casas_de_aposta"]:
        if casa["id"] == casa_id:
            casa["nome"]  = dados.get("nome", casa["nome"])
            casa["url"]   = dados.get("url", casa["url"])
            casa["ativa"] = dados.get("ativa", casa["ativa"])
            salvar_config(config)
            return jsonify({"sucesso": True, "casa": casa})

    return jsonify({"erro": "Casa não encontrada"}), 404

@app.route("/api/casas/<int:casa_id>", methods=["DELETE"])
def api_casas_deletar(casa_id: int):
    config = ler_config()
    config["casas_de_aposta"] = [c for c in config["casas_de_aposta"] if c["id"] != casa_id]
    salvar_config(config)
    return jsonify({"sucesso": True})


# ─────────────────────────────────────────────────────────
# API — TIPOS DE APOSTA
# ─────────────────────────────────────────────────────────

@app.route("/api/tipos-aposta", methods=["GET"])
def api_tipos_get():
    config = ler_config()
    return jsonify(config["tipos_de_aposta"])

@app.route("/api/tipos-aposta", methods=["PUT"])
def api_tipos_atualizar():
    """Atualiza configurações dos tipos de aposta."""
    config = ler_config()
    dados = request.get_json()

    for chave, valores in dados.items():
        if chave in config["tipos_de_aposta"]:
            config["tipos_de_aposta"][chave].update(valores)

    salvar_config(config)
    return jsonify({"sucesso": True, "tipos": config["tipos_de_aposta"]})


# ─────────────────────────────────────────────────────────
# API — CONFIGURAÇÕES GERAIS
# ─────────────────────────────────────────────────────────

@app.route("/api/config", methods=["GET"])
def api_config_get():
    config = ler_config()
    # Oculta chave da API no retorno
    config_seguro = dict(config)
    if config_seguro.get("odds_api", {}).get("chave"):
        config_seguro["odds_api"]["chave"] = "••••••••" + config_seguro["odds_api"]["chave"][-4:]
    return jsonify(config_seguro)

@app.route("/api/config", methods=["PUT"])
def api_config_atualizar():
    config = ler_config()
    dados = request.get_json()

    # Atualiza apenas campos enviados (não sobrescreve tudo)
    for secao, valores in dados.items():
        if secao in config and isinstance(valores, dict):
            # Não atualiza chave de API se vier mascarada
            if secao == "odds_api" and valores.get("chave", "").startswith("••••"):
                valores.pop("chave", None)
            config[secao].update(valores)

    salvar_config(config)
    return jsonify({"sucesso": True})


# ─────────────────────────────────────────────────────────
# API — PIPELINE
# ─────────────────────────────────────────────────────────

def _rodar_pipeline(simulacao: bool):
    """Roda o pipeline em thread separada."""
    global pipeline_status
    pipeline_status["rodando"] = True
    pipeline_status["ultimo_log"] = []

    try:
        main_path = os.path.join(BASE_DIR, "main.py")
        modo = "teste" if simulacao else "agora"

        process = subprocess.Popen(
            ["python3", main_path, "--modo", modo],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            cwd=BASE_DIR,
        )

        for linha in process.stdout:
            linha = linha.rstrip()
            if linha:
                pipeline_status["ultimo_log"].append({
                    "tempo":    datetime.now().strftime("%H:%M:%S"),
                    "mensagem": linha,
                })
                # Mantém apenas últimas 100 linhas
                if len(pipeline_status["ultimo_log"]) > 100:
                    pipeline_status["ultimo_log"].pop(0)

        process.wait()
        pipeline_status["ultimo_resultado"] = "sucesso" if process.returncode == 0 else "erro"

    except Exception as e:
        pipeline_status["ultimo_log"].append({"tempo": datetime.now().strftime("%H:%M:%S"), "mensagem": f"ERRO: {e}"})
        pipeline_status["ultimo_resultado"] = "erro"
    finally:
        pipeline_status["rodando"] = False

@app.route("/api/pipeline/rodar", methods=["POST"])
def api_pipeline_rodar():
    if pipeline_status["rodando"]:
        return jsonify({"erro": "Pipeline já está em execução"}), 409

    dados = request.get_json() or {}
    simulacao = dados.get("simulacao", False)

    thread = threading.Thread(target=_rodar_pipeline, args=(simulacao,), daemon=True)
    thread.start()

    return jsonify({"sucesso": True, "mensagem": "Pipeline iniciado!"})

@app.route("/api/pipeline/status")
def api_pipeline_status():
    return jsonify({
        "rodando":          pipeline_status["rodando"],
        "ultimo_resultado": pipeline_status["ultimo_resultado"],
        "logs":             pipeline_status["ultimo_log"][-30:],  # últimas 30 linhas
    })

@app.route("/api/pipeline/logs")
def api_pipeline_logs():
    return jsonify(pipeline_status["ultimo_log"])


# ─────────────────────────────────────────────────────────
# API — VÍDEOS
# ─────────────────────────────────────────────────────────

@app.route("/api/videos")
def api_videos():
    if not os.path.exists(OUTPUT_DIR):
        return jsonify([])
    videos = []
    for f in sorted(os.listdir(OUTPUT_DIR), reverse=True):
        if f.endswith(".mp4"):
            caminho = os.path.join(OUTPUT_DIR, f)
            stat = os.stat(caminho)
            videos.append({
                "nome":    f,
                "tamanho": round(stat.st_size / (1024 * 1024), 2),
                "criado":  datetime.fromtimestamp(stat.st_mtime).strftime("%d/%m/%Y %H:%M"),
                "url":     f"/api/videos/{f}",
            })
    return jsonify(videos)

@app.route("/api/videos/<nome>")
def api_video_download(nome: str):
    return send_from_directory(OUTPUT_DIR, nome, as_attachment=False)


# ─────────────────────────────────────────────────────────
# INICIALIZAÇÃO
# ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\n🌐 Painel Web — Sorte do Dia")
    print("=" * 40)
    print("   Acesse: http://localhost:5000")
    print("=" * 40 + "\n")
    app.run(host="0.0.0.0", port=5000, debug=False)
