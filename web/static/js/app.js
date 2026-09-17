/* ═══════════════════════════════════════
   SORTE DO DIA — Dashboard JavaScript
═══════════════════════════════════════ */

let pollingInterval = null;
let tiposCache = {};

// ─────────────────────────────────────────────────────────
// INICIALIZAÇÃO
// ─────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  // Navegação por abas
  document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", e => {
      e.preventDefault();
      showTab(link.dataset.tab);
    });
  });

  // Data de hoje no header
  const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const dashDate = document.getElementById("dash-date");
  if (dashDate) dashDate.textContent = hoje.charAt(0).toUpperCase() + hoje.slice(1);

  // Carrega aba inicial
  showTab("dashboard");
  carregarDashboard();
  iniciarPolling();
});


// ─────────────────────────────────────────────────────────
// NAVEGAÇÃO
// ─────────────────────────────────────────────────────────

function showTab(tab) {
  document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));

  const el = document.getElementById(`tab-${tab}`);
  if (el) el.classList.add("active");

  const link = document.querySelector(`[data-tab="${tab}"]`);
  if (link) link.classList.add("active");

  // Carrega dados da aba
  switch (tab) {
    case "dashboard": carregarDashboard(); break;
    case "casas":     carregarCasas();     break;
    case "tipos":     carregarTipos();     break;
    case "pipeline":  atualizarStatusPipeline(); break;
    case "videos":    carregarVideos();    break;
    case "config":    carregarConfig();    break;
  }
}


// ─────────────────────────────────────────────────────────
// API HELPERS
// ─────────────────────────────────────────────────────────

