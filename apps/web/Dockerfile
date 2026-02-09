FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./

# Copy app package.json (mocking structure)
COPY apps/web/package.json ./apps/web/

# Install dependencies from lockfile for deterministic builds
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/ ./

# Copy all source files (adjust if you want to be more specific)
COPY . .

# Set working directory to the web app
WORKDIR /app/apps/web

# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public folder
COPY --from=builder /app/apps/web/public ./apps/web/public

# Set permissions
RUN mkdir -p apps/web/.next
RUN chown -R nextjs:nodejs apps/web/.next

# Copy standalone output
# Next.js standalone output puts necessary files (including node_modules) safely in .next/standalone
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
# Force-include postgres driver: dynamic import path in db layer is not statically traceable.
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/postgres ./node_modules/postgres

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Start the server (path depends on where standalone puts it, usually apps/web/server.js)
CMD ["node", "apps/web/server.js"]
