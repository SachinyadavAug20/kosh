# KOSH // Minimalist Creative MCP Hub Makefile

SHELL := /bin/bash

.PHONY: all check-deps build dev backend frontend clean help

help:
	@echo "KOSH - Minimalist Creative MCP Hub"
	@echo "-----------------------------------"
	@echo "make check-deps   Verify Java 21, Maven, Node.js, and Blender"
	@echo "make build        Build backend (JAR) and frontend (Next.js)"
	@echo "make dev          Run backend (8080) and frontend (3000) concurrently"
	@echo "make backend      Run Spring Boot backend standalone"
	@echo "make frontend     Run Next.js frontend standalone"
	@echo "make test         Run backend unit tests"
	@echo "make clean        Clean build artifacts and temporary files"

check-deps:
	@echo "=== Checking Prerequisites ==="
	@which java > /dev/null 2>&1 && echo "[OK] Java: $$(java -version 2>&1 | head -n 1)" || (echo "[FAIL] Java 21+ not found" && exit 1)
	@which mvn > /dev/null 2>&1 && echo "[OK] Maven: $$(mvn -version | head -n 1)" || (echo "[FAIL] Maven not found" && exit 1)
	@which node > /dev/null 2>&1 && echo "[OK] Node.js: $$(node -v)" || (echo "[FAIL] Node.js not found" && exit 1)
	@which npm > /dev/null 2>&1 && echo "[OK] npm: $$(npm -v)" || (echo "[FAIL] npm not found" && exit 1)
	@which blender > /dev/null 2>&1 && echo "[OK] Blender: $$(blender --version | head -n 1)" || (echo "[WARN] Blender not found in PATH; headless execution will fail until installed")

build:
	@echo "=== Building Backend ==="
	cd backend && mvn clean package -DskipTests
	@echo "=== Building Frontend ==="
	cd frontend && npm run build

test:
	cd backend && mvn test

backend:
	cd backend && mvn spring-boot:run

frontend:
	cd frontend && npm run dev

dev:
	@./run.sh

clean:
	cd backend && mvn clean
	rm -rf frontend/.next frontend/out storage backend/storage
