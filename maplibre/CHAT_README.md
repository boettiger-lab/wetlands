# Wetlands Chatbot Setup

## Prerequisites

1. **MCP Server running** - See `../mcp/README.md`
2. **OpenAI-compatible LLM access** - API endpoint and key
3. **Web server** - To serve the MapLibre app

## Quick Start

### 1. Start the MCP Server

```bash
cd /home/cboettig/Documents/github/boettiger-lab/wetlands/mcp
uvx mcp-server-motherduck --transport stream --port 8001 --host 127.0.0.1 --db-path :memory: --json-response
```

### 2. Start the Web Server

```bash
cd /home/cboettig/Documents/github/boettiger-lab/wetlands/maplibre
python3 -m http.server 8000
```

### 3. Configure LLM Credentials

When you first open the app at `http://localhost:8000`, you'll be prompted to enter:

- **LLM Endpoint**: e.g., `https://api.openai.com/v1/chat/completions`
- **API Key**: Your OpenAI (or compatible) API key

Alternatively, edit `../mcp/config.json` and set:
```json
{
  "llm_endpoint": "https://api.openai.com/v1/chat/completions",
  "llm_api_key": "sk-...",
  "llm_model": "gpt-4"
}
```

## Supported LLM Providers

Any OpenAI-compatible API:
- **OpenAI**: `https://api.openai.com/v1/chat/completions`
- **Azure OpenAI**: `https://YOUR_RESOURCE.openai.azure.com/openai/deployments/YOUR_DEPLOYMENT/chat/completions?api-version=2024-02-15-preview`
- **Anthropic (via proxy)**: Use an OpenAI-compatible wrapper
- **Local models (e.g., Ollama with litellm)**: `http://localhost:4000/v1/chat/completions`

## Architecture

```
User Browser
  ↓ (user question)
chat.js
  ↓ (OpenAI API call with tools)
LLM (GPT-4, etc.)
  ↓ (function call: query_wetlands_data)
chat.js
  ↓ (MCP JSON-RPC)
MCP Server (localhost:8001)
  ↓ (DuckDB SQL)
MinIO S3 (GeoParquet data)
  ↓ (query results)
LLM (interprets results)
  ↓ (natural language response)
User
```

## Example Queries

Try asking the chatbot:

- "How many different types of wetlands are there?"
- "What percentage of wetlands are peatlands?"
- "Which wetland types have the highest species diversity?"
- "Show me the top 5 wetland types by area"
- "How many freshwater lakes are in the database?"
- "Compare coastal wetlands vs inland wetlands"

## Troubleshooting

### Chat button doesn't appear
- Check browser console for errors
- Ensure `chat.css` and `chat.js` are loaded
- Verify the web server is serving all files

### "MCP server error"
- Ensure MCP server is running on port 8001
- Check `http://localhost:8001/mcp` in browser (should return 404 for GET, but server should be up)
- Review MCP server logs for errors

### "LLM API error"
- Verify API endpoint URL is correct
- Check API key is valid
- Ensure you have credits/quota available
- Check CORS if using a remote LLM

### Queries return no data
- Verify MCP server can access MinIO (check server logs)
- Test query manually with `test_mcp.py`
- Check network connectivity to `minio.carlboettiger.info`

## Development

To modify the chatbot:

1. **UI changes**: Edit `chat.css`
2. **Behavior changes**: Edit `chat.js`
3. **System prompt**: Edit `system-prompt.md`
4. **Data context**: Edit `../mcp/data-dictionary.md`

The chatbot will automatically reload the system prompt on initialization.
