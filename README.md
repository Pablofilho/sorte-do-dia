# Sorte do Dia — @sortedodia01

Bot que gera vídeos verticais (TikTok) com palpites de futebol, publica o
histórico num painel web, e permite curar manualmente os jogos usados no
vídeo antes de gerar.

> Documento de retomada — atualizado em 17/09/2026 (sessão com Claude Code).
> Leia isto primeiro se estiver voltando de outra máquina/sessão.

## Arquitetura

```
┌─────────────────────┐        ┌──────────────────────────┐
│  main.py (cron)      │──────▶│  Supabase (Postgres)      │
│  roda local, 10h/15h │        │  casas_aposta             │
│  gera vídeo + música │◀──────│  tipos_aposta              │
└──────────┬───────────┘        │  configuracoes             │
           │                    │  historico_pipeline        │
           ▼                    └──────────────▲─────────────┘
   output/*.mp4 (local)                        │
                                                │ lê/escreve
                              ┌─────────────────┴─────────────────┐
                              │  Frontend Next.js — Vercel          │
                              │  /            → dashboard público   │
                              │  /admin       → painel c/ senha     │
                              │    - CRUD casas/tipos               │
                              │    - Gerar Bilhetes (Superbet)      │
                              └──────────────────────────────────────┘
```

- **`main.py` / `modules/`** — pipeline Python. Roda **localmente** (não dá
  pra rodar na Vercel — precisa de moviepy/ffmpeg e escreve arquivo local).
  Agendado via **cron** do sistema (ver `crontab -l`), não pelo
  `main.py --modo agendar` (esse modo existe mas não é o usado em produção).
- **Supabase** é a fonte de verdade de configuração. `config.json` na raiz
  do repo é **legado** — nada mais lê dele exceto `setup_drive.py`.
- **Frontend Next.js** (`frontend/`) deployado na **Vercel**, conectado ao
  GitHub (push em `main` → deploy automático).
  - `/` — dashboard público, só leitura (histórico + config).
  - `/admin` — painel protegido por senha, permite editar casas/tipos/config
    e gerar+confirmar bilhetes.

## Estado atual (o que já funciona)

- ✅ Pipeline gera vídeo com dados **reais** (scraping da Superbet, sem
  precisar de API paga) ou simulados (`--modo teste`).
- ✅ Emojis do vídeo corrigidos (a fonte do sistema não tem glifos de emoji —
  usamos ★/✓/⚠ que a DejaVu Sans suporta).
- ✅ Música de fundo (`assets/music/background.mp3`, Bensound - Energy, uso
  livre).
- ✅ Cron rodando `main.py --modo agora` às 10h e 15h.
- ✅ Painel `/admin` publicado, com:
  - CRUD de casas de aposta
  - Ativar/desativar tipos de aposta buscados
  - Config de agendamento e máximo de jogos por vídeo
  - **Gerar Bilhetes**: busca jogos reais da Superbet respeitando os tipos
    de aposta ativos, mostra pra revisão, e a seleção confirmada
    (`configuracoes.bilhetes_do_dia` no Supabase) é usada pelo pipeline no
    lugar da busca automática — se a data bater com hoje.
- ✅ RLS do Supabase travada: só o `service_role` (usado nas rotas do
  `/admin`) escreve em `casas_aposta`, `tipos_aposta`, `configuracoes`. A
  chave pública (anon/publishable) só lê essas tabelas. `historico_pipeline`
  continua com escrita aberta (o bot Python usa a chave pública pra logar).

## Limitações conhecidas / pendências

- **Só a Superbet tem scraping implementado.** Betano, Bet365 e Sportingbet
  aparecem no painel mas não geram bilhete (`"sem suporte ainda"`).
  - Bet365 foi **deixado de fora de propósito** — anti-bot pesado, não vale
    o risco/esforço.
  - Betano/Sportingbet: ninguém investigou a API pública ainda. Se quiser
    adicionar, o padrão a seguir é `frontend/lib/scraperSuperbet.ts` (mesma
    técnica: achar o endpoint JSON público que o próprio site consome).
