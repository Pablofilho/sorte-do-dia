#!/bin/bash
# ─────────────────────────────────────────────
# Script de inicialização — Sorte do Dia
# Uso: ./start.sh
# ─────────────────────────────────────────────

PROJETO_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="$PROJETO_DIR/logs/servidor.log"
PID_FILE="$PROJETO_DIR/.servidor.pid"

mkdir -p "$PROJETO_DIR/logs"

# Mata processo antigo se existir
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "⏹  Parando servidor anterior (PID $OLD_PID)..."
    kill "$OLD_PID"
    sleep 1
  fi
fi

echo ""
echo "🍀 Sorte do Dia — Painel Web"
echo "================================"
echo "   Iniciando servidor..."

cd "$PROJETO_DIR"
python3 web/app.py >> "$LOG_FILE" 2>&1 &
SERVER_PID=$!
echo $SERVER_PID > "$PID_FILE"

sleep 2

# Verifica se subiu
if kill -0 "$SERVER_PID" 2>/dev/null; then
  echo "   ✅ Servidor rodando! (PID $SERVER_PID)"
  echo ""
  echo "   🌐 Acesse: http://localhost:5000"
  echo ""
  echo "   Para parar: ./stop.sh"
  echo "================================"
else
  echo "   ❌ Falha ao iniciar. Veja o log:"
  echo "      $LOG_FILE"
fi
