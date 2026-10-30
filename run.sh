#!/usr/bin/env bash
set -e

# ANSI Color Codes (Stark Terminal Palette)
RESET="\033[0m"
BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
ZINC="\033[90m"

# Load environment configuration from .env if present
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

echo -e "${BOLD}${GREEN}====================================================${RESET}"
echo -e "${BOLD}${GREEN}  KOSH // Minimalist Creative MCP Hub Bootloader    ${RESET}"
echo -e "${BOLD}${GREEN}====================================================${RESET}"

# 1. Dependency checks
echo -e "\n${BOLD}[1/4] Checking System Prerequisites...${RESET}"

if command -v java >/dev/null 2>&1; then
    JAVA_VER=$(java -version 2>&1 | head -n 1)
    echo -e "  ${GREEN}✓${RESET} Java: ${JAVA_VER}"
else
    echo -e "  ${RED}✗ Java 21+ is missing from PATH.${RESET}"
    exit 1
fi

if command -v mvn >/dev/null 2>&1; then
    MVN_VER=$(mvn -version 2>&1 | head -n 1)
    echo -e "  ${GREEN}✓${RESET} Maven: ${MVN_VER}"
else
    echo -e "  ${RED}✗ Maven is missing from PATH.${RESET}"
    exit 1
fi

if command -v node >/dev/null 2>&1; then
    NODE_VER=$(node -v)
    echo -e "  ${GREEN}✓${RESET} Node.js: ${NODE_VER}"
else
    echo -e "  ${RED}✗ Node.js 20+ is missing from PATH.${RESET}"
    exit 1
fi

if command -v blender >/dev/null 2>&1; then
    BLENDER_VER=$(blender --version 2>&1 | head -n 1)
    echo -e "  ${GREEN}✓${RESET} Blender: ${BLENDER_VER}"
else
    echo -e "  ${YELLOW}! Blender not found in PATH.${RESET}"
    echo -e "    ${ZINC}Install Blender LTS or ensure 'blender' executable is exported in PATH.${RESET}"
fi

# 2. Cleanup traps
cleanup() {
    echo -e "\n${YELLOW}[SHUTDOWN] Terminating Kosh processes...${RESET}"
    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ -n "$FRONTEND_PID" ]; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# 3. Boot Backend
echo -e "\n${BOLD}[2/4] Starting Spring Boot MCP Server on :8080...${RESET}"
cd backend
mvn spring-boot:run > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..
echo -e "  ${GREEN}✓${RESET} Backend spawned (PID: ${BACKEND_PID}). Streaming to backend.log"

# Wait for backend health endpoint
echo -e "  ${ZINC}Waiting for backend health check at http://localhost:8080/api/health...${RESET}"
MAX_RETRIES=30
RETRY_COUNT=0
HEALTHY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:8080/api/health >/dev/null 2>&1; then
        HEALTHY=true
        break
    fi
    sleep 1
    RETRY_COUNT=$((RETRY_COUNT + 1))
done

if [ "$HEALTHY" = true ]; then
    echo -e "  ${GREEN}✓${RESET} MCP Server is UP and listening on http://localhost:8080"
else
    echo -e "  ${YELLOW}! Backend still booting; check backend.log for progress${RESET}"
fi

# 4. Boot Frontend
echo -e "\n${BOLD}[3/4] Starting Next.js Terminal Studio on :3000...${RESET}"
cd frontend
if [ ! -d "node_modules" ]; then
    echo -e "  ${ZINC}node_modules missing. Running npm install...${RESET}"
    npm install
fi
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..
echo -e "  ${GREEN}✓${RESET} Frontend spawned (PID: ${FRONTEND_PID}). Streaming to frontend.log"

echo -e "\n${BOLD}[4/4] Kosh Studio Initialized Successfully${RESET}"
echo -e "  ${GREEN}●${RESET} Web Studio:  ${BOLD}http://localhost:3000${RESET}"
echo -e "  ${GREEN}●${RESET} MCP Endpoint: ${BOLD}http://localhost:8080/mcp${RESET}"
echo -e "  ${GREEN}●${RESET} Health Check: ${BOLD}http://localhost:8080/api/health${RESET}"
echo -e "\n${ZINC}Press Ctrl+C to terminate both servers.${RESET}\n"

# Wait indefinitely on child processes
wait $BACKEND_PID $FRONTEND_PID
