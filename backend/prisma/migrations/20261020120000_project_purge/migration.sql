ALTER TABLE "Project"
    ADD COLUMN "archivedAt" TIMESTAMP(3),
    ADD COLUMN "purgeWarningSentAt" TIMESTAMP(3);

-- Projetos já arquivados começam a contar os 7 dias a partir deste deploy.
UPDATE "Project" SET "archivedAt" = NOW() WHERE "status" = 'ARCHIVED';
