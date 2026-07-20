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

COPY apps/productos/tsconfig.json apps/productos/
COPY apps/productos/src apps/productos/src
# Contrato proto compartido del monorepo
COPY libs/proto libs/proto
RUN npm run build -w productos
# El proto debe estar junto al dist para cargarse en runtime
RUN mkdir -p apps/productos/dist/proto && cp libs/proto/* apps/productos/dist/proto/

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/apps/productos/dist ./dist
COPY apps/productos/package.json ./
CMD ["node", "dist/main"]
