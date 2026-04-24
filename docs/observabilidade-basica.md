# Observabilidade Basica

Esta entrega adiciona uma base operacional simples para backend e microservico.

## O que entrou

- `x-request-id` automatico no backend e no microservico
- logs estruturados em JSON no backend
- logs HTTP no microservico
- healthchecks com `status`, `service`, `version` e `uptime`
- remocao do log de `DATABASE_URL` no bootstrap da API

## Backend

Arquivos principais:

- `backend/src/utils/logger.ts`
- `backend/src/middleware/observability.ts`
- `backend/src/index.ts`

Com isso, cada requisicao passa a:

- receber `x-request-id` se nao vier do cliente ou proxy
- devolver `x-request-id` na resposta
- registrar metodo, rota, status e duracao

## Microservico

Arquivos principais:

- `microservice/app/main.py`
- `microservice/app/core/config.py`
- `microservice/app/api/routes.py`

O microservico agora:

- devolve `x-request-id`
- registra logs HTTP com duracao
- expoe uptime e versao em `/health`

## Uso recomendado

- propague `x-request-id` do frontend ou do proxy para backend e microservico
- use os endpoints `/health` em uptime checks
- envie stdout dos containers para seu agregador de logs

## Proximos passos naturais

- integrar Sentry ou outra ferramenta de erro
- padronizar logs dos controllers restantes
- criar alertas para webhook Stripe, worker e upload
- expor metricas Prometheus se quiser monitoramento mais fino