- `ODDS_API_KEY` (The Odds API) nunca foi configurada — não é necessária
  hoje, mas o código ainda suporta como alternativa (`data_collector.py`).
- Upload pro Google Drive está **desativado** em `main.py` (comentário "sem
  Google Drive"). `modules/drive_uploader.py` e `setup_drive.py` existem mas
  não são chamados. Se reativar, tem um emoji quebrado lá (`🔗`) que precisa
  do mesmo tratamento que já foi feito no `video_generator.py`.
- Vídeo dura ~34s mesmo com `VIDEO_DURACAO=40` no config — a duração real é
  calculada por slide em `video_generator.py`, o valor de config não bate
  exatamente. Não chegamos a investigar/alinhar isso.
- O e-mail de autor dos commits mais antigos (antes de 18/09) ficou como
  `adminpablo@pablo-not01...` em vez do seu — só os commits depois disso
  usam `Pablo <pablo.filho@bol.com.br>`. Não reescrevi histórico.

## Segredos — onde estão (NADA disso está no git)

| Segredo | Onde vive | Pra que serve |
|---|---|---|
| `SUPABASE_URL` / `SUPABASE_KEY` (publishable) | `.env` local, `frontend/.env.local`, env vars da Vercel | Leitura pública do banco |
| `SUPABASE_SERVICE_ROLE_KEY` (secret) | `frontend/.env.local`, env vars da Vercel (server-only) | Escrita privilegiada nas rotas `/api/admin/*` |
| `ADMIN_PASSWORD` | env vars da Vercel (server-only) | Senha de login do `/admin` |
| `SESSION_SECRET` | env vars da Vercel (server-only) | Assina o cookie de sessão do `/admin` |
| Token GitHub | `~/.git-credentials` na máquina onde essa sessão rodou | Push sem pedir senha |

Se for continuar de **outra máquina**: as env vars já estão salvas na
Vercel (Settings → Environment Variables) e no Supabase (dashboard). Você
só precisa recriar `.env` e `frontend/.env.local` localmente se for rodar o
pipeline Python ou o Next.js dev server na máquina nova — veja
`.env.example` e `frontend/.env.local` (gitignored, peça pro Claude
reconstruir consultando o Supabase/Vercel se precisar).

## Como rodar localmente

```bash
# Pipeline Python
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # preencher SUPABASE_URL/SUPABASE_KEY
python3 main.py --modo teste   # simulado
python3 main.py --modo agora   # dados reais (Superbet)

# Frontend
cd frontend
npm install
# preencher frontend/.env.local (ver seção de segredos acima)
npm run dev
```

## Deploy

- **Vercel**: projeto `sorte-do-dia`, time `Pablo Filho's projects`. Push em
  `main` no GitHub dispara deploy automático. Root directory do projeto
  Vercel é `frontend`.
- **Cron do pipeline**: `crontab -l` na máquina que roda o bot mostra os
  horários. Se migrar de servidor, recriar essas linhas (rodam
  `.venv/bin/python3 main.py --modo agora`).

## Estrutura do repo

```
main.py                    # orquestrador do pipeline
modules/
  data_collector.py        # decide fonte dos jogos: bilhetes confirmados > Odds API > scraping Superbet > simulação
  scraper_superbet.py       # scraping da Superbet (Python, usado pelo pipeline)
  video_generator.py        # gera os slides + vídeo (Pillow + MoviePy)
  supabase_client.py         # cliente Supabase (chave pública)
  drive_uploader.py          # upload Google Drive (não usado atualmente)
frontend/
  app/page.tsx               # dashboard público
  app/admin/                 # painel admin (login + dashboard)
  app/api/admin/             # rotas protegidas (casas, tipos, config, gerar-bilhetes, login/logout)
  lib/supabase.ts            # cliente Supabase público (client-side)
  lib/supabaseAdmin.ts       # cliente Supabase privilegiado (server-only)
  lib/scraperSuperbet.ts     # scraping da Superbet (TypeScript, usado pelo botão "Gerar Bilhetes")
  lib/session.ts             # cookie de sessão assinado (HMAC)
supabase_schema.sql          # schema + políticas RLS (referência — já aplicado no projeto real)
```
