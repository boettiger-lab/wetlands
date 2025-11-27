# Wetlands Data Chatbot - Complete

## ✅ What's Been Built

### 1. MCP Server Infrastructure (`/mcp/`)
- **MCP Server**: Running MotherDuck's DuckDB MCP server with custom S3 endpoint
- **Data Dictionary** (`data-dictionary.md`): Complete schema documentation
- **System Prompt** (`system-prompt.md`): LLM instructions with wetland codes 0-33
- **Configuration** (`config.json`): Server URLs, dataset metadata, wetland type lookup
- **Test Script** (`test_mcp.py`): Python script to verify MCP functionality

### 2. Web Chatbot UI (`/maplibre/`)
- **Chat Interface** (`chat.css`): Glass-morphism styled chat UI
- **Chat Logic** (`chat.js`): LangChain-style integration with OpenAI-compatible LLMs
- **HTML Integration**: Chat widget added to MapLibre app
- **Documentation** (`CHAT_README.md`): Setup and usage instructions

## 🚀 Current Status

**Running Services:**
- ✅ MCP Server: `http://localhost:8001/mcp`
- ✅ Web Server: `http://localhost:8000`
- ✅ MapLibre App: Map with wetlands layer + chat interface

## 🧪 How to Test

### 1. Open the App
Navigate to: **http://localhost:8000**

### 2. Configure LLM (First Time Only)
You'll be prompted for:
- LLM Endpoint (e.g., `https://api.openai.com/v1/chat/completions`)
- API Key

### 3. Ask Questions
Try these example queries:

**Data exploration:**
- "How many wetland types are there in the database?"
- "What are the different categories of wetlands?"

**Analysis:**
- "Which wetland types cover the most area?"
- "How many peatlands are there?"
- "Show me wetlands with the highest biodiversity"

**Joins:**
- "Compare species richness in coastal vs inland wetlands"
- "Which wetland types have the most species?"

## 📊 Data Flow

```
User Question
    ↓
JavaScript Chat UI (chat.js)
    ↓
OpenAI-compatible LLM API
    ↓ (LLM decides to call function: query_wetlands_data)
JavaScript Chat UI
    ↓ (JSON-RPC to MCP server)
MCP Server (localhost:8001)
    ↓ (DuckDB SQL query)
MinIO S3 (minio.carlboettiger.info)
    ↓ (GeoParquet data: wetlands, species, SVI)
SQL Results
    ↓ (back to LLM for interpretation)
LLM
    ↓ (natural language answer)
User sees response in chat
```

## 🔑 Key Files

| File | Purpose |
|------|---------|
| `/mcp/config.json` | MCP URL, LLM credentials, dataset metadata |
| `/maplibre/system-prompt.md` | LLM instructions (wetland codes, SQL patterns) |
| `/mcp/data-dictionary.md` | Complete data schema documentation |
| `/maplibre/chat.js` | Chatbot implementation |
| `/maplibre/chat.css` | Chat UI styling |
| `/maplibre/index.html` | Main app (includes chat) |

## 🐛 Known Issues & TODOs

**Current Limitations:**
1. LLM credentials requested via `prompt()` - not ideal UX
2. No persistent conversation history (resets on refresh)
3. Only tested with localhost - needs CORS for production
4. System prompt loaded async - might not be ready for first query

**Next Steps:**
1. Add loading states and better error handling
2. Store LLM config in localStorage
3. Add conversation export/import
4. Create Kubernetes deployment for MCP server
5. Add authentication for production deployment

## 🎯 Wetland Type Reference

The system knows 34 wetland types (codes 0-33):

- **0**: No data
- **1-5**: Open Water (lakes, rivers, reservoirs)
- **6-12**: Coastal & Other (lagoons, deltas, mangroves)
- **13-15**: Palustrine Wetlands (marshes, swamps)
- **16-18**: Riverine Wetlands (floodplains, oxbows)
- **19-20**: Lacustrine Wetlands (lake fringes)
- **21-23**: Ephemeral Wetlands (seasonal)
- **24-31**: Peatlands (bogs, fens, tundra)
- **32-33**: Complex/Unknown

Full details in `/mcp/data-dictionary.md`

## 🌐 Production Deployment (Future)

For K8s deployment, you'll need to:
1. Build MCP server Docker image
2. Deploy to `espm-157` namespace
3. Expose via Ingress with SSL
4. Update `config.json` with public URL
5. Add authentication/rate limiting

Ready to proceed with K8s config when you are!
