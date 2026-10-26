# BentiFiles V2.0 — Armazenamento cifrado, expurgo e Google Drive

- **Data:** 2026-10-15
- **Responsável:** Du
- **Origem:** reunião Du & Samuel de 14/10/2026 (V2.0 = criptografia + drive do cliente)
- **Prazo:** 31/10/2026 (margem até 15/11/2026)

## 1. Objetivo

Blindar o armazenamento de documentos e permitir que o cliente guarde os arquivos no próprio Google Drive.
Sucesso = nenhum arquivo legível no bucket nem no banco, arquivos de projetos arquivados destruídos após 7 dias corridos, e escritórios (plano Office) recebendo os documentos num Drive compartilhado do escritório.

## 2. Decisões tomadas

| Tema | Decisão |
|---|---|
| Modelo de criptografia | Chave no servidor (envelope encryption). "Nem nós abrimos" (zero-knowledge) fica para uma V2.x; o modelo de dados já prevê a migração. |
| Trecho cliente → servidor | HTTPS como hoje. Arquivo só em memória durante a validação; nunca gravado aberto em disco. |
| Bucket | Continua o Cloudflare R2. |
| Destino Drive | Configurado por conta. No Office, o dono da assinatura conecta e vale para todas as vagas. |
| Arquivos no Drive | Legíveis, organizados em pastas; nunca expurgados por nós. |
| Escopo Google | `drive.file` (não sensível). Drive inteiro está fora por exigir auditoria CASA. |
| Gatilho do expurgo | Admin arquiva o projeto; expurgo 7 dias corridos depois. Desarquivar cancela. Projetos `DELETED` são expurgados na execução seguinte. |
| Fora da V2.0 | OneDrive/Dropbox, mudança de preços, dono do Office assumir projetos das vagas, zero-knowledge, tela de auditoria. |

## 3. Arquitetura

```
Upload ─> multer (memoryStorage) ─> assinatura do arquivo + IA ─> storage.put()
                                                              ├─ R2EncryptedDriver (padrão)
                                                              └─ GoogleDriveDriver (se houver conexão ativa)
Leitura (base64 / ZIP) ─> storage.get(file) ─> decifra (R2) ou baixa (Drive) ─> FileAccessLog
Worker de expurgo (1x/hora) ─> projetos elegíveis ─> storage.delete + apaga encryptedDek + purgedAt
```

### 3.1 Unidades

| Unidade | Arquivo | Responsabilidade |
|---|---|---|
| `envelopeCrypto` | `backend/src/services/storage/envelopeCrypto.ts` | Gera DEK de 32 bytes, cifra/decifra buffer com AES-256-GCM, cifra/decifra a DEK com a chave mestra da versão indicada. Também cifra campos de texto curtos (`originalName`). Sem I/O. |
| `StorageDriver` | `backend/src/services/storage/types.ts` | Interface `put(buffer, meta) → StoredObject`, `get(file) → Buffer`, `delete(file)`. |
| `R2EncryptedDriver` | `backend/src/services/storage/r2EncryptedDriver.ts` | Usa `r2Service` (S3 client) + `envelopeCrypto`. Chave do objeto = UUID aleatório sem extensão. |
| `GoogleDriveDriver` | `backend/src/services/storage/googleDriveDriver.ts` | Upload/download via Drive API v3 (`supportsAllDrives`), retries com backoff, cria pastas sob demanda. |
| `storageRouter` | `backend/src/services/storage/index.ts` | Escolhe o destino de um upload e o driver de leitura de um `File`; aplica fallback para R2. |
| `googleOAuth` | `backend/src/services/storage/googleOAuth.ts` | URL de consentimento, troca de código, refresh do access token, revogação. |
| `purgeWorker` | `backend/src/workers/storagePurgeWorker.ts` | Seleciona e expurga; envia aviso D-1. |
| Migração | `backend/scripts/migrateEncryptStorage.ts` | Cifra os objetos existentes no R2. |

### 3.2 Escolha do destino (upload)

Avaliada a cada upload, a partir de `Project.createdByUserId`:

1. Criador é vaga ativa de uma assinatura Office com `StorageConnection` `ACTIVE` → Drive do escritório.
2. Senão, criador tem `StorageConnection` própria `ACTIVE` → Drive dele.
3. Senão → R2 cifrado.

Falha no Drive (token inválido, cota cheia, 429/5xx após 3 tentativas) → grava no R2 cifrado e registra o motivo. Cada `File` guarda o destino real; conectar/desconectar não migra arquivos.

