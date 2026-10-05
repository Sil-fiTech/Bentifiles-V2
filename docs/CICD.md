# CI/CD

## Fluxo
- `ci.yml` (PR e push em main/dev/dev-V2): o job `changes` (paths-filter) detecta as areas tocadas e so elas rodam: build backend (prisma generate + tsc), lint+build frontend, smoke test do microservice (transitorio, ver abaixo) e o `docker build` da propria area. Area intocada fica *skipped*; falha em uma area nao bloqueia o build Docker das outras. Mudar o proprio `ci.yml` roda tudo.
- `deploy.yml`: apos CI verde em push na `main` deploya **prod**; em push na `dev` deploya **dev**. Tambem manual (Actions > Deploy > Run workflow; `sha` serve para rollback).
- Na VPS o GitHub conecta com uma chave SSH restrita (`command=`) que so executa `/usr/local/bin/bentifiles-deploy prod|dev [sha]` (fonte: `scripts/vps/bentifiles-deploy`). Esse wrapper faz lock e chama `scripts/deploy.sh` no diretorio do ambiente.
- `scripts/deploy.sh`: `git merge --ff-only`, depois redeploya **so os servicos cujo diff mudou** desde o ultimo deploy saudavel (`.deploy_last_good`): `frontend/` -> frontend; `backend/` -> backend + worker; `microservice/` -> python-microservice; `docker-compose.yml` ou `scripts/deploy.sh` (ou sem estado anterior) -> todos; so docs/CI -> nada. Usa `docker compose up -d --build --no-deps <servicos>` e healthcheck apenas desses servicos. Se falhar, volta ao ultimo SHA saudavel e o estado nao avanca (o proximo deploy refaz o que ficou pendente).

## Ambientes na VPS
| Ambiente | Diretorio | Branch | Portas front/back/ia | Dominio |
|---|---|---|---|---|
| prod | `/root/Bentifiles-V2` | `main` | 3000/4000/8000 | bentifiles.com |
| dev | `/root/devBentifiles` | `dev` | 3001/4001/8001 | devbentifiles.tech |

O `docker-compose.yml` usa variaveis com padrao de producao. O dev define em `/root/devBentifiles/.env`:
```
CONTAINER_PREFIX=dev-
FRONTEND_PORT=3001
BACKEND_PORT=4001
MICROSERVICE_PORT=8001
```
O deploy recusa rodar se houver arquivo rastreado modificado no servidor.

## Setup unico
1. Gerar chave: `ssh-keygen -t ed25519 -N "" -C github-actions-deploy -f gha_deploy`.
2. Instalar o wrapper: copiar `scripts/vps/bentifiles-deploy` para `/usr/local/bin/` (root, 0755).
3. Em `/root/.ssh/authorized_keys`, adicionar a publica com restricoes:
   `command="/usr/local/bin/bentifiles-deploy",no-pty,no-port-forwarding,no-agent-forwarding,no-X11-forwarding ssh-ed25519 AAAA... github-actions-deploy`
4. Secrets do repo: `VPS_HOST` (IP), `VPS_USER` (`root`), `VPS_SSH_KEY` (privada), `VPS_PORT` (opcional).
5. Dev: apos o PR entrar em `main` e ser mergeado em `dev`, rodar em `/root/devBentifiles`: criar o `.env` acima e `git checkout docker-compose.yml`.

## Notas
- VPS: 1 vCPU, 3.8 GB RAM, sem swap. Build das imagens no servidor e pesado; considere criar swap.
- Lint do frontend roda com `continue-on-error` (ha debito existente).
- Backend tem `npm test`, mas o CI so valida o build (o script chama `npm.cmd`, so funciona no Windows).
- O job de microservice e o `microservice/` sao transitorios: o motor tem repo/CI/deploy proprios (document-quality-pipeline). Remover aqui quando a producao passar a usar a imagem do motor.
- Migrations Prisma nao rodam no deploy.
