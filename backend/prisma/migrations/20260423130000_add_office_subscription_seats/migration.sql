DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionSeatType') THEN
        CREATE TYPE "SubscriptionSeatType" AS ENUM ('OWNER', 'MEMBER');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionSeatMemberStatus') THEN
        CREATE TYPE "SubscriptionSeatMemberStatus" AS ENUM ('ACTIVE', 'REMOVED');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionInviteStatus') THEN
        CREATE TYPE "SubscriptionInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Subscription" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'NONE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'NONE',
    "billingInterval" TEXT,
    "totalSeats" INTEGER NOT NULL DEFAULT 0,
    "usedSeats" INTEGER NOT NULL DEFAULT 0,
    "availableSeats" INTEGER NOT NULL DEFAULT 0,
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SubscriptionSeatMember" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invitedByUserId" TEXT,
    "seatType" "SubscriptionSeatType" NOT NULL,
    "status" "SubscriptionSeatMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubscriptionSeatMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SubscriptionInvite" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "SubscriptionInviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "acceptedByUserId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubscriptionInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_ownerId_key" ON "Subscription"("ownerId");
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");
CREATE INDEX IF NOT EXISTS "Subscription_plan_status_idx" ON "Subscription"("plan", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionSeatMember_subscriptionId_userId_key" ON "SubscriptionSeatMember"("subscriptionId", "userId");
CREATE INDEX IF NOT EXISTS "SubscriptionSeatMember_subscriptionId_status_idx" ON "SubscriptionSeatMember"("subscriptionId", "status");
CREATE INDEX IF NOT EXISTS "SubscriptionSeatMember_userId_status_idx" ON "SubscriptionSeatMember"("userId", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionInvite_token_key" ON "SubscriptionInvite"("token");
CREATE INDEX IF NOT EXISTS "SubscriptionInvite_subscriptionId_status_idx" ON "SubscriptionInvite"("subscriptionId", "status");
CREATE INDEX IF NOT EXISTS "SubscriptionInvite_email_status_idx" ON "SubscriptionInvite"("email", "status");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'Subscription_ownerId_fkey'
          AND table_name = 'Subscription'
    ) THEN
        ALTER TABLE "Subscription"
            ADD CONSTRAINT "Subscription_ownerId_fkey"
            FOREIGN KEY ("ownerId") REFERENCES "User"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'SubscriptionSeatMember_subscriptionId_fkey'
          AND table_name = 'SubscriptionSeatMember'
    ) THEN
        ALTER TABLE "SubscriptionSeatMember"
            ADD CONSTRAINT "SubscriptionSeatMember_subscriptionId_fkey"
            FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'SubscriptionSeatMember_userId_fkey'
          AND table_name = 'SubscriptionSeatMember'
    ) THEN
        ALTER TABLE "SubscriptionSeatMember"
            ADD CONSTRAINT "SubscriptionSeatMember_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'SubscriptionSeatMember_invitedByUserId_fkey'
          AND table_name = 'SubscriptionSeatMember'
    ) THEN
        ALTER TABLE "SubscriptionSeatMember"
            ADD CONSTRAINT "SubscriptionSeatMember_invitedByUserId_fkey"
            FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'SubscriptionInvite_subscriptionId_fkey'
          AND table_name = 'SubscriptionInvite'
    ) THEN
        ALTER TABLE "SubscriptionInvite"
            ADD CONSTRAINT "SubscriptionInvite_subscriptionId_fkey"
            FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'SubscriptionInvite_invitedByUserId_fkey'
          AND table_name = 'SubscriptionInvite'
    ) THEN
        ALTER TABLE "SubscriptionInvite"
            ADD CONSTRAINT "SubscriptionInvite_invitedByUserId_fkey"
            FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'SubscriptionInvite_acceptedByUserId_fkey'
          AND table_name = 'SubscriptionInvite'
    ) THEN
        ALTER TABLE "SubscriptionInvite"
            ADD CONSTRAINT "SubscriptionInvite_acceptedByUserId_fkey"
            FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