## 4. Modelo de dados (Prisma)

```prisma
enum StorageProvider { R2  GDRIVE }
enum StorageConnectionStatus { ACTIVE  REVOKED }
enum FileAccessAction { VIEW  DOWNLOAD  ZIP }

model File {
  // existentes mantidos: id, filename, mimetype, size, userId, projectId, ...
  // removido: url
  originalName    String           // agora cifrado (base64 de iv|tag|ciphertext)
  storageProvider StorageProvider  @default(R2)
  storageRef      String           // chave no R2 ou fileId no Drive
  encryptedDek    String?          // null para GDRIVE e após o expurgo
  iv              String?
  authTag         String?
  keyVersion      Int?
  purgedAt        DateTime?
}

model StorageConnection {
  id                    String                  @id @default(uuid())
  provider              StorageProvider         // GDRIVE
  subscriptionId        String?                 @unique // Office
  userId                String?                 @unique // Individual
  connectedByUserId     String
  googleAccountEmail    String
  encryptedRefreshToken String
  rootFolderId          String
  sharedDriveId         String?
  status                StorageConnectionStatus @default(ACTIVE)
  lastError             String?
  createdAt             DateTime                @default(now())
  updatedAt             DateTime                @updatedAt
}

model StorageFolder {
  id           String @id @default(uuid())
  connectionId String
  projectId    String
  folderId     String
  @@unique([connectionId, projectId])
}

model FileAccessLog {
  id        String           @id @default(uuid())
  fileId    String
  userId    String
  action    FileAccessAction
  ip        String?
  createdAt DateTime         @default(now())
  @@index([fileId, createdAt])
}

model Project {
  // existentes mantidos
  archivedAt        DateTime?
  purgeWarningSentAt DateTime?
}
```

Exatamente um de `subscriptionId` / `userId` é preenchido em `StorageConnection` (validado no serviço).

## 5. Criptografia

- **Algoritmo:** AES-256-GCM, IV de 12 bytes aleatório por operação, tag de 16 bytes.
- **DEK:** uma por arquivo, 32 bytes de `crypto.randomBytes`. Cifrada com a KEK (chave mestra) e guardada como `iv|tag|ciphertext` em base64 em `encryptedDek`.
- **KEK:** `STORAGE_MASTER_KEY_V1` (32 bytes em base64) no `.env` da VPS; `STORAGE_MASTER_KEY_CURRENT=1`. Versões antigas continuam no ambiente até que nenhuma DEK as use. Dev e produção têm chaves diferentes.
- **Metadados:** `originalName` cifrado com a KEK atual. Refresh token do Google idem.
- **Anonimato no bucket:** nome do objeto = UUID sem extensão; `ContentType` = `application/octet-stream`; nenhum metadado do usuário no objeto.
- **Inicialização:** backend e workers recusam subir se a KEK atual estiver ausente ou com tamanho errado.
- **Risco:** perder a KEK = perder todos os arquivos do R2. Guardar em cofre de senhas além do `.env`.

## 6. Google Drive

### 6.1 Conexão

- Card "Armazenamento" no Perfil (Individual) e na Assinatura (Office, só o dono).
- `GET /api/storage/google/connect` → redirect para o Google com `scope=drive.file`, `access_type=offline`, `prompt=consent`, `state` assinado (HMAC com `userId`, `subscriptionId?`, expiração de 10 min).
- `GET /api/storage/google/callback` → valida `state`, troca o código, grava `StorageConnection` com o refresh token cifrado e redireciona para o front.
- Front abre o Google Picker para escolher o destino: criar pasta `BentiFiles` no Meu Drive (padrão) ou pasta num Drive compartilhado. `POST /api/storage/google/folder` grava `rootFolderId` / `sharedDriveId`.
- `DELETE /api/storage/google` → revoga no Google e marca `REVOKED`.
- `GET /api/storage/connection` → status para o card.
- Credenciais OAuth próprias (`GOOGLE_DRIVE_CLIENT_ID/SECRET/REDIRECT_URI`), separadas do login do NextAuth. Tela de consentimento com marca verificada (pedir no início do trabalho).

### 6.2 Estrutura no Drive

`<raiz>/<Nome do projeto>/<Pessoa> - <Tipo de documento>.<ext>`. IDs de pasta em `StorageFolder`, criadas sob demanda.

### 6.3 Erros

