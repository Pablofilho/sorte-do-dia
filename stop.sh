#!/bin/bash
# Para o servidor web

PID_FILE="$(cd "$(dirname "$0")" && pwd)/.servidor.pid"

if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID"
    rm "$PID_FILE"
    echo "⏹  Servidor parado (PID $PID)"
  else
    echo "⚠️  Servidor já estava parado"
    rm "$PID_FILE"
  fi
else
  pkill -f "python3 web/app.py" 2>/dev/null
  echo "⏹  Servidor parado"
fi
