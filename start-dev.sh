#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

backend_pid=""
frontend_pid=""

cleanup() {
  echo
  echo "Stopping frontend/backend..."

  if [[ -n "$frontend_pid" ]] && kill -0 "$frontend_pid" 2>/dev/null; then
    kill -TERM "-$frontend_pid" 2>/dev/null || kill -TERM "$frontend_pid" 2>/dev/null || true
  fi

  if [[ -n "$backend_pid" ]] && kill -0 "$backend_pid" 2>/dev/null; then
    kill -TERM "-$backend_pid" 2>/dev/null || kill -TERM "$backend_pid" 2>/dev/null || true
  fi

  wait 2>/dev/null || true
  echo "Stopped."
}

trap cleanup INT TERM EXIT

echo "Starting backend..."
(
  cd "$BACKEND_DIR"
  exec npm start
) &
backend_pid=$!

echo "Starting frontend (LAN)..."
(
  cd "$FRONTEND_DIR"
  exec npm run start:lan
) &
frontend_pid=$!

echo "Backend PID: $backend_pid"
echo "Frontend PID: $frontend_pid"
echo "Press Ctrl+C to stop both."

wait
