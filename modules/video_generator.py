"""
Módulo Gerador de Vídeo
Cria vídeos no formato TikTok (1080x1920) com texto + música
usando Pillow para os frames e MoviePy para montar o vídeo.
"""

import os
import textwrap
from datetime import date
from PIL import Image, ImageDraw, ImageFont
from moviepy import ImageClip, AudioFileClip, concatenate_videoclips
from dotenv import load_dotenv

load_dotenv()

# ─── Configurações de vídeo ───────────────────────────────
LARGURA     = int(os.getenv("VIDEO_LARGURA", 1080))
ALTURA      = int(os.getenv("VIDEO_ALTURA", 1920))
FPS         = int(os.getenv("VIDEO_FPS", 30))
DURACAO     = int(os.getenv("VIDEO_DURACAO", 40))  # segundos total

# ─── Paleta de cores "Sorte do Dia" ──────────────────────
VERDE_ESCURO   = (15, 40, 15)
VERDE_MEDIO    = (20, 80, 30)
VERDE_CLARO    = (34, 139, 34)
AMARELO        = (255, 215, 0)
BRANCO         = (255, 255, 255)
CINZA_CLARO    = (200, 200, 200)
PRETO          = (0, 0, 0)
VERDE_CARD     = (18, 60, 25)
BORDA_CARD     = (50, 150, 60)

ASSETS_DIR = os.path.join(os.path.dirname(__file__), "..", "assets")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "output")


# ─────────────────────────────────────────────────────────
# UTILITÁRIOS
# ─────────────────────────────────────────────────────────

def carregar_fonte(tamanho: int, negrito: bool = False) -> ImageFont.FreeTypeFont:
    """Tenta carregar fonte do sistema, usa padrão se não encontrar."""
    fontes_tentativas = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if negrito else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if negrito else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/ubuntu/Ubuntu-Bold.ttf" if negrito else "/usr/share/fonts/truetype/ubuntu/Ubuntu-R.ttf",
    ]
    for caminho in fontes_tentativas:
        if os.path.exists(caminho):
            try:
                return ImageFont.truetype(caminho, tamanho)
            except Exception:
                continue
    return ImageFont.load_default()


def texto_centralizado(draw: ImageDraw.Draw, texto: str, y: int, fonte: ImageFont.FreeTypeFont,
                        cor: tuple, largura_max: int = LARGURA, sombra: bool = True):
    """Desenha texto centralizado horizontalmente com sombra opcional."""
    bbox = draw.textbbox((0, 0), texto, font=fonte)
    w = bbox[2] - bbox[0]
    x = (largura_max - w) // 2
    if sombra:
        draw.text((x + 3, y + 3), texto, font=fonte, fill=(0, 0, 0, 180))
    draw.text((x, y), texto, font=fonte, fill=cor)
    return bbox[3] - bbox[1]  # retorna altura do texto


def retangulo_arredondado(draw: ImageDraw.Draw, x1: int, y1: int, x2: int, y2: int,
                           raio: int, fill: tuple, outline: tuple = None, outline_width: int = 3):
    """Desenha retângulo com cantos arredondados."""
    draw.rectangle([x1 + raio, y1, x2 - raio, y2], fill=fill)
    draw.rectangle([x1, y1 + raio, x2, y2 - raio], fill=fill)
    draw.ellipse([x1, y1, x1 + raio * 2, y1 + raio * 2], fill=fill)
    draw.ellipse([x2 - raio * 2, y1, x2, y1 + raio * 2], fill=fill)
    draw.ellipse([x1, y2 - raio * 2, x1 + raio * 2, y2], fill=fill)
    draw.ellipse([x2 - raio * 2, y2 - raio * 2, x2, y2], fill=fill)
    if outline:
        draw.arc([x1, y1, x1 + raio * 2, y1 + raio * 2], 180, 270, fill=outline, width=outline_width)
        draw.arc([x2 - raio * 2, y1, x2, y1 + raio * 2], 270, 360, fill=outline, width=outline_width)
        draw.arc([x1, y2 - raio * 2, x1 + raio * 2, y2], 90, 180, fill=outline, width=outline_width)
        draw.arc([x2 - raio * 2, y2 - raio * 2, x2, y2], 0, 90, fill=outline, width=outline_width)
        draw.line([x1 + raio, y1, x2 - raio, y1], fill=outline, width=outline_width)
        draw.line([x1 + raio, y2, x2 - raio, y2], fill=outline, width=outline_width)
        draw.line([x1, y1 + raio, x1, y2 - raio], fill=outline, width=outline_width)
        draw.line([x2, y1 + raio, x2, y2 - raio], fill=outline, width=outline_width)


