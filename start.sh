#!/bin/bash


# Wetlands Application Startup Script
# Starts all required services for the wetlands data chatbot
# Usage: ./start.sh [--local-mcp]

USE_LOCAL_MCP=false
if [[ "$1" == "--local-mcp" ]]; then
    USE_LOCAL_MCP=true
fi

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting Wetlands Application Services...${NC}"


# Check if environment variables are set
if [ -z "$NRP_API_KEY" ]; then
    echo "ERROR: NRP_API_KEY environment variable not set"
    echo "Please run: export NRP_API_KEY='your-api-key-here'"
    exit 1
fi

# Set MCP server URL
if [ "$USE_LOCAL_MCP" = true ]; then
    export MCP_SERVER_URL="http://localhost:8010/mcp"
    export MCP_SERVER_BASE_URL="http://localhost:8001"
    export MCP_TRANSPORT="sse"
    echo "INFO: Using local MCP server and proxy at $MCP_SERVER_URL"
else
    export MCP_SERVER_URL="https://biodiversity-mcp.nrp-nautilus.io/mcp"
    export MCP_SERVER_BASE_URL="https://biodiversity-mcp.nrp-nautilus.io"
    export MCP_TRANSPORT="sse"
    echo "INFO: Using hosted MCP server at $MCP_SERVER_URL"
fi

if [ -z "$LLM_ENDPOINT" ]; then
    # Try to read from maplibre/config.json
    LLM_ENDPOINT=$(python3 -c "import json; print(json.load(open('maplibre/config.json'))['llm_endpoint'])" 2>/dev/null)
    if [ -z "$LLM_ENDPOINT" ]; then
        echo "WARNING: LLM_ENDPOINT not set, using default"
        export LLM_ENDPOINT="https://api.glama.ai/v1/chat/completions"
    else
        echo "INFO: Using LLM_ENDPOINT from maplibre/config.json: $LLM_ENDPOINT"
        export LLM_ENDPOINT="$LLM_ENDPOINT"
    fi
fi


# Activate uv environment
if [ -d ".venv" ]; then
    echo -e "${BLUE}Activating uv Python environment...${NC}"
    source .venv/bin/activate
fi

# Change to project directory
cd "$(dirname "$0")"

# Start services

# Start HTTP server
echo -e "${GREEN}Starting HTTP server on port 8000...${NC}"
cd maplibre

# Create local config for testing (copies config.json and overrides llm_endpoint)
# NOTE: Frontend (chat.js) will use config.local.json if it exists, otherwise falls back to config.json
# This allows local testing with localhost:8011 proxy while keeping production config.json unchanged
cp config.json config.local.json
# Use Python to update just the llm_endpoint field
python3 -c "import json; c=json.load(open('config.json')); c['llm_endpoint']='http://localhost:8011/chat'; json.dump(c, open('config.local.json', 'w'), indent=2)"

nohup python3 -m http.server 8000 > ../http.log 2>&1 &
HTTP_PID=$!
sleep 1
if ! kill -0 $HTTP_PID 2>/dev/null; then
    echo -e "${RED}ERROR: HTTP server failed to start. See http.log for details.${NC}"
    exit 1
fi
cd ..


# Start MCP server and proxy only if --local-mcp is given
if [ "$USE_LOCAL_MCP" = true ]; then
    echo -e "${GREEN}Starting MCP server on port 8001...${NC}"
    cd mcp
    nohup uvx mcp-server-motherduck --port 8001 --db-path ../duck.db --transport sse > ../mcp.log 2>&1 &
    MCP_PID=$!
    sleep 2
    if ! kill -0 $MCP_PID 2>/dev/null; then
        echo -e "${RED}ERROR: MCP server failed to start. See mcp.log for details.${NC}"
        exit 1
    fi
    cd ..

    echo -e "${GREEN}Starting MCP proxy on port 8010...${NC}"
    nohup uv run uvicorn local_proxy.mcp_proxy:app --host 0.0.0.0 --port 8010 > mcp_proxy.log 2>&1 &
    MCP_PROXY_PID=$!
    sleep 2
    if ! kill -0 $MCP_PROXY_PID 2>/dev/null; then
        echo -e "${RED}ERROR: MCP proxy failed to start. See mcp_proxy.log for details.${NC}"
        exit 1
    fi
fi

# Always start LLM proxy locally (required for CORS when testing from localhost:8000)
echo -e "${GREEN}Starting LLM proxy on port 8011...${NC}"
nohup uv run uvicorn local_proxy.llm_proxy:app --host 0.0.0.0 --port 8011 > llm_proxy.log 2>&1 &
LLM_PROXY_PID=$!
sleep 2
if ! kill -0 $LLM_PROXY_PID 2>/dev/null; then
    echo -e "${RED}ERROR: LLM proxy failed to start. See llm_proxy.log for details.${NC}"
    exit 1
fi

# Save PIDs for cleanup

echo $HTTP_PID > .http.pid
echo $LLM_PROXY_PID > .llm_proxy.pid
if [ "$USE_LOCAL_MCP" = true ]; then
    echo $MCP_PID > .mcp.pid
    echo $MCP_PROXY_PID > .mcp_proxy.pid
fi

echo ""
echo -e "${GREEN}✓ All services started!${NC}"
echo ""
echo "Services running:"
echo "  • HTTP Server: http://localhost:8000 (PID: $HTTP_PID)"
echo "  • LLM Proxy:   http://localhost:8011 (PID: $LLM_PROXY_PID)"
if [ "$USE_LOCAL_MCP" = true ]; then
    echo "  • MCP Server:  http://localhost:8001 (PID: $MCP_PID)"
    echo "  • MCP Proxy:   http://localhost:8010 (PID: $MCP_PROXY_PID)"
else
    echo "  • MCP Server:  https://biodiversity-mcp.nrp-nautilus.io (hosted)"
fi
echo ""
echo "Open http://localhost:8000 in your browser"
echo ""
echo "To stop all services, run: ./stop.sh"
