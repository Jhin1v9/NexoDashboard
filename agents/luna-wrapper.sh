#!/bin/bash
# Luna CLI Wrapper — garante restauração do terminal mesmo em crash hard
# Uso: ./luna-wrapper.sh [args...]

# Restaura alternate screen e cursor ao sair (incluindo SIGINT/SIGTERM)
cleanup() {
  # Exit alternate screen buffer
  printf '\033[?1049l'
  # Show cursor
  printf '\033[?25h'
  # Reset colors
  printf '\033[0m'
}
trap cleanup EXIT INT TERM HUP

# Executa Luna CLI passando todos os argumentos
node "$(dirname "$0")/luna-tui.mjs" "$@"
