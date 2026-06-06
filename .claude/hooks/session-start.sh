#!/bin/bash
set -euo pipefail

# Solo corre en entornos remotos (Claude Code web/cloud)
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

echo '{"async": true, "asyncTimeout": 300000}'

# Instala dependencias del MCP server de gastos
pip3 install --quiet --break-system-packages mcp httpx 2>/dev/null \
  || pip3 install --quiet mcp httpx
