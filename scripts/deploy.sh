#!/usr/bin/env bash
# Deploy na VPS. Roda dentro do diretorio do repo do ambiente.
# Uso: bash scripts/deploy.sh <branch> [sha]
#   branch: main (producao) ou dev. sha opcional (default: ponta de origin/<branch>).
# Portas/prefixo vem do .env da raiz (FRONTEND_PORT, BACKEND_PORT, MICROSERVICE_PORT, CONTAINER_PREFIX).
set -euo pipefail

BRANCH="${1:?uso: deploy.sh <branch> [sha]}"
TARGET="${2:-origin/$BRANCH}"
export COMPOSE_PROFILES="${COMPOSE_PROFILES:-workers}"   # inclui subscription-reminder-worker

[ -f .env ] && { set -a; . ./.env; set +a; }
FRONTEND_PORT="${FRONTEND_PORT:-3000}"; BACKEND_PORT="${BACKEND_PORT:-4000}"; MICROSERVICE_PORT="${MICROSERVICE_PORT:-8000}"

for f in backend/.env frontend/.env.local; do
  [ -f "$f" ] || { echo "ERRO: $f ausente"; exit 1; }
done
if ! git diff --quiet HEAD; then
  echo "ERRO: arquivos rastreados modificados no servidor; limpe antes do deploy:"; git status --short; exit 1
fi

STATE=.deploy_last_good   # SHA do ultimo deploy saudavel (ignorado pelo git)
git fetch --all --prune
git checkout -q "$BRANCH"
PREV_SHA="$(cat "$STATE" 2>/dev/null || git rev-parse HEAD)"
git merge --ff-only "$TARGET"
NEW_SHA="$(git rev-parse HEAD)"
echo ">> [$BRANCH] $PREV_SHA -> $NEW_SHA"

wait_http() { for _ in $(seq 1 "$2"); do curl -fsS -o /dev/null "$1" && return 0; sleep 3; done; return 1; }
healthy() {
  wait_http "http://localhost:$BACKEND_PORT/health" 40 \
    && wait_http "http://localhost:$FRONTEND_PORT" 40 \
    && wait_http "http://localhost:$MICROSERVICE_PORT/docs" 40
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
git reset -q --hard "$PREV_SHA"
docker compose up -d --build --remove-orphans
exit 1
