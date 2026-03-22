# Walkthrough — Rejected Upload Tracking

## O que foi feito

Duas alterações mínimas para registrar rejeições de upload sem armazenar arquivos:

### 1. Novo model `RejectedUpload` em [schema.prisma](file:///c:/Users/dudub/Desktop/Bentifiles-V2/backend/prisma/schema.prisma)

```diff:schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

enum Role {
  ADMIN
  USER
}

enum VerificationStatus {
  APPROVED
  CONDITIONAL
  REJECTED
}

enum DocumentStatus {
  pending
  approved
  rejected
}

model User {
  id         String              @id @default(uuid())
  email      String              @unique
  password   String?
  name       String
  image      String?
  provider   String?
  providerId String?
  files      File[]
  projects   ProjectMembership[]

  clientDocsOwned    ClientDocument[] @relation("DocumentOwner")
  clientDocsUploaded ClientDocument[] @relation("DocumentUploader")
  clientDocsReviewed ClientDocument[] @relation("DocumentReviewer")
  documentTypes      DocumentType[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Project {
  id              String              @id @default(uuid())
  name            String
  createdByUserId String
  members         ProjectMembership[]
  invites         ProjectInvite[]
  files           File[]

  requiredDocuments ProjectRequiredDocument[]
  clientDocuments   ClientDocument[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model ProjectMembership {
  id        String   @id @default(uuid())
  projectId String
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  role      Role // "ADMIN" | "USER"
  createdAt DateTime @default(now())

  @@unique([projectId, userId])
}

model ProjectInvite {
  id        String   @id @default(uuid())
  projectId String
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  token     String   @unique @default(uuid())
  role      Role // "ADMIN" | "USER"
  expiresAt DateTime
  maxUses   Int      @default(1)
  usedCount Int      @default(0)
  createdAt DateTime @default(now())
}

model File {
  id                  String               @id @default(uuid())
  filename            String
  originalName        String
  mimetype            String
  size                Int
  url                 String
  userId              String
  user                User                 @relation(fields: [userId], references: [id])
  projectId           String
  project             Project              @relation(fields: [projectId], references: [id], onDelete: Cascade)
  verificationResults VerificationResult[]
  shareLinks          ShareLink[]
  clientDocuments     ClientDocument[]
  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @updatedAt
}

model VerificationResult {
  id             String             @id @default(uuid())
  fileId         String
  file           File               @relation(fields: [fileId], references: [id], onDelete: Cascade)
  score          Float
  status         VerificationStatus // APPROVED, CONDITIONAL, REJECTED
  blurScore      Float?
  brightness     Float?
  textDetected   Boolean
  usefulAreaPct  Float?
  recommendation String?
  createdAt      DateTime           @default(now())
}

model ShareLink {
  id        String   @id @default(uuid())
  fileId    String
  file      File     @relation(fields: [fileId], references: [id], onDelete: Cascade)
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
}

model DocumentType {
  id          String  @id @default(uuid())
  name        String
  slug        String
  description String?

  isDefault Boolean @default(false)
  tenantId  String?

  createdById String?
  createdBy   User?   @relation(fields: [createdById], references: [id], onDelete: Cascade)

  requiredIn ProjectRequiredDocument[]
  documents  ClientDocument[]

  deletedAt DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@unique([slug, tenantId]) // To prevent duplicates per tenant, and globally for defaults (tenantId = null)
}

model ProjectRequiredDocument {
  id             String       @id @default(uuid())
  projectId      String
  project        Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  documentTypeId String
  documentType   DocumentType @relation(fields: [documentTypeId], references: [id], onDelete: Cascade)
  required       Boolean      @default(true)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@unique([projectId, documentTypeId])
}

model ClientDocument {
  id        String  @id @default(uuid())
  projectId String
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  ownerUserId String
  ownerUser   User   @relation("DocumentOwner", fields: [ownerUserId], references: [id], onDelete: Cascade)

  uploadedByUserId String
  uploadedByUser   User   @relation("DocumentUploader", fields: [uploadedByUserId], references: [id])

  documentTypeId String
  documentType   DocumentType @relation(fields: [documentTypeId], references: [id], onDelete: Cascade)

  fileId String
  file   File   @relation(fields: [fileId], references: [id], onDelete: Cascade)

  status          DocumentStatus @default(pending) // pending, approved, rejected
  rejectionReason String?

  uploadedAt       DateTime  @default(now())
  reviewedAt       DateTime?
  reviewedByUserId String?
  reviewedByUser   User?     @relation("DocumentReviewer", fields: [reviewedByUserId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
===
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

enum Role {
  ADMIN
  USER
}

enum VerificationStatus {
  APPROVED
  CONDITIONAL
  REJECTED
}

enum DocumentStatus {
  pending
  approved
  rejected
}

model User {
  id         String              @id @default(uuid())
  email      String              @unique
  password   String?
  name       String
  image      String?
  provider   String?
  providerId String?
  files      File[]
  projects   ProjectMembership[]

  clientDocsOwned    ClientDocument[] @relation("DocumentOwner")
  clientDocsUploaded ClientDocument[] @relation("DocumentUploader")
  clientDocsReviewed ClientDocument[] @relation("DocumentReviewer")
  documentTypes      DocumentType[]
  rejectedUploads    RejectedUpload[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Project {
  id              String              @id @default(uuid())
  name            String
  createdByUserId String
  members         ProjectMembership[]
  invites         ProjectInvite[]
  files           File[]
  rejectedUploads RejectedUpload[]

  requiredDocuments ProjectRequiredDocument[]
  clientDocuments   ClientDocument[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model ProjectMembership {
  id        String   @id @default(uuid())
  projectId String
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  role      Role // "ADMIN" | "USER"
  createdAt DateTime @default(now())

  @@unique([projectId, userId])
}

model ProjectInvite {
  id        String   @id @default(uuid())
  projectId String
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  token     String   @unique @default(uuid())
  role      Role // "ADMIN" | "USER"
  expiresAt DateTime
  maxUses   Int      @default(1)
  usedCount Int      @default(0)
  createdAt DateTime @default(now())
}

model File {
  id                  String               @id @default(uuid())
  filename            String
  originalName        String
  mimetype            String
  size                Int
  url                 String
  userId              String
  user                User                 @relation(fields: [userId], references: [id])
  projectId           String
  project             Project              @relation(fields: [projectId], references: [id], onDelete: Cascade)
  verificationResults VerificationResult[]
  shareLinks          ShareLink[]
  clientDocuments     ClientDocument[]
  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @updatedAt
}

model VerificationResult {
  id             String             @id @default(uuid())
  fileId         String
  file           File               @relation(fields: [fileId], references: [id], onDelete: Cascade)
  score          Float
  status         VerificationStatus // APPROVED, CONDITIONAL, REJECTED
  blurScore      Float?
  brightness     Float?
  textDetected   Boolean
  usefulAreaPct  Float?
  recommendation String?
  createdAt      DateTime           @default(now())
}

model ShareLink {
  id        String   @id @default(uuid())
  fileId    String
  file      File     @relation(fields: [fileId], references: [id], onDelete: Cascade)
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
}

model DocumentType {
  id          String  @id @default(uuid())
  name        String
  slug        String
  description String?

  isDefault Boolean @default(false)
  tenantId  String?

  createdById String?
  createdBy   User?   @relation(fields: [createdById], references: [id], onDelete: Cascade)

  requiredIn ProjectRequiredDocument[]
  documents  ClientDocument[]

  deletedAt DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@unique([slug, tenantId]) // To prevent duplicates per tenant, and globally for defaults (tenantId = null)
}

model ProjectRequiredDocument {
  id             String       @id @default(uuid())
  projectId      String
  project        Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  documentTypeId String
  documentType   DocumentType @relation(fields: [documentTypeId], references: [id], onDelete: Cascade)
  required       Boolean      @default(true)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@unique([projectId, documentTypeId])
}

model ClientDocument {
  id        String  @id @default(uuid())
  projectId String
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  ownerUserId String
  ownerUser   User   @relation("DocumentOwner", fields: [ownerUserId], references: [id], onDelete: Cascade)

  uploadedByUserId String
  uploadedByUser   User   @relation("DocumentUploader", fields: [uploadedByUserId], references: [id])

  documentTypeId String
  documentType   DocumentType @relation(fields: [documentTypeId], references: [id], onDelete: Cascade)

  fileId String
  file   File   @relation(fields: [fileId], references: [id], onDelete: Cascade)

  status          DocumentStatus @default(pending) // pending, approved, rejected
  rejectionReason String?

  uploadedAt       DateTime  @default(now())
  reviewedAt       DateTime?
  reviewedByUserId String?
  reviewedByUser   User?     @relation("DocumentReviewer", fields: [reviewedByUserId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model RejectedUpload {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  projectId String?
  project   Project? @relation(fields: [projectId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
}
```

