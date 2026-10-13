import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
export const useDevStore = process.env.NODE_ENV !== 'production' && !process.env.DATABASE_URL;

export function assertConfiguredDatabase() {
  if (!process.env.DATABASE_URL && !useDevStore) throw new Error('DATABASE_URL is required in production');
}
