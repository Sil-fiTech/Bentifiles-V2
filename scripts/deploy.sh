#!/usr/bin/env bash
# Deploy na VPS. Executado dentro do diretorio do repo.
# Uso: bash scripts/deploy.sh [ref]   (default: origin/main)
# Pre-requisitos na VPS: git, docker + compose plugin, backend/.env e frontend/.env.local ja criados.
set -euo pipefail

REF="${1:-origin/main}"
PROFILES="${COMPOSE_PROFILES:-workers}"   # inclui subscription-reminder-worker
export COMPOSE_PROFILES="$PROFILES"

STATE=.deploy_last_good   # SHA do ultimo deploy saudavel (ignorado pelo git)
git fetch --all --prune
git checkout -q --detach "$REF"
NEW_SHA="$(git rev-parse HEAD)"
PREV_SHA="$(cat "$STATE" 2>/dev/null || echo "$NEW_SHA")"
echo ">> deploy $PREV_SHA -> $NEW_SHA"

for f in backend/.env frontend/.env.local; do
  [ -f "$f" ] || { echo "ERRO: $f ausente na VPS"; exit 1; }
done

wait_http() { # url tentativas
  for i in $(seq 1 "$2"); do
    curl -fsS -o /dev/null "$1" && return 0
    sleep 3
  done
  return 1
}

healthy() {
  wait_http http://localhost:4000/health 30 \
    && wait_http http://localhost:3000 30 \
    && wait_http http://localhost:8000/docs 30
}

docker compose up -d --build --remove-orphans

if healthy; then
  echo ">> healthcheck OK"
  echo "$NEW_SHA" > "$STATE"
  docker image prune -f >/dev/null
  exit 0
fi

echo ">> healthcheck FALHOU, rollback para $PREV_SHA"
docker compose logs --tail=50 || true
git checkout -q --detach "$PREV_SHA"
docker compose up -d --build --remove-orphans
exit 1
