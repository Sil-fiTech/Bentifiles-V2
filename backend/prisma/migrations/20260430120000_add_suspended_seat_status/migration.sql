DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionSeatMemberStatus') AND NOT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'SubscriptionSeatMemberStatus'
          AND e.enumlabel = 'SUSPENDED'
    ) THEN
        ALTER TYPE "SubscriptionSeatMemberStatus" ADD VALUE 'SUSPENDED';
    END IF;
END $$;

