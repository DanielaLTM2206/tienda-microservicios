# Contexto de build: la RAIZ del monorepo (ver docker-compose*.yml)
FROM node:22-alpine AS builder
WORKDIR /repo

# Manifiestos del workspace: npm ci instala EXACTAMENTE lo del package-lock.json
# (build reproducible; npm ci falla si lock y package.json divergen)
COPY package.json package-lock.json ./
COPY apps/gateway/package.json apps/gateway/
COPY apps/pedidos/package.json apps/pedidos/
COPY apps/productos/package.json apps/productos/
COPY apps/notificaciones/package.json apps/notificaciones/
RUN npm ci

COPY apps/gateway/tsconfig.json apps/gateway/
COPY apps/gateway/src apps/gateway/src
RUN npm run build -w gateway

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/apps/gateway/dist ./dist
COPY apps/gateway/package.json ./
CMD ["node", "dist/main"]
