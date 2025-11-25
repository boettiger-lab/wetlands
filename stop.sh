#!/bin/bash

# Stop all wetlands application services

# Colors for output
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${RED}Stopping Wetlands Application Services...${NC}"

cd "$(dirname "$0")"

# Stop HTTP server
if [ -f .http.pid ]; then
    PID=$(cat .http.pid)
    if kill -0 $PID 2>/dev/null; then
        kill $PID 2>/dev/null || kill -9 $PID 2>/dev/null
        echo "Stopped HTTP server (PID: $PID)"
    else
        echo "HTTP server process not running (PID: $PID)"
    fi
    rm .http.pid
fi

# Stop MCP server
if [ -f .mcp.pid ]; then
    PID=$(cat .mcp.pid)
    if kill -0 $PID 2>/dev/null; then
        kill $PID 2>/dev/null || kill -9 $PID 2>/dev/null
        echo "Stopped MCP server (PID: $PID)"
    else
        echo "MCP server process not running (PID: $PID)"
    fi
    rm .mcp.pid
fi

# Extra: kill any lingering processes on ports 8000/8001
lsof -ti :8000 | xargs -r kill -9 2>/dev/null && echo "Force killed any process on port 8000"
lsof -ti :8001 | xargs -r kill -9 2>/dev/null && echo "Force killed any process on port 8001"

echo "All services stopped"