async function api(endpoint, options = {}) {
  try {
    const resp = await fetch(endpoint, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    return await resp.json();
  } catch (e) {
    console.error("API error:", e);
    return null;
  }
}


// ─────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────

async function carregarDashboard() {
  const dados = await api("/api/dashboard");
  if (!dados) return;

  document.getElementById("total-videos").textContent    = dados.total_videos;
  document.getElementById("casas-ativas").textContent    = dados.casas_ativas;
  document.getElementById("apostas-ativas").textContent  = dados.apostas_ativas;
  document.getElementById("agendamento-status").textContent = dados.agendamento_ativo ? "Ativo ✅" : "Inativo";

  // Último relatório
  if (dados.ultimo_relatorio) {
    const card = document.getElementById("ultimo-relatorio-card");
    const rel  = dados.ultimo_relatorio;
    card.style.display = "";
    document.getElementById("ultimo-status-badge").textContent = rel.status === "sucesso" ? "✅ Sucesso" : "❌ Erro";
    document.getElementById("ultimo-status-badge").className   = `badge ${rel.status === "sucesso" ? "badge-success" : "badge-error"}`;

    const lista = document.getElementById("ultimo-jogos-lista");
    lista.innerHTML = rel.jogos?.map(j => `
      <div class="jogo-row">
        <span class="jogo-partida">⚽ ${j.partida}</span>
        <span class="jogo-dica">💡 ${j.dica}</span>
        <span class="jogo-conf">${j.confianca}</span>
      </div>
    `).join("") || "<p style='color:var(--text-muted);font-size:13px'>Sem jogos no último relatório.</p>";
  }

  // Vídeos recentes
  const lista = document.getElementById("videos-recentes-lista");
  if (dados.videos_recentes?.length) {
    lista.innerHTML = dados.videos_recentes.map(v => `
      <div class="video-row">
        <span class="video-row-icon">🎬</span>
        <div class="video-row-info">
          <div class="video-row-name">${v.nome}</div>
          <div class="video-row-meta">${v.tamanho} MB · ${v.criado}</div>
        </div>
        <a href="${v.url}" target="_blank" class="btn btn-sm btn-secondary">⬇ Baixar</a>
      </div>
    `).join("");
  } else {
    lista.innerHTML = `<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px">Nenhum vídeo gerado ainda. Rode o pipeline!</p>`;
  }
}


// ─────────────────────────────────────────────────────────
// CASAS DE APOSTA
// ─────────────────────────────────────────────────────────

async function carregarCasas() {
  const casas = await api("/api/casas");
  if (!casas) return;

  const icons = ["🏦","🎰","💳","🃏","💰","🏧","🎲"];
  const lista = document.getElementById("casas-lista");

  if (!casas.length) {
    lista.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:40px">Nenhuma casa cadastrada. Clique em "+ Adicionar Casa".</p>`;
    return;
  }

  lista.innerHTML = casas.map((c, i) => `
    <div class="casa-item ${c.ativa ? '' : 'inativa'}" id="casa-${c.id}">
      <span class="casa-icon">${icons[i % icons.length]}</span>
      <div class="casa-info">
        <div class="casa-nome">${c.nome}</div>
        <div class="casa-url">
          <a href="${c.url}" target="_blank" style="color:var(--text-muted);text-decoration:none">${c.url}</a>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="badge ${c.ativa ? 'badge-success' : ''}">${c.ativa ? 'Ativa' : 'Inativa'}</span>
      </div>
      <div class="casa-actions">
        <button class="btn btn-sm btn-secondary" onclick="editarCasa(${c.id}, '${c.nome}', '${c.url}', ${c.ativa})">✏️</button>
        <button class="btn btn-sm" style="background:transparent;color:var(--text-muted);border:1px solid var(--border)"
          onclick="toggleCasa(${c.id}, ${!c.ativa})">${c.ativa ? '⏸' : '▶'}</button>
        <button class="btn btn-sm btn-danger" onclick="deletarCasa(${c.id})">🗑</button>
      </div>
    </div>
  `).join("");
}

function abrirModalCasa() {
  document.getElementById("modal-casa-titulo").textContent = "Adicionar Casa de Aposta";
  document.getElementById("modal-casa-id").value    = "";
  document.getElementById("modal-casa-nome").value  = "";
  document.getElementById("modal-casa-url").value   = "";
  document.getElementById("modal-casa-ativa").checked = true;
  document.getElementById("modal-casa").classList.remove("hidden");
  document.getElementById("modal-casa-nome").focus();
}

function fecharModalCasa() {
  document.getElementById("modal-casa").classList.add("hidden");
}

function editarCasa(id, nome, url, ativa) {
  document.getElementById("modal-casa-titulo").textContent = "Editar Casa de Aposta";
  document.getElementById("modal-casa-id").value    = id;
  document.getElementById("modal-casa-nome").value  = nome;
  document.getElementById("modal-casa-url").value   = url;
  document.getElementById("modal-casa-ativa").checked = ativa;
  document.getElementById("modal-casa").classList.remove("hidden");
}

async function salvarCasa() {
  const id   = document.getElementById("modal-casa-id").value;
  const nome = document.getElementById("modal-casa-nome").value.trim();
  const url  = document.getElementById("modal-casa-url").value.trim();
  const ativa = document.getElementById("modal-casa-ativa").checked;

  if (!nome || !url) return toast("Nome e URL são obrigatórios", "error");

  let resultado;
  if (id) {
    resultado = await api(`/api/casas/${id}`, { method: "PUT", body: JSON.stringify({ nome, url, ativa }) });
  } else {
    resultado = await api("/api/casas", { method: "POST", body: JSON.stringify({ nome, url, ativa }) });
  }

  if (resultado?.sucesso) {
    toast(id ? "Casa atualizada!" : "Casa adicionada!", "success");
    fecharModalCasa();
    carregarCasas();
  } else {
    toast(resultado?.erro || "Erro ao salvar", "error");
  }
}

async function toggleCasa(id, novoEstado) {
  await api(`/api/casas/${id}`, { method: "PUT", body: JSON.stringify({ ativa: novoEstado }) });
  carregarCasas();
}

async function deletarCasa(id) {
  if (!confirm("Remover esta casa de aposta?")) return;
  await api(`/api/casas/${id}`, { method: "DELETE" });
  toast("Casa removida", "success");
  carregarCasas();
}

// Fechar modal clicando fora
document.addEventListener("click", e => {
  const modal = document.getElementById("modal-casa");
  if (e.target === modal) fecharModalCasa();
});


// ─────────────────────────────────────────────────────────
// TIPOS DE APOSTA
// ─────────────────────────────────────────────────────────

async function carregarTipos() {
  const tipos = await api("/api/tipos-aposta");
  if (!tipos) return;
  tiposCache = tipos;

  const icones = {
    resultado_final:   "⚽",
    ambas_marcam:      "🥅",
    dupla_chance:      "🔀",
    over_under:        "📊",
    handicap_asiatico: "🏯",
    escanteios:        "🚩",
    cartoes:           "🟨",
  };

  const lista = document.getElementById("tipos-lista");
  lista.innerHTML = Object.entries(tipos).map(([chave, tipo]) => `
    <div class="tipo-item ${tipo.ativo ? 'ativo' : ''}" id="tipo-${chave}">
      <span class="tipo-icon">${icones[chave] || "🎯"}</span>
      <div class="tipo-info">
        <div class="tipo-label">${tipo.label}</div>
        <div class="tipo-mercado">mercado: ${tipo.mercado}${tipo.linha ? ` · linha: ${tipo.linha}` : ''}</div>
      </div>
      <label class="toggle">
        <input type="checkbox" id="tipo-toggle-${chave}" ${tipo.ativo ? 'checked' : ''}
          onchange="atualizarTipoVisual('${chave}', this.checked)"/>
        <span class="toggle-slider"></span>
      </label>
    </div>
  `).join("");
}

function atualizarTipoVisual(chave, ativo) {
  const item = document.getElementById(`tipo-${chave}`);
  if (ativo) item.classList.add("ativo");
  else       item.classList.remove("ativo");
  tiposCache[chave].ativo = ativo;
}

async function salvarTipos() {
  const updates = {};
  Object.keys(tiposCache).forEach(chave => {
    const checkbox = document.getElementById(`tipo-toggle-${chave}`);
    if (checkbox) updates[chave] = { ativo: checkbox.checked };
  });

  const resultado = await api("/api/tipos-aposta", { method: "PUT", body: JSON.stringify(updates) });
  if (resultado?.sucesso) toast("Tipos de aposta salvos!", "success");
  else                    toast("Erro ao salvar", "error");
}


// ─────────────────────────────────────────────────────────
// PIPELINE
// ─────────────────────────────────────────────────────────

async function rodarPipeline(simulacao = false) {
  const btn = document.getElementById("btn-rodar");
  if (btn) btn.disabled = true;

  const resultado = await api("/api/pipeline/rodar", {
    method: "POST",
    body: JSON.stringify({ simulacao }),
  });

  if (resultado?.sucesso) {
    toast(`Pipeline iniciado! ${simulacao ? "(modo teste)" : ""}`, "success");
    showTab("pipeline");
    iniciarPolling();
  } else {
    toast(resultado?.erro || "Erro ao iniciar pipeline", "error");
    if (btn) btn.disabled = false;
  }
}

async function atualizarStatusPipeline() {
  const status = await api("/api/pipeline/status");
  if (!status) return;

  const dot     = document.getElementById("status-dot-lg");
  const texto   = document.getElementById("status-texto");
  const dotFooter = document.getElementById("pipeline-dot");
  const footerText = document.getElementById("pipeline-footer-status");
  const btn     = document.getElementById("btn-rodar");

  if (status.rodando) {
    dot?.classList.replace("success", "running") || dot?.classList.add("running");
    dot?.classList.remove("error");
    if (texto) texto.textContent = "⏳ Rodando...";
    if (dotFooter) dotFooter.classList.add("active");
    if (footerText) footerText.textContent = "Pipeline rodando";
    if (btn) btn.disabled = true;
  } else {
    dot?.classList.remove("running");
    if (status.ultimo_resultado === "sucesso") {
      dot?.classList.add("success");
      dot?.classList.remove("error");
      if (texto) texto.textContent = "✅ Concluído com sucesso";
    } else if (status.ultimo_resultado === "erro") {
      dot?.classList.add("error");
      dot?.classList.remove("success");
      if (texto) texto.textContent = "❌ Erro na execução";
    } else {
      if (texto) texto.textContent = "⏸ Aguardando...";
    }
    if (dotFooter) dotFooter.classList.remove("active");
    if (footerText) footerText.textContent = status.rodando ? "Pipeline ativo" : "Pipeline inativo";
    if (btn) btn.disabled = false;
  }

  // Renderiza logs
  const container = document.getElementById("log-container");
  if (container && status.logs?.length) {
    const estava_no_fim = container.scrollTop + container.clientHeight >= container.scrollHeight - 20;
    container.innerHTML = status.logs.map(l => {
      const isErr  = l.mensagem.includes("ERRO") || l.mensagem.includes("ERROR");
      const isWarn = l.mensagem.includes("WARN") || l.mensagem.includes("⚠");
      return `<div class="log-line">
        <span class="log-time">[${l.tempo}]</span>
        <span class="log-msg ${isErr ? 'error' : isWarn ? 'warn' : ''}">${escapeHtml(l.mensagem)}</span>
      </div>`;
    }).join("");
    if (estava_no_fim) container.scrollTop = container.scrollHeight;
  }
}

function limparLogs() {
  const container = document.getElementById("log-container");
  if (container) container.innerHTML = `<div class="log-placeholder">Logs limpos.</div>`;
}

function iniciarPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  pollingInterval = setInterval(() => {
    atualizarStatusPipeline();
    const tabAtiva = document.querySelector(".tab-content.active")?.id;
    if (tabAtiva === "tab-dashboard") carregarDashboard();
  }, 2000);
}


