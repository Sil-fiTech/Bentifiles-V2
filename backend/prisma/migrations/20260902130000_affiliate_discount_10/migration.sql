-- Shared affiliate discount changed from 20% to 10%.
ALTER TABLE "Affiliate" ALTER COLUMN "discountPercent" SET DEFAULT 10;

-- Realign snapshots created with the previous default.
UPDATE "Affiliate" SET "discountPercent" = 10 WHERE "discountPercent" = 20;
