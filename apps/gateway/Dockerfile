FROM node:22-alpine AS builder
WORKDIR /app
COPY ./apps/gateway/package.json ./
RUN npm install
COPY ./apps/gateway/tsconfig.json ./
COPY ./apps/gateway/src/ ./src/
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY ./apps/gateway/package.json ./
CMD ["node", "dist/main"]
