# ==============================================================================
# Multi-Stage Dockerfile for Humberto Dealer Frontend (Next.js 16 Standalone)
# Base: node:20-alpine
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Dependencies (descarga y caché de dependencias pnpm)
# ------------------------------------------------------------------------------
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Habilitar pnpm mediante Corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copiar manifiestos y lockfile para aprovechar caché de capas
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
RUN pnpm install --frozen-lockfile

# ------------------------------------------------------------------------------
# Stage 2: Builder (compilación de la app con Next.js Standalone)
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Argumentos de compilación para Next.js
ARG NEXT_PUBLIC_API_URL=/api
ARG BACKEND_URL=http://backend:5001/api

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    BACKEND_URL=$BACKEND_URL \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

# Ejecuta next build con output standalone habilitado
RUN pnpm run build

# ------------------------------------------------------------------------------
# Stage 3: Runner (imagen ultra-ligera de producción ~160 MB)
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

# Usuario de sistema no root para máxima seguridad
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copiar archivos públicos estáticos
COPY --from=builder /app/public ./public

# Crear directorio .next y ajustar permisos para la caché en ejecución
RUN mkdir .next && chown nextjs:nodejs .next

# Copiar el runtime standalone compilado y los assets estáticos
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# Healthcheck usando wget nativo de Alpine/Busybox
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

CMD ["node", "server.js"]
