#!/bin/bash

# Stop all wetlands application services

# Colors for output
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${RED}Stopping Wetlands Application Services...${NC}"

cd "$(dirname "$0")"

# Stop services using saved PIDs
if [ -f .http.pid ]; then
    kill $(cat .http.pid) 2>/dev/null || true
    rm .http.pid
    echo "Stopped HTTP server"
fi

if [ -f .mcp.pid ]; then
    kill $(cat .mcp.pid) 2>/dev/null || true
    rm .mcp.pid
    echo "Stopped MCP server"
fi

if [ -f .proxy.pid ]; then
    kill $(cat .proxy.pid) 2>/dev/null || true
    rm .proxy.pid
    echo "Stopped LLM proxy"
fi

echo "All services stopped"
