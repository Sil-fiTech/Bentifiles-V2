-- CreateTable
CREATE TABLE "RejectedUpload" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RejectedUpload_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RejectedUpload" ADD CONSTRAINT "RejectedUpload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RejectedUpload" ADD CONSTRAINT "RejectedUpload_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
