# CI/CD

## Fluxo
- `ci.yml` (PR e push em main/dev/dev-V2): build backend (prisma generate + tsc), lint+build frontend, smoke test do microservice, `docker build` dos 3 servicos.
- `deploy.yml`: apos CI verde na `main`, conecta por SSH na VPS e roda `scripts/deploy.sh`. Tambem manual (Actions > Deploy > Run workflow, campo `ref` serve para rollback).
- `scripts/deploy.sh`: checkout do ref, `docker compose up -d --build` (profile `workers` incluso), healthcheck (backend `/health`, frontend `:3000`, microservice `/docs`). Se falhar, volta para o ultimo SHA saudavel (`.deploy_last_good`).

## Setup unico na VPS
1. Instalar git, Docker e compose plugin. Criar usuario `deploy` no grupo `docker`.
2. `git clone https://github.com/Sil-fiTech/Bentifiles-V2.git /opt/bentifiles` (deploy key somente leitura se o repo for privado).
3. Criar `backend/.env` e `frontend/.env.local` (segredos ficam so na VPS; ver `.env.example`).
4. Gerar chave: `ssh-keygen -t ed25519 -f deploy_key -N ""`; colocar `deploy_key.pub` em `~deploy/.ssh/authorized_keys`.

## Secrets do GitHub (Settings > Environments > production)
| Secret | Valor |
|---|---|
| `VPS_HOST` | IP/dominio da VPS |
| `VPS_PORT` | porta SSH (opcional, padrao 22) |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | conteudo da chave privada |
| `VPS_APP_DIR` | `/opt/bentifiles` |

Dica: habilite "Required reviewers" no environment `production` se quiser aprovacao manual antes do deploy.

## Notas
- Lint do frontend roda com `continue-on-error` (ha debito existente).
- Backend nao tem testes automatizados (`npm test` aponta para pasta inexistente); CI so valida o build.
- Migrations Prisma nao rodam no deploy; adicione `prisma migrate deploy` ao script quando decidir.
