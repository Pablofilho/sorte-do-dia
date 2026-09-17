import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

def get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("SUPABASE_URL e SUPABASE_KEY devem estar configurados no .env")
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def get_config(chave: str):
    supabase = get_supabase()
    resposta = supabase.table("configuracoes").select("valor").eq("chave", chave).execute()
    if resposta.data:
        return resposta.data[0]["valor"]
    return None

def get_casas_ativas():
    supabase = get_supabase()
    resposta = supabase.table("casas_aposta").select("*").eq("ativa", True).execute()
    return resposta.data

def get_tipos_ativos():
    supabase = get_supabase()
    resposta = supabase.table("tipos_aposta").select("*").eq("ativa", True).execute()
    return resposta.data

def salvar_historico(status: str, jogos: list, video_url: str, logs: list):
    supabase = get_supabase()
    dados = {
        "status": status,
        "jogos": jogos,
        "video_url": video_url,
        "logs": logs
    }
    supabase.table("historico_pipeline").insert(dados).execute()