### 2. Registro de rejeição em [fileController.ts](file:///c:/Users/dudub/Desktop/Bentifiles-V2/backend/src/controllers/fileController.ts)

```diff:fileController.ts
import { Request, Response } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth';
import axios from 'axios';
import FormData from 'form-data';
import { upload } from '../middleware/upload';
import crypto from 'crypto';
import { Readable } from 'stream';
import { uploadToR2, getFileUrl, getFileFromR2 } from '../services/r2Service';

// Map allowed MIME types to secure, hardcoded extensions
const mimeToExt: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
};

export const uploadFile = async (req: AuthRequest, res: Response) => {
    try {
        const file = req.file;
        const userId = req.user?.userId;
        const { projectId } = req.body;

        console.log(`[Upload] Starting upload process for user ${userId} in project ${projectId}`);

        if (!file) {
            console.error('[Upload] No file received in request');
            return res.status(400).json({ message: 'Nenhum arquivo enviado' });
        }

        console.log(`[Upload] File received: ${file.originalname} (${file.mimetype}, ${file.size} bytes)`);

        if (!projectId) {
            console.error('[Upload] Missing projectId in request body');
            return res.status(400).json({ message: 'projectId é obrigatório' });
        }

        if (!userId) {
            console.error('[Upload] Unauthorized: user context missing');
            return res.status(401).json({ message: 'Não autorizado' });
        }

        const fileBuffer = file.buffer;
        let analysisData: any = null;

        // If it's an image, send to Python microservice for validation
        if (file.mimetype.startsWith('image/')) {
            console.log('[Upload] Image detected, sending for analysis...');
            try {

                const url = process.env.AMBIENTE == 'DEV' ? 'http://localhost:8000' : process.env.PYTHON_MICROSERVICE_URL;
                const formData = new FormData();
                const stream = Readable.from(fileBuffer);
                formData.append('file', stream, {
                    filename: file.originalname,
                    contentType: file.mimetype,
                    knownLength: fileBuffer.length,
                });
                const pythonResponse = await axios.post(`${url}/analyze`, formData, {
                    headers: {
                        ...formData.getHeaders(),
                    },
                });

                analysisData = pythonResponse.data;
                console.log('[Upload] Analysis complete:', analysisData);

                if (!analysisData.approved) {
                    console.log('[Upload] Image rejected by analysis service');
                    return res.status(400).json({
                        success: false,
                        message: "A imagem não atende aos critérios mínimos de qualidade",
                        analysis: {
                            approved: analysisData.approved,
                            score: analysisData.score,
                            minScore: analysisData.minScore,
                            reasons: analysisData.reasons
                        }
                    });
                }
                console.log('[Upload] Image approved');
            } catch (microserviceError) {
                console.error('[Upload] Microservice error:', microserviceError);
                return res.status(503).json({
                    success: false,
                    message: "Falha ao validar a imagem. O serviço de análise pode estar indisponível."
                });
            }
        }

        // Generate secure filename
        const ext = mimeToExt[file.mimetype] || '.bin';
        const savedFilename = `${crypto.randomUUID()}${ext}`;

        console.log('[Upload] Saving file to R2...');
        await uploadToR2(fileBuffer, file.mimetype, savedFilename);
        console.log(`[Upload] File saved to R2 as: ${savedFilename}`);

        console.log('[Upload] Creating database record...');
        const dbFile = await prisma.file.create({
            data: {
                filename: savedFilename,
                originalName: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
                url: await getFileUrl(savedFilename),
                userId: userId,
                projectId: projectId,
            },
        });

        if (analysisData) {
            await prisma.verificationResult.create({
                data: {
                    fileId: dbFile.id,
                    score: analysisData.score,
                    status: analysisData.status,
                    blurScore: analysisData.blurScore,
                    brightness: analysisData.brightness,
                    textDetected: analysisData.textDetected,
                    usefulAreaPct: analysisData.usefulAreaPct,
                    recommendation: analysisData.recommendation || (analysisData.reasons ? analysisData.reasons.join(" | ") : null),
                }
            });
            console.log('[Upload] Verification result saved to database');
        }

        const resultingFile = await prisma.file.findUnique({
            where: { id: dbFile.id },
            include: { verificationResults: true }
        });

        console.log('[Upload] Process finished successfully');
        res.status(201).json({
            success: true,
            message: 'Upload realizado com sucesso',
            analysis: analysisData ? {
                approved: analysisData.approved,
                score: analysisData.score
            } : undefined,
            document: resultingFile,
            file: resultingFile
        });

    } catch (error) {
        console.error('[Upload] Unexpected internal error:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
};

export const getFiles = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ message: "Não autorizado" });

        const files = await prisma.file.findMany({
            where: { userId },
            include: { verificationResults: true },
            orderBy: { createdAt: 'desc' }
        });

        res.json(files);
    } catch (error) {
        console.error('Get files error:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
}

export const getFileBase64 = async (req: AuthRequest, res: Response) => {
    try {
        const { url } = req.query;
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ message: 'URL do arquivo não fornecida' });
        }

        // Extract filename from URL (last segment before query params)
        const urlWithoutQuery = url.split('?')[0];
        const filename = urlWithoutQuery ? urlWithoutQuery.split('/').pop() : null;

        if (!filename) {
            return res.status(400).json({ message: 'Nome do arquivo não encontrado na URL' });
        }

        let fileBuffer: Buffer;
        let mimeType: string;

        try {
            const r2Data = await getFileFromR2(filename);
            fileBuffer = r2Data.buffer;
            mimeType = r2Data.contentType;
        } catch (r2Error) {
            console.error(`Failed to fetch ${filename} from R2:`, r2Error);
            return res.status(404).json({ message: 'Arquivo não encontrado' });
        }

        const base64 = fileBuffer.toString('base64');
        res.json({ base64, mimeType });
    } catch (error) {
        console.error('Get file base64 error:', error);
        res.status(500).json({ message: 'Erro interno ao converter arquivo' });
    }
};
===
import { Request, Response } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth';
import axios from 'axios';
import FormData from 'form-data';
import { upload } from '../middleware/upload';
import crypto from 'crypto';
import { Readable } from 'stream';
import { uploadToR2, getFileUrl, getFileFromR2 } from '../services/r2Service';

// Map allowed MIME types to secure, hardcoded extensions
const mimeToExt: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
};

export const uploadFile = async (req: AuthRequest, res: Response) => {
    try {
        const file = req.file;
        const userId = req.user?.userId;
        const { projectId } = req.body;

        console.log(`[Upload] Starting upload process for user ${userId} in project ${projectId}`);

        if (!file) {
            console.error('[Upload] No file received in request');
            return res.status(400).json({ message: 'Nenhum arquivo enviado' });
        }

        console.log(`[Upload] File received: ${file.originalname} (${file.mimetype}, ${file.size} bytes)`);

        if (!projectId) {
            console.error('[Upload] Missing projectId in request body');
            return res.status(400).json({ message: 'projectId é obrigatório' });
        }

        if (!userId) {
            console.error('[Upload] Unauthorized: user context missing');
            return res.status(401).json({ message: 'Não autorizado' });
        }

        const fileBuffer = file.buffer;
        let analysisData: any = null;

        // If it's an image, send to Python microservice for validation
        if (file.mimetype.startsWith('image/')) {
            console.log('[Upload] Image detected, sending for analysis...');
            try {

                const url = process.env.AMBIENTE == 'DEV' ? 'http://localhost:8000' : process.env.PYTHON_MICROSERVICE_URL;
                const formData = new FormData();
                const stream = Readable.from(fileBuffer);
                formData.append('file', stream, {
                    filename: file.originalname,
                    contentType: file.mimetype,
                    knownLength: fileBuffer.length,
                });
                const pythonResponse = await axios.post(`${url}/analyze`, formData, {
                    headers: {
                        ...formData.getHeaders(),
                    },
                });

                analysisData = pythonResponse.data;
                console.log('[Upload] Analysis complete:', analysisData);

                if (!analysisData.approved) {
                    console.log('[Upload] Image rejected by analysis service');

                    await prisma.rejectedUpload.create({
                        data: {
                            userId,
                            projectId: projectId || null,
                        },
                    });
                    console.log('[Upload] Rejection event recorded in database');

                    return res.status(400).json({
                        success: false,
                        message: "A imagem não atende aos critérios mínimos de qualidade",
                        analysis: {
                            approved: analysisData.approved,
                            score: analysisData.score,
                            minScore: analysisData.minScore,
                            reasons: analysisData.reasons
                        }
                    });
                }
                console.log('[Upload] Image approved');
            } catch (microserviceError) {
                console.error('[Upload] Microservice error:', microserviceError);
                return res.status(503).json({
                    success: false,
                    message: "Falha ao validar a imagem. O serviço de análise pode estar indisponível."
                });
            }
        }

        // Generate secure filename
        const ext = mimeToExt[file.mimetype] || '.bin';
        const savedFilename = `${crypto.randomUUID()}${ext}`;

        console.log('[Upload] Saving file to R2...');
        await uploadToR2(fileBuffer, file.mimetype, savedFilename);
        console.log(`[Upload] File saved to R2 as: ${savedFilename}`);

        console.log('[Upload] Creating database record...');
        const dbFile = await prisma.file.create({
            data: {
                filename: savedFilename,
                originalName: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
                url: await getFileUrl(savedFilename),
                userId: userId,
                projectId: projectId,
            },
        });

        if (analysisData) {
            await prisma.verificationResult.create({
                data: {
                    fileId: dbFile.id,
                    score: analysisData.score,
                    status: analysisData.status,
                    blurScore: analysisData.blurScore,
                    brightness: analysisData.brightness,
                    textDetected: analysisData.textDetected,
                    usefulAreaPct: analysisData.usefulAreaPct,
                    recommendation: analysisData.recommendation || (analysisData.reasons ? analysisData.reasons.join(" | ") : null),
                }
            });
            console.log('[Upload] Verification result saved to database');
        }

        const resultingFile = await prisma.file.findUnique({
            where: { id: dbFile.id },
            include: { verificationResults: true }
        });

        console.log('[Upload] Process finished successfully');
        res.status(201).json({
            success: true,
            message: 'Upload realizado com sucesso',
            analysis: analysisData ? {
                approved: analysisData.approved,
                score: analysisData.score
            } : undefined,
            document: resultingFile,
            file: resultingFile
        });

    } catch (error) {
        console.error('[Upload] Unexpected internal error:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
};

export const getFiles = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ message: "Não autorizado" });

        const files = await prisma.file.findMany({
            where: { userId },
            include: { verificationResults: true },
            orderBy: { createdAt: 'desc' }
        });

        res.json(files);
    } catch (error) {
        console.error('Get files error:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
}

export const getFileBase64 = async (req: AuthRequest, res: Response) => {
    try {
        const { url } = req.query;
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ message: 'URL do arquivo não fornecida' });
        }

        // Extract filename from URL (last segment before query params)
        const urlWithoutQuery = url.split('?')[0];
        const filename = urlWithoutQuery ? urlWithoutQuery.split('/').pop() : null;

        if (!filename) {
            return res.status(400).json({ message: 'Nome do arquivo não encontrado na URL' });
        }

        let fileBuffer: Buffer;
        let mimeType: string;

        try {
            const r2Data = await getFileFromR2(filename);
            fileBuffer = r2Data.buffer;
            mimeType = r2Data.contentType;
        } catch (r2Error) {
            console.error(`Failed to fetch ${filename} from R2:`, r2Error);
            return res.status(404).json({ message: 'Arquivo não encontrado' });
        }

        const base64 = fileBuffer.toString('base64');
        res.json({ base64, mimeType });
    } catch (error) {
        console.error('Get file base64 error:', error);
        res.status(500).json({ message: 'Erro interno ao converter arquivo' });
    }
};
```

