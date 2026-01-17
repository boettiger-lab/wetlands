# VS Code Configuration for Wetlands MCP Server

This directory contains VS Code-specific configuration for connecting GitHub Copilot Chat to the remote wetlands biodiversity MCP server.

## Configuration Files

### `.vscode/settings.json`
Configures the MCP server connection:
- **Server**: `wetlands-biodiversity`
- **URL**: `https://biodiversity-mcp.nrp-nautilus.io/sse`
- **Transport**: SSE (Server-Sent Events)

This connects to the **remote** MCP server running on Kubernetes, which has:
- Fast network access to the S3/MinIO storage
- Powerful compute resources for complex queries
- Persistent DuckDB database cache

### `.github/copilot-instructions.md`
Contains domain-specific instructions for GitHub Copilot Chat:
- Wetlands data schema and available datasets
- H3 geospatial indexing details
- Wetland type codes (0-33)
- SQL query requirements and best practices
- Example queries

## How to Use

1. **Ensure VS Code has the MCP extension enabled**
   - The MCP configuration in `settings.json` will automatically connect to the remote server

2. **Open GitHub Copilot Chat**
   - Press `Ctrl+Shift+I` (or `Cmd+Shift+I` on Mac)
   - Or click the chat icon in the activity bar

3. **Ask wetlands questions**
   - "How many hectares of peatlands are there globally?"
   - "What countries have the most mangrove coverage?"
   - "Find wetlands with high biodiversity in California"

4. **Copilot will automatically**:
   - Use the custom instructions from `.github/copilot-instructions.md`
   - Call the `query` tool via the remote MCP server
   - Execute SQL queries on DuckDB with access to S3 data
   - Interpret and present results

## Available MCP Tools

The remote server provides these tools (via MotherDuck MCP server):
- `query` - Execute SQL queries against DuckDB
- `describe` - Get schema information about tables
- `list_tables` - List available tables/views

## Data Sources

All queries run on the remote MCP server with access to:
- **Global Wetlands**: `s3://public-wetlands/glwd/hex/**`
- **Vulnerable Carbon**: `s3://public-carbon/hex/vulnerable-carbon/**`
- **Country Polygons**: `s3://public-overturemaps/hex/countries.parquet`
- **USA Species Richness**: `https://s3-west.nrp-nautilus.io/public-mobi/hex/all-richness-h8.parquet`
- **USA Social Vulnerability**: `https://s3-west.nrp-nautilus.io/public-social-vulnerability/2022-tracts-h3-z8.parquet`

## Why Remote MCP Server?

The remote Kubernetes deployment provides:
- **Fast I/O**: Direct access to S3-compatible storage without internet latency
- **Parallel Processing**: 100+ threads for concurrent S3 reads
- **Persistent Cache**: DuckDB cache persists across queries
- **High Memory**: Handle large aggregations and joins
- **No Local Setup**: No need to install DuckDB or manage credentials

## Comparison with MapLibre Chat

Both VS Code Copilot and the MapLibre web chat use the **same** remote MCP server:

| Component | VS Code | MapLibre Web |
|-----------|---------|--------------|
| MCP Server | `https://biodiversity-mcp.nrp-nautilus.io/sse` | Same |
| Transport | SSE | SSE |
| Instructions | `.github/copilot-instructions.md` | `maplibre/system-prompt.md` |
| LLM | GitHub Copilot | Configured in `maplibre/config.json` |

## Troubleshooting

### MCP Server Not Connecting
- Check that `https://biodiversity-mcp.nrp-nautilus.io/sse` is accessible
- Verify VS Code MCP extension is installed and enabled
- Check VS Code output panel for MCP-related errors

### Queries Timing Out
- The ingress is configured with 10-minute timeouts for queries
- For very large aggregations, consider adding `LIMIT` clauses
- Check MCP server logs in Kubernetes if needed

### Custom Instructions Not Applied
- Ensure `.github/copilot-instructions.md` exists in the repo root
- Reload VS Code window (`Ctrl+Shift+P` → "Reload Window")
- Check that GitHub Copilot Chat is using workspace context

## Related Documentation

- MCP Server Deployment: `mcp/README.md`
- K8s Configuration: `mcp/mcp-server-*.yaml`
- Web Chat Implementation: `maplibre/chat.js`
- System Prompt: `maplibre/system-prompt.md`
