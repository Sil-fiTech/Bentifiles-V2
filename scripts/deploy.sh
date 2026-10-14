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
HEAD_SHA="$(git rev-parse HEAD)"
PREV_SHA="$(cat "$STATE" 2>/dev/null || echo "$HEAD_SHA")"
git merge --ff-only "$TARGET"
NEW_SHA="$(git rev-parse HEAD)"
echo ">> [$BRANCH] $PREV_SHA -> $NEW_SHA"

# Quais servicos redeployar: diff entre o ultimo deploy saudavel e o novo SHA.
# Sem estado anterior, ou mudanca em compose/scripts, redeploya tudo.
# Um deploy que falhou nao atualiza o estado, entao o proximo reconstroi o que ficou pendente.
ALL="frontend backend subscription-reminder-worker python-microservice"
if [ ! -f "$STATE" ]; then
  SERVICES="$ALL"
else
  SERVICES=""
  CHANGED="$(git diff --name-only "$PREV_SHA" "$NEW_SHA")"
  grep -q -E '^(docker-compose\.yml|scripts/deploy\.sh)$' <<<"$CHANGED" && SERVICES="$ALL"
  [ -z "$SERVICES" ] && {
    grep -q '^frontend/' <<<"$CHANGED" && SERVICES="$SERVICES frontend"
    grep -q '^backend/' <<<"$CHANGED" && SERVICES="$SERVICES backend subscription-reminder-worker"
    grep -q '^microservice/' <<<"$CHANGED" && SERVICES="$SERVICES python-microservice"
  }
  true
fi
SERVICES="${SERVICES# }"
if [ -z "$SERVICES" ]; then
  echo ">> nada a redeployar (so docs/CI); containers intocados"
  echo "$NEW_SHA" > "$STATE"
  exit 0
fi
echo ">> servicos: $SERVICES"

wait_http() { for _ in $(seq 1 "$2"); do curl -fsS -o /dev/null "$1" && return 0; sleep 3; done; return 1; }
healthy() {
  case " $SERVICES " in *" backend "*) wait_http "http://localhost:$BACKEND_PORT/health" 40 || return 1 ;; esac
  case " $SERVICES " in *" frontend "*) wait_http "http://localhost:$FRONTEND_PORT" 40 || return 1 ;; esac
  case " $SERVICES " in *" python-microservice "*) wait_http "http://localhost:$MICROSERVICE_PORT/docs" 40 || return 1 ;; esac
  return 0
}

# --no-deps: nao recria dependencias que nao mudaram (ex.: deploy do frontend nao reinicia o backend).
# shellcheck disable=SC2086
docker compose up -d --build --no-deps --remove-orphans $SERVICES

if healthy; then
  echo ">> healthcheck OK"
  echo "$NEW_SHA" > "$STATE"
  docker image prune -f >/dev/null
  exit 0
fi

echo ">> healthcheck FALHOU, rollback para $PREV_SHA"
docker compose logs --tail=50 $SERVICES || true
git reset -q --hard "$PREV_SHA"
# shellcheck disable=SC2086
docker compose up -d --build --no-deps --remove-orphans $SERVICES
exit 1
