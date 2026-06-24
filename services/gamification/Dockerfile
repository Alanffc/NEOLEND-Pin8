FROM node:20-alpine

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar código fuente
COPY . .

# Compilar TypeScript
RUN npm run build

# Puerto del servicio (según docker-compose.yml)
EXPOSE 3007

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3007/api/v1/gamification/health || exit 1

# Comando de inicio
CMD ["npm", "run", "start"]