// ─────────────────────────────────────────────────────────
// VÍDEOS
// ─────────────────────────────────────────────────────────

async function carregarVideos() {
  const videos = await api("/api/videos");
  if (!videos) return;

  const badge = document.getElementById("total-videos-badge");
  if (badge) badge.textContent = `${videos.length} vídeo(s)`;

  const grid = document.getElementById("videos-grid");
  if (!videos.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-muted)">
      🎬 Nenhum vídeo gerado ainda.<br><br>
      <button class="btn btn-primary" onclick="rodarPipeline(true)">Gerar primeiro vídeo →</button>
    </div>`;
    return;
  }

  grid.innerHTML = videos.map(v => `
    <div class="video-card">
      <div class="video-thumb">🎬</div>
      <div class="video-info">
        <div class="video-nome">${v.nome}</div>
        <div class="video-meta">${v.tamanho} MB · ${v.criado}</div>
      </div>
      <div class="video-actions">
        <a href="${v.url}" target="_blank" class="btn btn-sm btn-primary" style="width:100%;justify-content:center">
          ⬇ Baixar
        </a>
      </div>
    </div>
  `).join("");
}


// ─────────────────────────────────────────────────────────
// CONFIGURAÇÕES
// ─────────────────────────────────────────────────────────

async function carregarConfig() {
  const config = await api("/api/config");
  if (!config) return;

  const v = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ""; };
  const c = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };

  // Odds API
  v("cfg-odds-key",   config.odds_api?.chave ?? "");
  v("cfg-max-jogos",  config.odds_api?.max_jogos_por_video ?? 3);

  // Vídeo
  v("cfg-canal-nome", config.video?.canal_nome ?? "");
  v("cfg-canal-user", config.video?.canal_usuario ?? "");
  v("cfg-duracao",    config.video?.duracao_total ?? 40);
  v("cfg-fps",        config.video?.fps ?? 30);

  // Agendamento
  c("cfg-agendamento-ativo", config.agendamento?.ativo);
  v("cfg-horarios",  (config.agendamento?.horarios ?? []).join(", "));

  // Drive
  c("cfg-drive-ativo", config.google_drive?.ativo);
  v("cfg-drive-folder", config.google_drive?.folder_id ?? "");
}

async function salvarConfig() {
  const g = id => document.getElementById(id)?.value?.trim();
  const b = id => document.getElementById(id)?.checked ?? false;

  const horarios = g("cfg-horarios")
    .split(",").map(h => h.trim()).filter(h => /^\d{2}:\d{2}$/.test(h));

  const payload = {
    odds_api: {
      chave:                g("cfg-odds-key") || undefined,
      max_jogos_por_video:  parseInt(g("cfg-max-jogos")) || 3,
    },
    video: {
      canal_nome:    g("cfg-canal-nome"),
      canal_usuario: g("cfg-canal-user"),
      duracao_total: parseInt(g("cfg-duracao")) || 40,
      fps:           parseInt(g("cfg-fps")) || 30,
    },
    agendamento: {
      ativo:    b("cfg-agendamento-ativo"),
      horarios: horarios,
    },
    google_drive: {
      ativo:     b("cfg-drive-ativo"),
      folder_id: g("cfg-drive-folder"),
    },
  };

  // Remove chave se veio mascarada
  if (payload.odds_api.chave?.includes("••••")) delete payload.odds_api.chave;

  const resultado = await api("/api/config", { method: "PUT", body: JSON.stringify(payload) });
  if (resultado?.sucesso) toast("Configurações salvas!", "success");
  else                    toast("Erro ao salvar configurações", "error");
}


// ─────────────────────────────────────────────────────────
// UTILITÁRIOS
// ─────────────────────────────────────────────────────────

function toast(mensagem, tipo = "info") {
  const el = document.getElementById("toast");
  el.textContent = mensagem;
  el.className   = `toast ${tipo}`;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 3500);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
