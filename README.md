# Wetlands Interactive Map & AI Assistant

An experimental web application combining interactive geospatial visualization with AI-powered data analysis. The application features a MapLibre GL-based map displaying global wetlands datasets, integrated with a chatbot assistant that can query databases, analyze spatial data, and dynamically control map layers.

**Live Demo:** https://wetlands.nrp-nautilus.io

This project emphasizes the capabilities of **open-source LLMs** when combined with carefully scoped tool use, demonstrating that specialized AI assistants can be built without relying on proprietary models.

## Features

- **Interactive Global Wetlands Map**
  - Global Lakes and Wetlands Database (GLWD) - raster COG
  - Vulnerable Carbon Storage - raster COG
  - Nature's Contributions to People (NCP) - raster COG
  - Ramsar Wetlands of International Importance - PMTiles vector polygons
  - World Database on Protected Areas (WDPA) - PMTiles vector polygons
  - HydroBASINS Level 6 Watersheds - PMTiles vector polygons

- **AI Chatbot Assistant** with specialized tools:
  - Natural language queries about wetlands data
  - SQL analysis via Model Context Protocol (MCP) server using DuckDB on cloud-hosted GeoParquet files
  - Dynamic map layer control (show/hide, filter, style)
  - Multi-dataset analysis across wetlands, protected areas, carbon storage, and biodiversity

- **Open Source LLM Support** - Configured to work with multiple open-source models:
  - GLM-4.6 (Zhipu AI)
  - GPT-OSS (Open Source GPT variant)
  - Qwen3 (Alibaba Cloud)
  - GLM-V (Multimodal vision model)
  - Kimi (Moonshot AI)

## Architecture

The application consists of four main components deployed on Kubernetes:

1. **Static Frontend** (`maplibre/`) - MapLibre GL map + chatbot UI served via nginx
2. **MCP Server** (`mcp/`) - Model Context Protocol server providing SQL query tools for wetlands database access
3. **LLM Proxy** (`llm_proxy/`) - Secure proxy for LLM API requests (handles API keys and CORS)
4. **LLM Deployments** - Optional on-cluster LLM inference servers

```
┌─────────────────┐      ┌──────────────┐      ┌─────────────┐
│  Static Site    │─────▶│  LLM Proxy   │─────▶│ LLM APIs    │
│  (Frontend)     │      │              │      │ (Open/Cloud)│
└────────┬────────┘      └──────────────┘      └─────────────┘
         │
         │ SSE
         ▼
┌─────────────────┐      ┌──────────────┐
│  MCP Server     │─────▶│ DuckDB       │
│  (Tools)        │      │ + MinIO/S3   │
└─────────────────┘      └──────────────┘
```

## Quick Start

### Local Development

```bash
# Clone the repository
git clone https://github.com/boettiger-lab/wetlands.git
cd wetlands

# Start all services (uses hosted MCP server by default)
./start.sh
```

This starts:
- Frontend HTTP server on port 8000
- LLM proxy on port 8011 (required for CORS)

Open your browser to `http://localhost:8000/maplibre/`

**Note:** By default, the application connects to the hosted MCP server at `https://biodiversity-mcp.nrp-nautilus.io/sse`. For local MCP development, use:

```bash
./start.sh --local-mcp
```

This additionally starts:
- MCP server on port 8001
- MCP proxy on port 8010 (CORS wrapper)

## Configuration

### LLM Models

The application can be configured to use different LLM providers. Edit `maplibre/config.json`:

```json
{
    "mcp_server_url": "https://biodiversity-mcp.nrp-nautilus.io/sse",
    "llm_model": "kimi",
    "llm_models": [
        {
            "value": "your-model-id",
            "label": "Display Name",
            "endpoint": "https://your-llm-endpoint.com/v1",
            "api_key": "EMPTY"
        }
    ]
}
```

**Supported OpenAI-Compatible Endpoints:**

- Any OpenAI-compatible API

**API Key Management:**
- For local development: Set `api_key` directly in `config.json` (never commit!)
- For production: Use `"api_key": "EMPTY"` and configure the LLM proxy with actual keys

### Environment-Specific Configuration

The frontend loads configuration at runtime from `config.json`, which can be templated with environment variables when deploying to Kubernetes. See `k8s/configmap-nginx.yaml` for the nginx configuration that performs substitution.

## Kubernetes Deployment

### Prerequisites

- Kubernetes cluster access
- `kubectl` configured
- Domain names and ingress controller

### 1. Deploy MCP Server

The MCP server provides SQL query tools for the chatbot.

```bash
cd mcp

# Create secrets for S3 credentials (if needed)
kubectl create secret generic mcp-secrets \
  --from-literal=s3-access-key='your-access-key' \
  --from-literal=s3-secret-key='your-secret-key'

# Deploy MCP server
kubectl apply -f mcp-server-deployment.yaml
kubectl apply -f mcp-server-service.yaml
kubectl apply -f mcp-server-ingress.yaml
```

