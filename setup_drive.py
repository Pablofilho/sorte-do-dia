"""
Script de autenticação e configuração inicial do Google Drive.
Cria a pasta "TikTok - Sorte do Dia" e salva o token.
Execute UMA VEZ para autorizar o acesso.
"""

import os
import sys
import json
import webbrowser
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

BASE_DIR         = os.path.dirname(os.path.dirname(__file__))
CREDENTIALS_FILE = os.path.join(BASE_DIR, "credentials.json")
TOKEN_FILE       = os.path.join(BASE_DIR, "token.json")
CONFIG_PATH      = os.path.join(BASE_DIR, "config.json")

SCOPES = ["https://www.googleapis.com/auth/drive.file"]

# Captura o código de autorização via servidor local temporário
auth_code_capturado = [None]

class AuthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        params = parse_qs(urlparse(self.path).query)
        if "code" in params:
            auth_code_capturado[0] = params["code"][0]
            self.send_response(200)
            self.send_header("Content-type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(b"""
            <html><body style="font-family:sans-serif;background:#0a1a0a;color:#22c55e;text-align:center;padding:60px">
            <h1>&#x1F340; Autorizado com sucesso!</h1>
            <p style="color:#86efac">Pode fechar esta janela e voltar ao terminal.</p>
            </body></html>
            """)
        else:
            self.send_response(400)
            self.end_headers()

    def log_message(self, *args):
        pass  # Silencia logs do servidor HTTP


def autenticar():
    from google_auth_oauthlib.flow import Flow
    from google.oauth2.credentials import Credentials

    print("\n🔐 Iniciando autenticação com Google Drive...")

    flow = Flow.from_client_secrets_file(
        CREDENTIALS_FILE,
        scopes=SCOPES,
        redirect_uri="http://localhost:8765"
    )

    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent"
    )

    print("\n" + "="*60)
    print("📋 PASSO 1: Abra este link no seu navegador:")
    print("="*60)
    print(f"\n{auth_url}\n")
    print("="*60)

    # Tenta abrir o browser automaticamente
    try:
        webbrowser.open(auth_url)
        print("✅ Browser aberto automaticamente!")
    except Exception:
        print("⚠️  Copie o link acima e abra manualmente no browser.")

    print("\n⏳ Aguardando autorização... (o browser abrirá a página do Google)")

    # Servidor local para capturar o callback
    server = HTTPServer(("localhost", 8765), AuthHandler)
    server.handle_request()

    if not auth_code_capturado[0]:
        print("❌ Autorização não recebida.")
        return None

    print("✅ Código de autorização recebido!")

    # Troca código pelo token
    flow.fetch_token(code=auth_code_capturado[0])
    creds = flow.credentials

    # Salva token
    with open(TOKEN_FILE, "w") as f:
        f.write(creds.to_json())
    print(f"💾 Token salvo em: {TOKEN_FILE}")

    return creds


def criar_pasta_drive(service, nome="TikTok - Sorte do Dia"):
    """Cria (ou encontra) a pasta no Google Drive e retorna o ID."""
    # Verifica se já existe
    query = f"name='{nome}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
    result = service.files().list(q=query, fields="files(id, name)").execute()
    arquivos = result.get("files", [])

    if arquivos:
        folder_id = arquivos[0]["id"]
        print(f"📁 Pasta existente encontrada: '{nome}' (ID: {folder_id})")
        return folder_id

    # Cria nova pasta
    metadata = {
        "name": nome,
        "mimeType": "application/vnd.google-apps.folder"
    }
    pasta = service.files().create(body=metadata, fields="id").execute()
    folder_id = pasta.get("id")
    print(f"📁 Pasta criada: '{nome}' (ID: {folder_id})")
    return folder_id


def salvar_folder_id_no_config(folder_id: str):
    """Salva o folder_id no config.json."""
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        config = json.load(f)

    config["google_drive"]["folder_id"] = folder_id
    config["google_drive"]["ativo"] = True

    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)

    print(f"⚙️  config.json atualizado com folder_id: {folder_id}")


def main():
    print("\n🍀 Configuração Google Drive — Sorte do Dia")
    print("=" * 50)

    # 1. Autentica
    creds = autenticar()
    if not creds:
        sys.exit(1)

    # 2. Conecta ao Drive
    from googleapiclient.discovery import build
    service = build("drive", "v3", credentials=creds)

    # 3. Cria pasta
    print("\n📁 Configurando pasta no Google Drive...")
    folder_id = criar_pasta_drive(service)

    # 4. Salva no config
    salvar_folder_id_no_config(folder_id)

    # 5. Link da pasta
    link_pasta = f"https://drive.google.com/drive/folders/{folder_id}"
    print("\n" + "="*50)
    print("✅ GOOGLE DRIVE CONFIGURADO COM SUCESSO!")
    print("="*50)
    print(f"\n📂 Sua pasta no Drive:")
    print(f"   {link_pasta}\n")
    print("Os próximos vídeos gerados serão enviados automaticamente!")
    print("="*50 + "\n")


if __name__ == "__main__":
    main()
