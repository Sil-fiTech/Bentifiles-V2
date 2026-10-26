CREATE TYPE "StorageProvider" AS ENUM ('R2', 'GDRIVE');
CREATE TYPE "FileAccessAction" AS ENUM ('VIEW', 'DOWNLOAD', 'ZIP');

ALTER TABLE "File"
    ADD COLUMN "storageProvider" "StorageProvider" NOT NULL DEFAULT 'R2',
    ADD COLUMN "storageRef" TEXT,
    ADD COLUMN "encryptedDek" TEXT,
    ADD COLUMN "iv" TEXT,
    ADD COLUMN "authTag" TEXT,
    ADD COLUMN "keyVersion" INTEGER,
    ADD COLUMN "purgedAt" TIMESTAMP(3);

UPDATE "File" SET "storageRef" = "filename";
ALTER TABLE "File" ALTER COLUMN "storageRef" SET NOT NULL;
ALTER TABLE "File" DROP COLUMN "url";

CREATE TABLE "FileAccessLog" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "FileAccessAction" NOT NULL,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FileAccessLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FileAccessLog_fileId_createdAt_idx" ON "FileAccessLog"("fileId", "createdAt");

ALTER TABLE "FileAccessLog" ADD CONSTRAINT "FileAccessLog_fileId_fkey"
    FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;
