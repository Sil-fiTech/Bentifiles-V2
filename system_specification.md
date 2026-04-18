# Especificação Técnica do Sistema — BentiFiles

O **BentiFiles** é uma plataforma SaaS projetada para centralizar, organizar e validar documentos de forma inteligente. O sistema permite a gestão de projetos onde administradores solicitam documentos específicos de usuários, que são então validados automaticamente por inteligência artificial antes de passarem por uma revisão humana final.

---

## 1. Visão Geral do Sistema

O sistema resolve o problema de coleta manual de documentos (via WhatsApp ou e-mail), oferecendo um ambiente seguro onde cada arquivo é verificado quanto à qualidade (nitidez, brilho, presença de texto) e conformidade.

### Objetivos Principais
- **Padronização:** Garantir que todos os documentos sigam um padrão de qualidade.
- **Inteligência:** Reduzir o trabalho humano recusando automaticamente uploads ilegíveis ou incorretos.
- **Transparência:** Oferecer um dashboard claro para o progresso de coleta de documentos em cada projeto.

---

## 2. Stack Tecnológica

### Frontend (`/frontend`)
- **Framework:** Next.js 16 (App Router)
- **Linguagem:** TypeScript
- **Estilização:** SCSS Modules + Design System próprio (Tokens e Mixins)
- **Componentes de UI:** Lucide React (ícones), Sonner (notificações), Radix (implícito em alguns patterns)
- **Gerenciamento de Estado/Auth:** NextAuth.js (v5 beta)
- **Comunicação:** Axios com interceptors para tratamento de sessão

### Backend API (`/backend`)
- **Runtime:** Node.js
- **Framework Web:** Express.js
- **Linguagem:** TypeScript
- **Banco de Dados:** PostgreSQL (via Supabase ou local)
- **ORM:** Prisma
- **Segurança:** JWT, Bcrypt, Helmet, CORS, Rate Limiters
- **Envio de E-mail:** Nodemailer (SMTP Hostinger/Ethereal)

### Inteligência Artificial (`/microservice`)
- **Framework:** FastAPI (Python)
- **Processamento de Imagem:** OpenCV (`cv2`)
- **OCR:** EasyOCR / Tesseract.js (no backend como fallback ou via microserviço)
- **Análise:** Detecção de desfoque (Blur), brilho (Brightness), detecção de bordas e extração de texto.

### Infraestrutura e Armazenamento
- **Storage:** Cloudflare R2 (Compatível com S3) para armazenamento de arquivos e documentos.
- **Servidor:** Docker-ready (Docker Compose incluso).

---

## 3. Arquitetura do Sistema

O projeto segue uma arquitetura modular dividida por responsabilidades:

### Estrutura de Pastas (Backend)
- `src/controllers/`: Lógica de processamento das requisições (Auth, Projetos, Documentos, Membros).
- `src/services/`: Camada de serviços para integrações externas (R2, E-mail).
- `src/middleware/`: Filtros de autenticação, checagem de papéis (RBAC) e configuração de upload.
- `src/routes/`: Definição de endpoints e aplicação de rate limits.
- `src/utils/`: Pequenas funções utilitárias (Slugify, Crypto).

### Fluxo de Comunicação
1. O **Frontend** envia uma requisição autenticada (JWT via Header Authorization).
2. O **Backend** valida a sessão e as permissões do usuário.
3. Se houver upload de imagem, o Backend consome o **Microserviço de IA** de forma síncrona.
4. O resultado da análise e os metadados do arquivo são persistidos no banco via **Prisma**.
5. O arquivo físico é enviado para o **Cloudflare R2**.

---

## 4. Modelagem de Dados (Camadas Prisma)

### Entidades Principais
1. **User:** ID, e-mail, nome, senha (hash), status de verificação de e-mail.
2. **Project:** Metadados do projeto, status (Ativo/Arquivado/Deletado).
3. **ProjectMembership:** Tabela de ligação entre Users e Projects, definindo papéis (`ADMIN` ou `USER`).
4. **ProjectInvite:** Tokens de convite para entrada em projetos, com data de expiração.
5. **DocumentType:** Definição de tipos de documentos (ex: CNH, RG). Podem ser globais (`isDefault`) ou criados por usuários.
6. **ProjectRequiredDocument:** Configuração de quais `DocumentType` são obrigatórios em cada projeto.
7. **File:** Metadados do arquivo (URL do R2, tamanho, mimetype, nome original).
8. **ClientDocument:** A instância de um documento enviado para um projeto específico, vinculada a um dono e a um revisor. Possui status: `pending`, `approved`, `rejected`.
9. **VerificationResult:** Resultados detalhados da IA para cada arquivo (Score, Blur Score, Brilho, Texto detectado).

---

## 5. Funcionalidades Detalhadas

### Autenticação e Segurança
- Cadastro e Login manual.
- Integração com Google OAuth (NextAuth).
- Verificação de e-mail via link temporário.
- Rate limiting em rotas sensíveis para previnir brute force.
- CSRF Protection e headers de segurança via Helmet.

### Gestão de Projetos e Colaboração
- Criador do projeto é automaticamente `ADMIN`.
- Convites via Link Único: Administrador gera um link que permite a entrada de novos membros como `USER`.
- Troca de papéis: `ADMIN` pode promover ou remover membros.

### Fluxo de Gestão Documental
1. **Configuração:** O Administrador escolhe quais documentos são necessários para aquele projeto.
2. **Upload Inteligente:**
   - O sistema detecta se é uma imagem.
   - Aplica validação de IA (Quality Check).
   - Se a imagem for de baixa qualidade, o upload é bloqueado preventivamente com feedback ao usuário.
3. **Revisão Humana:**
   - Documentos aprovados pela IA entram em fila de revisão (`pending`).
   - Administradores aprovam ou rejeitam (inserindo motivo de rejeição).
   - Histórico de revisões é mantido no banco.

---

## 6. Configuração do Ambiente (.env)

| Variável | Descrição |
| :--- | :--- |
| `DATABASE_URL` | String de conexão com o PostgreSQL. |
| `JWT_SECRET` | Chave para assinatura de tokens de sessão. |
| `R2_ACCESS_KEY_ID` | Credencial para armazenamento em nuvem. |
| `R2_SECRET_ACCESS_KEY` | Credencial secreta para Cloudflare R2. |
| `PYTHON_MICROSERVICE_URL` | Endpoint da API de análise de imagem. |
| `NEXT_PUBLIC_API_URL` | Endpoint da API Node (usado pelo frontend). |
| `AUTH_SECRET` | Chave de segurança para NextAuth. |

---

## 7. Manutenção e Escalabilidade

O sistema foi desenhado para ser "Dockerizado", facilitando o deploy horizontal. O uso de uma ferramenta de storage compatível com S3 (R2) permite escala ilimitada de arquivos sem sobrecarregar o servidor de aplicação. A separação do Microserviço de IA permite que o processamento pesado de visão computacional seja escalado independentemente da API de gestão.