**Fluxo quando `approved = false`:**
1. Log: `[Upload] Image rejected by analysis service`
2. Cria registro em `RejectedUpload` com `userId` e `projectId`
3. Log: `[Upload] Rejection event recorded in database`
4. Retorna 400 com `score`, `minScore` e `reasons` (mesma resposta de antes)
5. **NÃO** envia arquivo para o R2, **NÃO** cria registro em [File](file:///c:/Users/dudub/Desktop/Bentifiles-V2/backend/src/controllers/fileController.ts#161-178)

**Fluxo quando `approved = true`:** Nenhuma mudança — funciona exatamente como antes.

---

## Migration

Migration `add_rejected_upload` aplicada com sucesso. Prisma Client regenerado.

---

## Exemplo de query para o Dashboard

Para contar o total de uploads reprovados:

```typescript
const totalRejected = await prisma.rejectedUpload.count();
```

Por usuário:

```typescript
const rejectedByUser = await prisma.rejectedUpload.count({
  where: { userId: 'user-id-here' },
});
```

Por projeto:

```typescript
const rejectedByProject = await prisma.rejectedUpload.count({
  where: { projectId: 'project-id-here' },
});
```

Por período (últimos 30 dias):

```typescript
const rejectedLast30Days = await prisma.rejectedUpload.count({
  where: {
    createdAt: {
      gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    },
  },
});
```

Agrupado por dia (para gráficos):

```typescript
const rejectedPerDay = await prisma.$queryRaw`
  SELECT DATE("createdAt") as date, COUNT(*)::int as count
  FROM "RejectedUpload"
  WHERE "createdAt" >= NOW() - INTERVAL '30 days'
  GROUP BY DATE("createdAt")
  ORDER BY date
`;
```
