ALTER TABLE "ProjectInvite" ADD COLUMN "email" TEXT;
ALTER TABLE "ProjectInvite" ADD COLUMN "invitedByUserId" TEXT;
ALTER TABLE "ProjectInvite" ADD COLUMN "emailSentAt" TIMESTAMP(3);
ALTER TABLE "ProjectInvite" ADD COLUMN "acceptedAt" TIMESTAMP(3);