# ─────────────────────────────────────────────────────────
# GERAÇÃO DE SLIDES (frames como imagens PIL)
# ─────────────────────────────────────────────────────────

def criar_slide_intro() -> Image.Image:
    """Slide de abertura com identidade do canal."""
    img = Image.new("RGB", (LARGURA, ALTURA), VERDE_ESCURO)
    draw = ImageDraw.Draw(img)

    # Gradiente simples (linhas horizontais)
    for y in range(ALTURA):
        ratio = y / ALTURA
        r = int(VERDE_ESCURO[0] + (VERDE_MEDIO[0] - VERDE_ESCURO[0]) * ratio)
        g = int(VERDE_ESCURO[1] + (VERDE_MEDIO[1] - VERDE_ESCURO[1]) * ratio)
        b = int(VERDE_ESCURO[2] + (VERDE_MEDIO[2] - VERDE_ESCURO[2]) * ratio)
        draw.line([(0, y), (LARGURA, y)], fill=(r, g, b))

    # Círculo decorativo central
    cx, cy = LARGURA // 2, ALTURA // 2 - 100
    draw.ellipse([cx - 180, cy - 180, cx + 180, cy + 180], fill=VERDE_CARD, outline=AMARELO, width=6)

    # Emoji/ícone (⚽ simulado com texto)
    fonte_emoji = carregar_fonte(140, negrito=True)
    texto_centralizado(draw, "⚽", cy - 100, fonte_emoji, AMARELO)

    # Nome do canal
    fonte_titulo = carregar_fonte(90, negrito=True)
    texto_centralizado(draw, "SORTE DO DIA", cy + 120, fonte_titulo, AMARELO)

    # Subtítulo
    fonte_sub = carregar_fonte(45)
    texto_centralizado(draw, "Palpites Esportivos", cy + 230, fonte_sub, CINZA_CLARO)

    # Data
    hoje = date.today().strftime("%d/%m/%Y")
    fonte_data = carregar_fonte(50, negrito=True)
    texto_centralizado(draw, hoje, cy + 310, fonte_data, BRANCO)

    # Rodapé
    fonte_rodape = carregar_fonte(38)
    texto_centralizado(draw, "@sortedodia01", ALTURA - 120, fonte_rodape, AMARELO)
    texto_centralizado(draw, "Siga para mais dicas! 🍀", ALTURA - 70, fonte_rodape, CINZA_CLARO)

    return img