**Endpoints:**
- SSE transport: `https://biodiversity-mcp.nrp-nautilus.io/sse`
- WebSocket transport: `wss://biodiversity-mcp.nrp-nautilus.io/ws`

See `mcp/README.md` for details.

### 2. Deploy LLM Proxy

The LLM proxy securely handles API keys and CORS for LLM requests.

```bash
cd llm_proxy

# Create secrets for LLM API keys
kubectl create secret generic llm-proxy-secrets \
  --from-literal=nrp-api-key='your-api-key' \
  --from-literal=openai-api-key='your-openai-key' \
  --from-literal=anthropic-api-key='your-anthropic-key'

# Deploy LLM proxy
kubectl apply -f configmap.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f ingress.yaml
```

**Endpoint:** `https://llm-proxy.nrp-nautilus.io/v1`

The proxy accepts OpenAI-compatible requests and routes them to the appropriate LLM provider based on the model name.

See `llm_proxy/README.md` for details.

### 3. Deploy Static Site

The static site serves the MapLibre GL map and chatbot interface.

```bash
cd k8s

# Create ConfigMap with nginx configuration
kubectl apply -f configmap-nginx.yaml

# Deploy static site
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f ingress.yaml
```

**Endpoint:** `https://wetlands.nrp-nautilus.io`

The deployment uses an init container to clone the latest code from GitHub on each pod restart.

See `k8s/README.md` for details.

### 4. (Optional) Deploy LLM Inference Servers

For running open-source LLMs on-cluster, you can deploy inference servers using vLLM, Text Generation Inference (TGI), or similar frameworks. The LLM proxy can then route requests to these internal services.

Example deployment patterns are available in the various `deployment.yaml` files, which can be adapted for LLM serving.

## Project Structure

```
.
├── maplibre/           # Frontend application
│   ├── index.html      # Main application page
│   ├── map.js          # MapLibre GL map initialization
│   ├── chat.js         # Chatbot implementation with MCP client
│   ├── config.json     # LLM and MCP configuration
│   └── system-prompt.md # Chatbot system prompt
│
├── mcp/                # Model Context Protocol server
│   ├── mcp-server-deployment.yaml
│   ├── mcp-server-service.yaml
│   ├── mcp-server-ingress.yaml
│   └── README.md
│
├── llm_proxy/          # LLM API proxy
│   ├── llm_proxy.py    # FastAPI proxy server
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   └── README.md
│
├── k8s/                # Static site deployment
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── configmap-nginx.yaml
│   └── README.md
│
├── reports/            # Analysis notebooks and reports
├── start.sh            # Local development startup script
└── stop.sh             # Local development cleanup script
```

## Data Sources

The application provides access to these global datasets via the MCP server:

- **Global Lakes and Wetlands Database (GLWD)** - H3-indexed at resolution 8
- **Vulnerable Carbon Storage** (Conservation International) - H3-indexed
- **Nature's Contributions to People** - Biodiversity importance scores
- **Ramsar Sites** - Wetlands of International Importance
- **World Database on Protected Areas (WDPA)** - IUCN protected areas
- **HydroBASINS** - Level 6 watershed boundaries
- **Overture Maps** - Country and region boundaries (H3-indexed)
- **iNaturalist** - Species occurrence data (H3-indexed)

All spatial data is pre-indexed using H3 hexagons and stored as GeoParquet on MinIO S3-compatible storage for efficient cloud-native querying with DuckDB.

## Development

### Running Tests

```bash
cd tests
pip install -r requirements.txt
pytest
```

### Adding New LLM Models

1. Add model configuration to `maplibre/config.json`
2. Update LLM proxy routing in `llm_proxy/llm_proxy.py` if using custom endpoints
3. Test with different models using the dropdown in the UI

### Adding New Tools

MCP tools are defined in the MCP server deployment. To add custom analysis capabilities:

1. Extend the MCP server implementation (currently using `mcp-server-motherduck`)
2. Update the chatbot's system prompt in `maplibre/system-prompt.md` to describe new tools
3. Redeploy the MCP server

## Contributing

This is an experimental project and we welcome:

- 🐛 Bug reports
- 💡 Feature suggestions
- 🔧 Pull requests
- 📊 Example analyses and use cases

Please open an issue to discuss before submitting major changes.

## License


Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

## Acknowledgments

- Built with [MapLibre GL JS](https://maplibre.org/)
- Powered by [DuckDB](https://duckdb.org/) for spatial analysis
- Uses [Model Context Protocol](https://modelcontextprotocol.io/) for LLM-tool integration
- Deployed on [National Research Platform](https://nationalresearchplatform.org/)
- Data from GLWD, Ramsar Convention, WDPA, HydroBASINS, Conservation International, and others
