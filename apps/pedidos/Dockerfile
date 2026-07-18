FROM node:22-alpine AS builder
WORKDIR /app
COPY ./apps/pedidos/package.json ./
RUN npm install
COPY ./apps/pedidos/tsconfig.json ./
COPY ./apps/pedidos/src/ ./src/
# Copiar el contrato proto compartido desde la raíz del monorepo
COPY ./apps/proto/ ./proto/
RUN npm run build
# Copiar el proto al directorio dist para que sea accesible en runtime
RUN mkdir -p dist/proto && cp -r proto/* dist/proto/

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY ./apps/pedidos/package.json ./
CMD ["node", "dist/main"]
