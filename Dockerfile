# ==================================================
# Dockerfile Multi-Stage - Ester
# ==================================================
# Dockerfile optimizado para Angular 21 con:
# - Stage de desarrollo (hot-reload)
# - Stage de producción (nginx)
# - Node.js 22 (requerido por Angular CLI)
# ==================================================

# ==================================================
# Stage 1: Base - Node.js 22
# ==================================================
FROM node:22-alpine AS base

# Metadatos
LABEL maintainer="Ester Dev Team"
LABEL description="Ester - Software Contable Profesional"
LABEL version="1.0.0"

# Instalar dependencias del sistema
RUN apk add --no-cache \
    git \
    python3 \
    make \
    g++

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# ==================================================
# Stage 2: Dependencies - Instalar dependencias
# ==================================================
FROM base AS dependencies

# Instalar todas las dependencias (incluyendo devDependencies)
RUN npm ci --legacy-peer-deps

# ==================================================
# Stage 3: Development - Para desarrollo local
# ==================================================
FROM base AS development

# Copiar node_modules desde el stage de dependencias
COPY --from=dependencies /app/node_modules ./node_modules

# Copiar el código fuente
COPY . .

# Exponer puerto de desarrollo
EXPOSE 4200

# Variables de entorno para desarrollo
ENV NODE_ENV=development

# Comando para desarrollo (con hot-reload)
CMD ["npm", "start", "--", "--host", "0.0.0.0", "--poll", "2000"]

# ==================================================
# Stage 4: Build - Compilar la aplicación
# ==================================================
FROM dependencies AS build

# Copiar el código fuente
COPY . .

# Compilar la aplicación para producción
RUN npm run build -- --configuration production

# ==================================================
# Stage 5: Production - Nginx para servir la aplicación
# ==================================================
FROM nginx:1.25-alpine AS production

# Metadatos de producción
LABEL stage="production"

# Instalar curl para healthchecks
RUN apk add --no-cache curl

# Copiar configuración de nginx
COPY nginx.conf /etc/nginx/nginx.conf

# Copiar archivos compilados desde el stage de build
COPY --from=build /app/dist/ester/browser /usr/share/nginx/html

# Crear usuario no-root para nginx
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d

RUN touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Cambiar a usuario no-root
USER nginx

# Exponer puerto 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

# Comando para iniciar nginx
CMD ["nginx", "-g", "daemon off;"]