| Situação | Comportamento |
|---|---|
| `invalid_grant` | Conexão → `REVOKED`; upload no R2; email ao dono e aviso no card. |
| `storageQuotaExceeded` | Upload no R2; `lastError` preenchido; email ao dono. |
| 429 / 5xx | 3 tentativas com backoff exponencial; depois fallback R2. |
| Arquivo apagado no Drive (404) | Leitura responde 410 "Arquivo removido do Google Drive". |
| Conexão desconectada | Arquivos antigos continuam no Drive; leitura responde 409 "Disponível no seu Google Drive". Uploads novos vão para o R2. |

## 7. Expurgo

- Worker separado (`npm run worker:storage-purge`), seguindo o padrão de `subscriptionReminderWorker.ts`. Usa `DATABASE_URL` do session pooler (porta 5432).
- A cada hora:
  1. Aviso: projetos `ARCHIVED` com `archivedAt <= agora - 6 dias` e `purgeWarningSentAt` nulo → email aos ADMINs e grava `purgeWarningSentAt`.
  2. Expurgo: arquivos com `purgedAt` nulo e `storageProvider = R2` de projetos `ARCHIVED` com `archivedAt <= agora - 7 dias`, ou de projetos `DELETED` → `DeleteObject` no R2, `encryptedDek/iv/authTag = null`, `purgedAt = agora`. Em lotes; idempotente; erro em um arquivo não para o lote.
- Arquivar grava `archivedAt`; desarquivar zera `archivedAt` e `purgeWarningSentAt`.
- O modal de arquivar mostra a data do expurgo.
- Documentos expurgados aparecem como "Expirado" no front; os registros (`ClientDocument`, `VerificationResult`) permanecem.

## 8. Auditoria

`FileAccessLog` gravado em `getFileBase64`, `getProjectFilesBase64` (um por arquivo, ação `ZIP`) e qualquer nova rota de leitura. Sem tela na V2.0.

## 9. Mudanças no fluxo existente

- `middleware/upload.ts`: `multer.memoryStorage()` mantendo o limite de tamanho. Remover `fs.unlink`/`file.path` do `fileController`.
- `fileController.uploadFile`: trocar `uploadToR2` + `getFileUrl` por `storage.put`; gravar `originalName` cifrado.
- Leituras de `getFileFromR2` passam por `storage.get`; respostas devolvem o `originalName` decifrado.
- Remover `R2_PUBLIC_URL`, `getFileUrl` e o campo `File.url`; o front usa só as rotas de leitura.
- `projectController.archiveProject/unarchiveProject`: gravar/zerar `archivedAt`.

## 10. Migração dos dados existentes

Script `migrateEncryptStorage.ts`, idempotente, em lotes de 50:

1. Seleciona `File` com `encryptedDek` nulo, `purgedAt` nulo e `storageProvider = R2`.
2. Baixa o objeto, cifra, sobe com novo UUID, lê de volta e confere o decifrado contra o original.
3. Atualiza o registro (`storageRef`, `encryptedDek`, `iv`, `authTag`, `keyVersion`, `originalName` cifrado) e só então apaga o objeto antigo.
4. Projetos já `ARCHIVED` recebem `archivedAt = data do deploy`.

Rodar primeiro em dev, com backup do banco antes em produção.

## 11. Testes

- **Vitest (backend):**
  - `envelopeCrypto`: ida e volta; adulteração do ciphertext, IV ou tag falha; KEK errada falha; versão de KEK respeitada.
  - `storageRouter`: precedência Office → Individual → R2; fallback em cada erro da tabela 6.3.
  - `GoogleDriveDriver` com cliente HTTP mockado.
  - Seleção do expurgo: limites de 6/7 dias, `DELETED`, ignorar `GDRIVE`, idempotência.
  - Validação do `state` do OAuth (assinatura e expiração).
- **Manual em devbentifiles.tech:** conta Google de teste, Meu Drive e Drive compartilhado, revogação pelo painel do Google.
- **Pós-entrega:** teste de invasão (Charles).

## 12. Ordem de entrega

1. Criptografia + upload em memória + migração. *(entregável sozinho)*
2. Expurgo + auditoria. *(entregável sozinho)*
3. Google Drive.

Se o prazo apertar, 1 e 2 entregam o ganho de LGPD.

## 13. Variáveis de ambiente novas

`STORAGE_MASTER_KEY_V1`, `STORAGE_MASTER_KEY_CURRENT`, `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REDIRECT_URI`, `OAUTH_STATE_SECRET`, `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY`. Removida: `R2_PUBLIC_URL`.
