CREATE TYPE "StorageConnectionStatus" AS ENUM ('ACTIVE', 'REVOKED');

CREATE TABLE "StorageConnection" (
    "id" TEXT NOT NULL,
    "provider" "StorageProvider" NOT NULL,
    "subscriptionId" TEXT,
    "userId" TEXT,
    "connectedByUserId" TEXT NOT NULL,
    "googleAccountEmail" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT NOT NULL,
    "rootFolderId" TEXT,
    "sharedDriveId" TEXT,
    "status" "StorageConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StorageConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StorageConnection_subscriptionId_key" ON "StorageConnection"("subscriptionId");
CREATE UNIQUE INDEX "StorageConnection_userId_key" ON "StorageConnection"("userId");
ALTER TABLE "StorageConnection" ADD CONSTRAINT "StorageConnection_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StorageConnection" ADD CONSTRAINT "StorageConnection_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StorageFolder" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    CONSTRAINT "StorageFolder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StorageFolder_connectionId_projectId_key" ON "StorageFolder"("connectionId", "projectId");
ALTER TABLE "StorageFolder" ADD CONSTRAINT "StorageFolder_connectionId_fkey"
    FOREIGN KEY ("connectionId") REFERENCES "StorageConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "File" ADD COLUMN "storageConnectionId" TEXT;
ALTER TABLE "File" ADD CONSTRAINT "File_storageConnectionId_fkey"
    FOREIGN KEY ("storageConnectionId") REFERENCES "StorageConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
