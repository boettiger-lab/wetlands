#!/bin/bash

# Wetlands Application Startup Script
# Starts all required services for the wetlands data chatbot

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting Wetlands Application Services...${NC}"

# Check if environment variables are set
if [ -z "$NRP_API_KEY" ]; then
    echo "ERROR: NRP_API_KEY environment variable not set"
    echo "Please run: export NRP_API_KEY='your-api-key-here'"
    exit 1
fi

if [ -z "$LLM_ENDPOINT" ]; then
    echo "WARNING: LLM_ENDPOINT not set, using default OpenAI endpoint"
    export LLM_ENDPOINT="https://api.openai.com/v1/chat/completions"
fi

# Install Python dependencies if needed
if ! python3 -c "import fastapi" 2>/dev/null; then
    echo -e "${BLUE}Installing Python dependencies...${NC}"
    pip install -q fastapi uvicorn httpx
fi

# Change to project directory
cd "$(dirname "$0")"

# Start services
echo -e "${GREEN}Starting HTTP server on port 8000...${NC}"
cd maplibre
python3 -m http.server 8000 &
HTTP_PID=$!
cd ..

echo -e "${GREEN}Starting MCP server on port 8001...${NC}"
cd mcp
uvx mcp-server-motherduck --port 8001 &
MCP_PID=$!
cd ..

echo -e "${GREEN}Starting LLM proxy on port 8002...${NC}"
cd app
python3 llm_proxy.py &
PROXY_PID=$!
cd ..

# Save PIDs for cleanup
echo $HTTP_PID > .http.pid
echo $MCP_PID > .mcp.pid
echo $PROXY_PID > .proxy.pid

echo ""
echo -e "${GREEN}✓ All services started!${NC}"
echo ""
echo "Services running:"
echo "  • HTTP Server: http://localhost:8000 (PID: $HTTP_PID)"
echo "  • MCP Server:  http://localhost:8001 (PID: $MCP_PID)"
echo "  • LLM Proxy:   http://localhost:8002 (PID: $PROXY_PID)"
echo ""
echo "Open http://localhost:8000 in your browser"
echo ""
echo "To stop all services, run: ./stop.sh"
