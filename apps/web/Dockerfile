# Stage 1 — deps
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2 — build
FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# FIX: Removed apps/web/ because context is already inside that folder
RUN npx prisma generate --schema=./prisma/schema.prisma

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3 — runner
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

# Force Prisma to use the correct engine for Alpine
ENV PRISMA_QUERY_ENGINE_LIBRARY=/app/node_modules/prisma/libquery_engine-linux-musl-openssl-3.0.x.so.node
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy standalone build
COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma files (Removed apps/web/ prefix)
COPY --from=build --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=build --chown=nextjs:nodejs /app/prisma ./prisma

# Re-create symlink
RUN mkdir -p node_modules/.bin \
    && BIN_PATH=$(node -pe "require('./node_modules/prisma/package.json').bin.prisma") \
    && ln -sf "../prisma/$BIN_PATH" node_modules/.bin/prisma \
    && chmod +x "node_modules/prisma/$BIN_PATH"

# FINAL PERMISSIONS - Run as root before switching user
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]