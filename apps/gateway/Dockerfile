FROM node:22-alpine AS builder
WORKDIR /app

# Copiar configuración y dependencias
COPY package.json ./
RUN npm install

# Copiar código fuente y compilar
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# --- Imagen de producción ---
FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

CMD ["node", "dist/main"]
