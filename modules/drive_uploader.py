"""
Módulo de Upload para o Google Drive
Envia o vídeo gerado para uma pasta específica no Drive.
"""

import os
import json
from datetime import date
from dotenv import load_dotenv

load_dotenv()

FOLDER_ID = os.getenv("GOOGLE_DRIVE_FOLDER_ID", "")
CREDENTIALS_FILE = os.path.join(os.path.dirname(__file__), "..", "credentials.json")
TOKEN_FILE        = os.path.join(os.path.dirname(__file__), "..", "token.json")


def autenticar() -> object:
    """
    Autentica com o Google Drive via OAuth2.
    Na primeira execução, abre o browser para login.
    Nas próximas, usa o token salvo automaticamente.
    """
    try:
        from google.oauth2.credentials import Credentials
        from google_auth_oauthlib.flow import InstalledAppFlow
        from google.auth.transport.requests import Request

        SCOPES = ["https://www.googleapis.com/auth/drive.file"]
        creds = None

        if os.path.exists(TOKEN_FILE):
            creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)

        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                if not os.path.exists(CREDENTIALS_FILE):
                    print("[DRIVE] ⚠️  credentials.json não encontrado!")
                    print("[DRIVE] Siga as instruções em docs/google_drive_setup.md")
                    return None
                flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
                creds = flow.run_local_server(port=0)

            with open(TOKEN_FILE, "w") as token:
                token.write(creds.to_json())

        return creds

    except ImportError:
        print("[DRIVE] Biblioteca Google não instalada. Execute: pip install google-api-python-client google-auth-oauthlib")
        return None


def fazer_upload(caminho_video: str, nome_arquivo: str = None) -> str | None:
    """
    Faz upload de um vídeo para o Google Drive.
    Retorna o link do arquivo ou None em caso de erro.
    """
    try:
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaFileUpload

        if not os.path.exists(caminho_video):
            print(f"[DRIVE] Arquivo não encontrado: {caminho_video}")
            return None

        creds = autenticar()
        if not creds:
            return None

        service = build("drive", "v3", credentials=creds)

        if not nome_arquivo:
            nome_arquivo = os.path.basename(caminho_video)

        # Metadados do arquivo
        file_metadata = {
            "name": nome_arquivo,
            "mimeType": "video/mp4",
        }
        if FOLDER_ID:
            file_metadata["parents"] = [FOLDER_ID]

        # Upload com barra de progresso
        media = MediaFileUpload(
            caminho_video,
            mimetype="video/mp4",
            resumable=True,
            chunksize=5 * 1024 * 1024,  # chunks de 5MB
        )

        print(f"\n[DRIVE] Fazendo upload: {nome_arquivo}")
        request = service.files().create(
            body=file_metadata,
            media_body=media,
            fields="id, name, webViewLink"
        )

        response = None
        while response is None:
            status, response = request.next_chunk()
            if status:
                pct = int(status.progress() * 100)
                print(f"[DRIVE] Upload: {pct}%", end="\r")

        file_id   = response.get("id")
        link      = response.get("webViewLink")
        nome_real = response.get("name")

        # Torna o arquivo acessível a qualquer pessoa com o link
        service.permissions().create(
            fileId=file_id,
            body={"type": "anyone", "role": "reader"},
        ).execute()

        print(f"\n✅ Upload concluído: {nome_real}")
        print(f"   🔗 Link: {link}")
        return link

    except Exception as e:
        print(f"[DRIVE] Erro no upload: {e}")
        return None


def salvar_local(caminho_video: str) -> str:
    """
    Fallback: apenas confirma que o vídeo está salvo localmente.
    Útil quando o Drive não está configurado.
    """
    if os.path.exists(caminho_video):
        tamanho = os.path.getsize(caminho_video) / (1024 * 1024)
        print(f"\n✅ Vídeo salvo localmente: {caminho_video}")
        print(f"   Tamanho: {tamanho:.1f} MB")
        return caminho_video
    return None


def enviar_video(caminho_video: str) -> str | None:
    """
    Ponto de entrada: tenta Drive primeiro, salva local como fallback.
    """
    if FOLDER_ID and os.path.exists(CREDENTIALS_FILE):
        link = fazer_upload(caminho_video)
        if link:
            return link

    # Fallback: salvar localmente
    print("[DRIVE] Drive não configurado. Vídeo salvo localmente.")
    return salvar_local(caminho_video)


if __name__ == "__main__":
    # Teste: verifica autenticação
    print("Testando autenticação no Google Drive...")
    creds = autenticar()
    if creds:
        print("✅ Autenticação bem-sucedida!")
    else:
        print("❌ Configure o credentials.json primeiro.")
        print("   Veja: docs/google_drive_setup.md")
