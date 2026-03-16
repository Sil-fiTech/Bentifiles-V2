# BentiFiles

**Validação Inteligente & Armazenamento de Documentos**

O BentiFiles é um sistema completo para gestão de projetos, solicitação de documentos, armazenamento seguro e validação automática de imagens através de inteligência artificial/visão computacional.

## 🚀 Funcionalidades

- **Autenticação:** Login nativo (E-mail/Senha) e Integração com Google (NextAuth).
- **Gestão de Projetos:** Criação de projetos e geração de links de convite para colaborar.
- **Controle de Acesso:** Níveis de permissão (ADMIN e USER) dentro de cada projeto.
- **Tipos de Documento:** Gestão de tipos de documentos exigidos por projeto (ex: Contrato Social, CNH) vinculados ao criador.
- **Upload e Fluxo de Revisão:** Usuários podem fazer upload dos arquivos solicitados. Administradores podem visualizar, aprovar ou rejeitar (com motivo).
- **Análise Automática:** Microserviço em Python que avalia o brilho, nitidez (desfoque) e a presença de texto legível nas imagens enviadas.

---

## 🛠️ Tecnologias Utilizadas

O projeto é dividido em três camadas principais:

### 1. Frontend (`/frontend`)
- **Framework:** Next.js (App Router)
- **Linguagem:** TypeScript / React
- **Autenticação:** NextAuth.js
- **Estilização:** CSS / Lucide React (Ícones)
- **Requisições HTTP:** Axios

### 2. Backend API (`/backend`)
- **Ambiente:** Node.js com Express
- **Linguagem:** TypeScript
- **ORM / Banco de Dados:** Prisma (SQLite no desenvolvimento)
- **Autenticação:** JWT (JSON Web Tokens)
- **Uploads:** Multer (Armazenamento local em `/uploads`)

### 3. Microserviço de Visão Computacional (`/microservice`)
- **Framework:** FastAPI
- **Linguagem:** Python
- **Processamento de Imagens:** OpenCV (`cv2`), NumPy, EasyOCR / Tesseract

---

## ⚙️ Como Executar Localmente

Você precisará do **Node.js** e do **Python 3** instalados na sua máquina.

### 1. Configurando o Backend (Node.js)
Abra uma janela do terminal na raiz do projeto e acesse a pasta do backend:

```bash
cd backend
# Instale as dependências
npm install

# Gere o client do Prisma e atualize o banco de dados
npx prisma generate
npx prisma migrate dev

# Inicie o servidor de desenvolvimento (rodará na porta 3001)
npm run dev
```

### 2. Configurando o Frontend (Next.js)
Abra outra janela do terminal na raiz do projeto e acesse a pasta do frontend:

```bash
cd frontend
# Instale as dependências
npm install

# Inicie a aplicação web (rodará na porta 3000)
npm run dev
```
*Acesse `http://localhost:3000` no seu navegador.*

### 3. Configurando o Microserviço (Python)
Abra uma terceira janela do terminal (PowerShell) na raiz do projeto e acesse a pasta do microserviço. Siga os passos abaixo, especialmente se estiver no Windows:

```powershell
cd microservice

# Se você ainda não criou o ambiente virtual (venv), crie-o:
python -m venv venv

# ATIVE o ambiente virtual (Passo obrigatório no Windows)
.\venv\Scripts\activate

# Com o ambiente ativado (aparecerá um (venv) no seu terminal), instale as dependências:
pip install -r requirements.txt

# Inicie a API de IA com uvicorn (rodará na porta 8000):
uvicorn main:app --reload
```

---

## 🔒 Variáveis de Ambiente (`.env`)

Você precisará configurar os arquivos `.env` nas pastas correspondentes (baseie-se nos arquivos `.env.example` caso existam):

**No Frontend (`frontend/.env.local`):**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
AUTH_SECRET=sua_chave_secreta_aqui
AUTH_GOOGLE_ID=seu_client_id_do_google
AUTH_GOOGLE_SECRET=seu_client_secret_do_google
```

**No Backend (`backend/.env`):**
```env
PORT=3001
DATABASE_URL="file:./dev.db"
JWT_SECRET=sua_chave_jwt_super_segura
MICROSERVICE_URL=http://localhost:8000
```
