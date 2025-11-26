# Wetlands MCP Server

This directory contains configuration and deployment resources for the MotherDuck MCP server, which provides SQL query access to wetlands data stored in MinIO/S3.

## Data Sources

- **Wetlands Data**: `s3://public-wetlands/hex/**` (GeoParquet files)
- **Species Richness**: `https://minio.carlboettiger.info/public-mobi/hex/all-richness-h8.parquet`
- **Social Vulnerability**: `https://minio.carlboettiger.info/public-social-vulnerability/2022-tracts-h3-z8.parquet`
- **S3 Endpoint**: `minio.carlboettiger.info` (custom MinIO endpoint)

## MCP Server Deployment

### Local Development

**Start all services:**

```bash
./start.sh --local
```

This starts:
- HTTP server (port 8000) - serves the frontend
- MCP server (port 8001) - mcp-server-motherduck with SSE transport
- MCP proxy (port 8010) - CORS-enabled proxy to MCP server (local development only)
- LLM proxy (port 8011) - proxy to OpenAI/Anthropic APIs

**Why the proxy?** The MCP proxy is required for **local development only** to handle CORS (Cross-Origin Resource Sharing) restrictions. Web browsers block JavaScript from making requests to `localhost:8001` from a page served from `localhost:8000`. The proxy on port 8010 adds the necessary CORS headers. In production (Kubernetes), the ingress controller handles this, so no proxy is needed.

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

### Local Development (with proxy)
```
Browser → http://localhost:8000 (frontend)
       → http://localhost:8010/mcp (proxy with CORS) 
       → http://localhost:8001/sse (MCP server)
```

### Production/Kubernetes (no proxy needed)
```
Browser → https://biodiversity-mcp.nrp-nautilus.io/sse (ingress with CORS)
       → ClusterIP Service
       → MCP Server Pod
```

The proxy (`app/mcp_proxy.py`) serves two purposes in local development:
1. **CORS handling** - Adds necessary headers for browser access
2. **SSE protocol translation** - Manages the SSE session with the MCP server

## Example SQL Usage

```sql
-- Set up the custom S3 endpoint
CREATE OR REPLACE SECRET s3 (
    TYPE S3,
    ENDPOINT 'minio.carlboettiger.info',
    URL_STYLE 'path'
);

-- Query wetlands data
SELECT * FROM read_parquet('s3://public-wetlands/hex/**') LIMIT 10;

-- Join wetlands with species richness
SELECT 
    w.*,
    s.richness
FROM read_parquet('s3://public-wetlands/hex/**') w
JOIN read_parquet('https://minio.carlboettiger.info/public-mobi/hex/all-richness-h8.parquet') s
ON w.h8 = s.h8
LIMIT 10;
```
