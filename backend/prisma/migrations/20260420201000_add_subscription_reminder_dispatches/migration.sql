-- CreateEnum
CREATE TYPE "SubscriptionReminderType" AS ENUM ('TRIAL_ENDING', 'SUBSCRIPTION_ENDING');

-- CreateEnum
CREATE TYPE "SubscriptionReminderStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'CANCELED', 'FAILED');

-- CreateTable
CREATE TABLE "SubscriptionReminderDispatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reminderType" "SubscriptionReminderType" NOT NULL,
    "reminderWindow" INTEGER NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" "SubscriptionReminderStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leasedAt" TIMESTAMP(3),
    "leaseExpiresAt" TIMESTAMP(3),
    "leasedBy" TEXT,
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionReminderDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionReminderDispatch_userId_reminderType_reminderWindow_targetDate_key"
ON "SubscriptionReminderDispatch"("userId", "reminderType", "reminderWindow", "targetDate");

-- CreateIndex
CREATE INDEX "SubscriptionReminderDispatch_status_scheduledFor_idx"
ON "SubscriptionReminderDispatch"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "SubscriptionReminderDispatch_userId_reminderType_status_idx"
ON "SubscriptionReminderDispatch"("userId", "reminderType", "status");

-- AddForeignKey
ALTER TABLE "SubscriptionReminderDispatch"
ADD CONSTRAINT "SubscriptionReminderDispatch_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
