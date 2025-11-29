# ==================================================
# Makefile - Ester
# ==================================================
# Comandos simplificados para Docker
# ==================================================

.PHONY: help build dev prod up down logs shell clean test install

# Colores para el output
RED=\033[0;31m
GREEN=\033[0;32m
YELLOW=\033[1;33m
NC=\033[0m # No Color

# Variables
PROJECT_NAME=ester
DEV_CONTAINER=$(PROJECT_NAME)-dev
PROD_CONTAINER=$(PROJECT_NAME)-prod

help: ## Mostrar esta ayuda
	@echo "$(GREEN)Ester - Comandos Docker$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "$(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'

# ==================================================
# Desarrollo
# ==================================================

dev: ## Iniciar en modo desarrollo (hot-reload)
	@echo "$(GREEN)🚀 Iniciando Ester en modo desarrollo...$(NC)"
	docker-compose up --build

dev-detached: ## Iniciar en modo desarrollo en segundo plano
	@echo "$(GREEN)🚀 Iniciando Ester en modo desarrollo (detached)...$(NC)"
	docker-compose up --build -d
	@echo "$(GREEN)✅ Ester corriendo en http://localhost:4200$(NC)"

dev-down: ## Detener contenedores de desarrollo
	@echo "$(RED)🛑 Deteniendo contenedores de desarrollo...$(NC)"
	docker-compose down

dev-logs: ## Ver logs de desarrollo
	docker-compose logs -f ester-dev

dev-shell: ## Acceder al shell del contenedor de desarrollo
	docker-compose exec ester-dev sh

# ==================================================
# Producción
# ==================================================

prod: ## Iniciar en modo producción
	@echo "$(GREEN)🚀 Iniciando Ester en modo producción...$(NC)"
	docker-compose -f docker-compose.prod.yml up --build

prod-detached: ## Iniciar en modo producción en segundo plano
	@echo "$(GREEN)🚀 Iniciando Ester en modo producción (detached)...$(NC)"
	docker-compose -f docker-compose.prod.yml up --build -d
	@echo "$(GREEN)✅ Ester corriendo en http://localhost$(NC)"

prod-down: ## Detener contenedores de producción
	@echo "$(RED)🛑 Deteniendo contenedores de producción...$(NC)"
	docker-compose -f docker-compose.prod.yml down

prod-logs: ## Ver logs de producción
	docker-compose -f docker-compose.prod.yml logs -f ester-prod

prod-shell: ## Acceder al shell del contenedor de producción
	docker-compose -f docker-compose.prod.yml exec ester-prod sh

# ==================================================
# Build
# ==================================================

build-dev: ## Build imagen de desarrollo
	@echo "$(GREEN)🔨 Building imagen de desarrollo...$(NC)"
	docker build --target development -t $(PROJECT_NAME):dev .

build-prod: ## Build imagen de producción
	@echo "$(GREEN)🔨 Building imagen de producción...$(NC)"
	docker build --target production -t $(PROJECT_NAME):prod .

build-all: ## Build todas las imágenes
	@echo "$(GREEN)🔨 Building todas las imágenes...$(NC)"
	@make build-dev
	@make build-prod

# ==================================================
# Utilidades
# ==================================================

logs: ## Ver logs de todos los contenedores
	docker-compose logs -f

stop: ## Detener todos los contenedores
	@echo "$(RED)🛑 Deteniendo todos los contenedores...$(NC)"
	docker-compose down
	docker-compose -f docker-compose.prod.yml down

clean: ## Limpiar contenedores, imágenes y volúmenes
	@echo "$(RED)🧹 Limpiando contenedores, imágenes y volúmenes...$(NC)"
	docker-compose down -v --rmi all
	docker-compose -f docker-compose.prod.yml down -v --rmi all
	@echo "$(GREEN)✅ Limpieza completada$(NC)"

prune: ## Limpiar todo Docker (cuidado!)
	@echo "$(RED)⚠️  ADVERTENCIA: Esto eliminará TODAS las imágenes, contenedores y volúmenes no utilizados$(NC)"
	@read -p "¿Estás seguro? [y/N] " -n 1 -r; \
	echo ""; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker system prune -af --volumes; \
		echo "$(GREEN)✅ Limpieza completa realizada$(NC)"; \
	else \
		echo "$(YELLOW)Operación cancelada$(NC)"; \
	fi

ps: ## Ver estado de los contenedores
	@echo "$(GREEN)📋 Estado de los contenedores:$(NC)"
	@docker ps -a --filter "name=$(PROJECT_NAME)"

images: ## Ver imágenes de Ester
	@echo "$(GREEN)📦 Imágenes de Ester:$(NC)"
	@docker images | grep $(PROJECT_NAME)

# ==================================================
# Testing
# ==================================================

test: ## Ejecutar tests
	@echo "$(GREEN)🧪 Ejecutando tests...$(NC)"
	docker-compose exec ester-dev npm test

test-ci: ## Ejecutar tests en CI (single run)
	@echo "$(GREEN)🧪 Ejecutando tests en modo CI...$(NC)"
	docker-compose exec ester-dev npm test -- --watch=false --browsers=ChromeHeadless

# ==================================================
# Desarrollo
# ==================================================

install: ## Instalar/actualizar dependencias
	@echo "$(GREEN)📦 Instalando dependencias...$(NC)"
	docker-compose exec ester-dev npm install

lint: ## Ejecutar linter
	@echo "$(GREEN)🔍 Ejecutando linter...$(NC)"
	docker-compose exec ester-dev npm run lint

format: ## Formatear código
	@echo "$(GREEN)💅 Formateando código...$(NC)"
	docker-compose exec ester-dev npm run format

# ==================================================
# Información
# ==================================================

info: ## Mostrar información del proyecto
	@echo "$(GREEN)=================================================="
	@echo "Ester - Software Contable Profesional"
	@echo "==================================================$(NC)"
	@echo ""
	@echo "$(YELLOW)📋 Información del Proyecto:$(NC)"
	@echo "  Nombre: $(PROJECT_NAME)"
	@echo "  Versión: 1.0.0"
	@echo ""
	@echo "$(YELLOW)🔗 URLs:$(NC)"
	@echo "  Desarrollo: http://localhost:4200"
	@echo "  Producción: http://localhost"
	@echo ""
	@echo "$(YELLOW)📦 Contenedores:$(NC)"
	@docker ps -a --filter "name=$(PROJECT_NAME)" --format "  {{.Names}} - {{.Status}}" 2>/dev/null || echo "  Ningún contenedor corriendo"
	@echo ""

# Default target
.DEFAULT_GOAL := help

