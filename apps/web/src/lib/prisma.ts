import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// In production each serverless invocation gets a fresh module scope, so we
// never cache the client on globalThis there — Prisma handles connection
// pooling via the DATABASE_URL (pgBouncer / Neon / Supabase pooler).
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
