FROM node:22-alpine AS builder
WORKDIR /app
COPY ./apps/notificaciones/package.json ./
RUN npm install
COPY ./apps/notificaciones/tsconfig.json ./
COPY ./apps/notificaciones/src/ ./src/
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY ./apps/notificaciones/package.json ./
CMD ["node", "dist/main"]
