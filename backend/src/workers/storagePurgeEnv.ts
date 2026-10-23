// O worker usa o session pooler (5432): troca DATABASE_URL antes de o Prisma ler o ambiente.
if (process.env.STORAGE_PURGE_DATABASE_URL) process.env.DATABASE_URL = process.env.STORAGE_PURGE_DATABASE_URL;
