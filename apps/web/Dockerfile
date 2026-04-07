# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — deps: install production + dev dependencies
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

# Install libc compat for native modules (e.g. Prisma engines)
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./
RUN npm ci

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — build: generate Prisma client and compile Next.js
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

RUN apk add --no-cache libc6-compat

# Copy deps from previous stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source files
COPY . .

# Generate Prisma client (requires schema to be present)
RUN npx prisma generate

# Build Next.js (DATABASE_URL is not needed at build time for static pages;
# the Prisma client generation above only needs the schema file)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3 — runner: minimal production image
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

RUN apk add --no-cache libc6-compat

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy the standalone build output and static assets
COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma client engines need to be present at runtime
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

# Prisma CLI + schema/migrations needed for `prisma migrate deploy`
COPY --from=build /app/node_modules/prisma ./node_modules/prisma
COPY --from=build /app/prisma ./prisma
# Re-create the .bin/prisma symlink properly (Docker COPY resolves symlinks into
# plain files, which breaks __dirname-relative WASM lookups inside the CLI).
RUN mkdir -p node_modules/.bin \
    && BIN_PATH=$(node -pe "require('./node_modules/prisma/package.json').bin.prisma") \
    && ln -sf "../prisma/$BIN_PATH" node_modules/.bin/prisma \
    && chmod +x "node_modules/prisma/$BIN_PATH"

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
