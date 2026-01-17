# Wetlands MCP Server

This directory contains configuration and deployment resources for the MotherDuck MCP server, which provides SQL query access to wetlands data stored in MinIO/S3.

## Data Sources

- **Wetlands Data**: `s3://public-wetlands/hex/**` (GeoParquet files)
- **Species Richness**: `https://s3-west.nrp-nautilus.io/public-mobi/hex/all-richness-h8.parquet`
- **Social Vulnerability**: `https://s3-west.nrp-nautilus.io/public-social-vulnerability/2022-tracts-h3-z8.parquet`
- **S3 Endpoint**: `s3-west.nrp-nautilus.io` (custom MinIO endpoint)

## MCP Server Deployment

### Quick Start (Hosted MCP Server)

By default, the application uses the hosted MCP server:
- **URL**: `https://biodiversity-mcp.nrp-nautilus.io/sse`
- **Transport**: SSE (Server-Sent Events)
- No local MCP setup required - just run `./start.sh` from the project root

### Local MCP Development

To run the MCP server locally for development:

**Start all services with local MCP:**

```bash
./start.sh --local-mcp
```

This starts:
- HTTP server (port 8000) - serves the frontend
- LLM proxy (port 8011) - proxy to LLM APIs (always needed for CORS)
- MCP server (port 8001) - mcp-server-motherduck with SSE transport
- MCP proxy (port 8010) - CORS-enabled proxy to MCP server

**Why the MCP proxy?** The MCP proxy is required for **local MCP development only** to handle CORS (Cross-Origin Resource Sharing) restrictions. Web browsers block JavaScript from making requests to `localhost:8001` from a page served from `localhost:8000`. The proxy on port 8010 adds the necessary CORS headers. When using the hosted MCP server, the ingress controller handles CORS, so no local MCP proxy is needed.

**Test the MCP server:**

```bash
# Test via proxy (recommended)
curl -s http://localhost:8010/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "initialize", "id": 1, 
       "params": {"protocolVersion": "2024-11-05", "capabilities": {}, 
                  "clientInfo": {"name": "test", "version": "1.0"}}}' | jq .

# Test direct SSE endpoint (for debugging)
curl -N http://localhost:8001/sse
```

**Stop all services:**

```bash
./stop.sh
```

### Kubernetes Deployment

The Kubernetes deployment does not require the proxy since the ingress controller handles CORS.

- Deploy the MCP server:

  ```bash
  kubectl apply -f mcp-server-deployment.yaml
  kubectl apply -f mcp-server-service.yaml
  kubectl apply -f mcp-server-ingress.yaml
  ```

- The deployment uses SSE transport and mounts a persistent volume for `duck.db`.
- Access via: `https://biodiversity-mcp.nrp-nautilus.io/sse`

## Architecture Notes

### Default (Hosted MCP, Local LLM Proxy)
```
Browser → http://localhost:8000 (frontend)
       → http://localhost:8011/chat (local LLM proxy - for CORS)
       → https://biodiversity-mcp.nrp-nautilus.io/sse (hosted MCP - ingress handles CORS)
```

### Local MCP Development (--local-mcp flag)
```
Browser → http://localhost:8000 (frontend)
       → http://localhost:8011/chat (local LLM proxy - for CORS)
       → http://localhost:8010/mcp (local MCP proxy - for CORS) 
       → http://localhost:8001/sse (local MCP server)
```

### Production/GitHub Pages (all hosted)
```
Browser → https://boettiger-lab.github.io/wetlands (frontend)
       → https://llm-proxy.nrp-nautilus.io/chat (hosted LLM proxy)
       → https://biodiversity-mcp.nrp-nautilus.io/sse (hosted MCP - ingress handles CORS)
```

**Key Points:**
- **LLM Proxy**: Always needed locally for CORS when testing at `localhost:8000`
- **MCP Proxy** (`app/mcp_proxy.py`): Only needed for local MCP development
  1. **CORS handling** - Adds necessary headers for browser access
  2. **SSE protocol translation** - Manages the SSE session with the MCP server
- **Frontend SSE Implementation**: In production and default mode, `maplibre/chat.js` directly implements the SSE protocol to communicate with the remote MCP server

## Example SQL Usage

```sql
-- Set up the custom S3 endpoint
CREATE OR REPLACE SECRET s3 (
    TYPE S3,
    ENDPOINT 's3-west.nrp-nautilus.io',
    URL_STYLE 'path'
);

-- Query wetlands data
SELECT * FROM read_parquet('s3://public-wetlands/hex/**') LIMIT 10;

-- Join wetlands with species richness
SELECT 
    w.*,
    s.richness
FROM read_parquet('s3://public-wetlands/hex/**') w
JOIN read_parquet('https://s3-west.nrp-nautilus.io/public-mobi/hex/all-richness-h8.parquet') s
ON w.h8 = s.h8
LIMIT 10;
```