def criar_slide_jogo(jogo: dict, numero: int, total: int) -> Image.Image:
    """Slide com detalhes de um jogo e odds."""
    img = Image.new("RGB", (LARGURA, ALTURA), VERDE_ESCURO)
    draw = ImageDraw.Draw(img)

    # Gradiente de fundo
    for y in range(ALTURA):
        ratio = y / ALTURA
        r = int(15 + 10 * ratio)
        g = int(40 + 50 * ratio)
        b = int(15 + 10 * ratio)
        draw.line([(0, y), (LARGURA, y)], fill=(r, g, b))

    margem = 50
    y_atual = 80

    # ── Header: Logo + Contador ──────────────────────────
    fonte_pequena = carregar_fonte(38)
    fonte_media   = carregar_fonte(52, negrito=True)
    fonte_grande  = carregar_fonte(72, negrito=True)
    fonte_xgrande = carregar_fonte(85, negrito=True)

    # Tag do canal
    retangulo_arredondado(draw, margem, y_atual, LARGURA - margem, y_atual + 70,
                          20, VERDE_CARD, BORDA_CARD)
    texto_centralizado(draw, f"🍀 SORTE DO DIA  |  Dica {numero}/{total}",
                       y_atual + 12, fonte_pequena, AMARELO)
    y_atual += 100

    # ── Esporte / Campeonato ──────────────────────────────
    esporte = jogo.get("esporte", "Futebol")
    if len(esporte) > 25:
        esporte = esporte[:25] + "..."
    texto_centralizado(draw, f"⚽ {esporte.upper()}", y_atual, fonte_pequena, CINZA_CLARO)
    y_atual += 70

    # ── Horário ───────────────────────────────────────────
    data_hora = str(jogo.get("data_hora", "Hoje"))
    if "T" in data_hora:  # formato ISO da API
        try:
            from datetime import datetime
            dt = datetime.fromisoformat(data_hora.replace("Z", "+00:00"))
            data_hora = dt.strftime("%d/%m %H:%M")
        except Exception:
            data_hora = "Hoje"
    texto_centralizado(draw, f"🕐 {data_hora}", y_atual, fonte_media, BRANCO)
    y_atual += 90

    # ── Linha separadora ──────────────────────────────────
    draw.line([(margem, y_atual), (LARGURA - margem, y_atual)], fill=BORDA_CARD, width=2)
    y_atual += 40

    # ── Times ─────────────────────────────────────────────
    time_casa = jogo.get("time_casa", "Time A").upper()
    time_fora = jogo.get("time_fora", "Time B").upper()

    # Ajusta tamanho da fonte se nome for longo
    tam_time = 75 if max(len(time_casa), len(time_fora)) <= 10 else 58
    fonte_time = carregar_fonte(tam_time, negrito=True)

    texto_centralizado(draw, time_casa, y_atual, fonte_time, BRANCO)
    y_atual += tam_time + 10

    fonte_vs = carregar_fonte(55, negrito=True)
    texto_centralizado(draw, "VS", y_atual, fonte_vs, AMARELO)
    y_atual += 70

    texto_centralizado(draw, time_fora, y_atual, fonte_time, CINZA_CLARO)
    y_atual += tam_time + 40

    # ── Card de Odds ──────────────────────────────────────
    draw.line([(margem, y_atual), (LARGURA - margem, y_atual)], fill=BORDA_CARD, width=2)
    y_atual += 30

    texto_centralizado(draw, "ODDS", y_atual, fonte_pequena, CINZA_CLARO)
    y_atual += 55

    # 3 colunas de odds
    col_w = (LARGURA - margem * 2) // 3
    col_labels = ["1 (Casa)", "X (Empate)", "2 (Fora)"]
    col_odds   = [
        f"{jogo.get('odd_casa', 0):.2f}",
        f"{jogo.get('odd_empate', 0):.2f}",
        f"{jogo.get('odd_fora', 0):.2f}",
    ]

    for i in range(3):
        x_col = margem + i * col_w
        retangulo_arredondado(draw, x_col + 8, y_atual, x_col + col_w - 8, y_atual + 110,
                              15, VERDE_CARD, BORDA_CARD)
        fonte_col_label = carregar_fonte(33)
        bbox = draw.textbbox((0, 0), col_labels[i], font=fonte_col_label)
        w = bbox[2] - bbox[0]
        draw.text((x_col + (col_w - w) // 2, y_atual + 10), col_labels[i],
                  font=fonte_col_label, fill=CINZA_CLARO)
        fonte_odd = carregar_fonte(52, negrito=True)
        bbox2 = draw.textbbox((0, 0), col_odds[i], font=fonte_odd)
        w2 = bbox2[2] - bbox2[0]
        draw.text((x_col + (col_w - w2) // 2, y_atual + 50), col_odds[i],
                  font=fonte_odd, fill=AMARELO)
    y_atual += 140

    # ── Dica em destaque ─────────────────────────────────
    y_atual += 20
    retangulo_arredondado(draw, margem, y_atual, LARGURA - margem, y_atual + 140,
                          25, AMARELO, None)
    fonte_dica_label = carregar_fonte(38)
    draw.text((margem + 30, y_atual + 15), "💡 NOSSA DICA:", font=fonte_dica_label, fill=PRETO)
    fonte_dica = carregar_fonte(58, negrito=True)
    dica_texto = jogo.get("dica", "Apostar com cautela")
    bbox_dica = draw.textbbox((0, 0), dica_texto, font=fonte_dica)
    dw = bbox_dica[2] - bbox_dica[0]
    draw.text(((LARGURA - dw) // 2, y_atual + 70), dica_texto, font=fonte_dica, fill=PRETO)
    y_atual += 170

    # ── Confiança ─────────────────────────────────────────
    confianca = jogo.get("confianca", "Média ⭐")
    texto_centralizado(draw, f"Confiança: {confianca}", y_atual, fonte_media, BRANCO)
    y_atual += 80

    # ── Bookmaker ─────────────────────────────────────────
    bookmaker = jogo.get("bookmaker", "")
    if bookmaker:
        texto_centralizado(draw, f"Fonte: {bookmaker}", y_atual, fonte_pequena, CINZA_CLARO)

    # ── Rodapé ────────────────────────────────────────────
    fonte_rodape = carregar_fonte(38)
    texto_centralizado(draw, "@sortedodia01  |  Siga para mais! 🍀", ALTURA - 80, fonte_rodape, AMARELO)

    return img


def criar_slide_encerramento(jogos: list[dict]) -> Image.Image:
    """Slide final com resumo de todas as dicas do dia."""
    img = Image.new("RGB", (LARGURA, ALTURA), VERDE_ESCURO)
    draw = ImageDraw.Draw(img)

    for y in range(ALTURA):
        ratio = y / ALTURA
        r = int(15 + 5 * ratio)
        g = int(40 + 40 * ratio)
        b = int(15 + 5 * ratio)
        draw.line([(0, y), (LARGURA, y)], fill=(r, g, b))

    fonte_titulo = carregar_fonte(80, negrito=True)
    fonte_sub    = carregar_fonte(48, negrito=True)
    fonte_item   = carregar_fonte(42)
    fonte_rodape = carregar_fonte(38)

    y = 120
    texto_centralizado(draw, "📋 RESUMO DO DIA", y, fonte_titulo, AMARELO)
    y += 120

    hoje = date.today().strftime("%d/%m/%Y")
    texto_centralizado(draw, hoje, y, fonte_sub, CINZA_CLARO)
    y += 90

    draw.line([(50, y), (LARGURA - 50, y)], fill=BORDA_CARD, width=3)
    y += 40

    for jogo in jogos:
        retangulo_arredondado(draw, 50, y, LARGURA - 50, y + 100, 15, VERDE_CARD, BORDA_CARD)
        draw.text((80, y + 12), f"⚽ {jogo.get('time_casa','')} x {jogo.get('time_fora','')}",
                  font=fonte_item, fill=BRANCO)
        draw.text((80, y + 57), f"   ✅ {jogo.get('dica', '')}",
                  font=fonte_item, fill=AMARELO)
        y += 120

    y += 20
    draw.line([(50, y), (LARGURA - 50, y)], fill=BORDA_CARD, width=3)
    y += 50

    texto_centralizado(draw, "⚠️ Aposte com responsabilidade!", y, fonte_sub, CINZA_CLARO)
    y += 80
    texto_centralizado(draw, "Nunca aposte mais do que pode perder.", y, fonte_item, CINZA_CLARO)

    # Botão de CTA
    y = ALTURA - 250
    retangulo_arredondado(draw, 100, y, LARGURA - 100, y + 110, 30, AMARELO)
    texto_centralizado(draw, "🍀 SIGA @sortedodia01", y + 25, carregar_fonte(52, negrito=True), PRETO)

    texto_centralizado(draw, "#apostasesportivas #tipsgratis #futebol", ALTURA - 100, fonte_rodape, CINZA_CLARO)

    return img


# ─────────────────────────────────────────────────────────
# MONTAGEM DO VÍDEO
# ─────────────────────────────────────────────────────────

def gerar_video(jogos: list[dict], nome_arquivo: str = None) -> str:
    """
    Gera o vídeo TikTok completo com todos os slides.
    Retorna o caminho do arquivo de saída.
    """
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    if not nome_arquivo:
        hoje = date.today().strftime("%Y-%m-%d")
        nome_arquivo = f"sorte_do_dia_{hoje}.mp4"

    caminho_saida = os.path.join(OUTPUT_DIR, nome_arquivo)
    print(f"\n[VIDEO] Iniciando geração: {nome_arquivo}")

    # ── Cria os slides ─────────────────────────────────
    slides_imgs = []

    # Intro (5 segundos)
    print("[VIDEO] Criando slide de abertura...")
    slides_imgs.append((criar_slide_intro(), 5))

    # Um slide por jogo
    for i, jogo in enumerate(jogos):
        print(f"[VIDEO] Criando slide jogo {i+1}/{len(jogos)}...")
        dur = max(8, DURACAO // (len(jogos) + 2))  # distribui duração
        slides_imgs.append((criar_slide_jogo(jogo, i + 1, len(jogos)), dur))

    # Encerramento (5 segundos)
    print("[VIDEO] Criando slide de encerramento...")
    slides_imgs.append((criar_slide_encerramento(jogos), 5))

    # ── Converte imagens PIL → clips MoviePy ──────────
    clips = []
    temp_files = []

    for idx, (img_pil, dur) in enumerate(slides_imgs):
        # Salva frame temporário
        temp_path = os.path.join(OUTPUT_DIR, f"_temp_frame_{idx}.png")
        img_pil.save(temp_path, "PNG")
        temp_files.append(temp_path)

        clip = ImageClip(temp_path).with_duration(dur)
        clips.append(clip)

    # ── Concatena todos os clips ───────────────────────
    print("[VIDEO] Concatenando clips...")
    video_final = concatenate_videoclips(clips, method="compose")

    # ── Adiciona música de fundo (se existir) ─────────
    musica_path = os.path.join(ASSETS_DIR, "music", "background.mp3")
    if os.path.exists(musica_path):
        print("[VIDEO] Adicionando música de fundo...")
        audio = AudioFileClip(musica_path).with_duration(video_final.duration)
        video_final = video_final.with_audio(audio)
    else:
        print("[VIDEO] ⚠️  Nenhuma música encontrada em assets/music/background.mp3")

    # ── Exporta o vídeo ───────────────────────────────
    print(f"[VIDEO] Exportando para: {caminho_saida}")
    video_final.write_videofile(
        caminho_saida,
        fps=FPS,
        codec="libx264",
        audio_codec="aac",
        logger=None,
    )

    # ── Limpa arquivos temporários ────────────────────
    for f in temp_files:
        try:
            os.remove(f)
        except Exception:
            pass

    print(f"\n✅ Vídeo gerado com sucesso: {caminho_saida}")
    return caminho_saida


if __name__ == "__main__":
    # Teste rápido com dados simulados
    from modules.data_collector import jogos_simulados
    jogos = jogos_simulados()
    caminho = gerar_video(jogos, "teste.mp4")
    print(f"Vídeo salvo em: {caminho}")
