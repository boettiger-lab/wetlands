# Wetlands MapLibre Application

An interactive web application combining MapLibre GL JS for geospatial visualization with an AI-powered chatbot that can analyze wetlands data and control map layers.

## Features

- **Interactive Map** with multiple global wetlands datasets:
  - Global Wetlands Database (GLWD) - raster COG
  - Nature's Contributions to People (NCP) - raster COG  
  - Vulnerable Carbon Storage - raster COG
  - Ramsar Wetlands of International Importance - PMTiles polygons
  - World Database on Protected Areas (WDPA) - PMTiles polygons
  - HydroBASINS Level 6 Watersheds - PMTiles polygons

- **AI Chatbot** powered by LLM + Model Context Protocol (MCP):
  - Natural language queries about wetlands data
  - Statistical analysis using DuckDB on GeoParquet files
  - Dynamic map layer control

- **Chatbot-Controlled Map Layers** - The chatbot can show/hide map layers based on analysis context

## Quick Start

### 1. Start the MCP Server

The chatbot requires an MCP server to access the wetlands database:

```bash
cd ../mcp
uvx mcp-server-motherduck --transport stream --port 8001 --host 127.0.0.1 --db-path :memory: --json-response
```

See `../mcp/README.md` for details.

### 2. Start the Web Server

```bash
cd maplibre
python3 -m http.server 8000
```

### 3. Open in Browser

Navigate to `http://localhost:8000`


```

## Example Chatbot Queries

- "How many different types of wetlands are there?"
- "What's the total area of peatlands globally?"
- "Which countries have the most wetlands?"
- "Show me wetlands with high carbon storage" (controls map layers!)
- "Compare protected vs unprotected wetlands"

## Chatbot Map Control

### How It Works

The chatbot can dynamically control which map layers are visible by updating a configuration file. This enables context-aware visualization - for example, when analyzing carbon storage, the chatbot can automatically show the carbon and wetlands layers.

### Architecture

```
User asks question
       ↓
Chatbot analyzes via MCP/DuckDB
       ↓
Generates layer-config.json
       ↓
Writes to S3: s3://public-outputs/wetlands/layer-config.json
       ↓
Map polls config every 2 seconds
       ↓
Detects change → Updates layer visibility
       ↓
User sees updated map
```

### Configuration Format

The `layer-config.json` file uses a simple JSON structure:

```json
{
  "layers": {
    "wetlands-layer": { "visible": true },
    "ncp-layer": { "visible": false },
    "carbon-layer": { "visible": true },
    "ramsar-layer": { "visible": false },
    "wdpa-layer": { "visible": false },
    "hydrobasins-layer": { "visible": false }
  }
}
```

### User vs Chatbot Control Priority

The system uses a **smart priority system** to handle conflicts:

1. **Config Controls Initially**
   - Map loads with layer visibility from config
   - Checkboxes sync to match config
   - Config polls every 2 seconds for changes

2. **User Clicks = User Takes Control**
   - User clicks a checkbox → immediate change
   - That layer is marked as "user-overridden"
   - Subsequent config polls skip overridden layers
   - User's choice persists until config changes

3. **Config Update = Chatbot Regains Control**
   - When config **content** changes (not just polls)
   - All user overrides are cleared
   - New config applies to all layers
   - Checkboxes sync to new config

**Example Timeline:**

```
0s:  Page loads, config shows wetlands=ON
     → Wetlands visible

5s:  User clicks carbon checkbox ON
     → userOverrides['carbon-layer'] = true
     → Carbon appears immediately

7s-15s: Config polls (no content change)
        → Carbon stays ON (user override active)

16s: Chatbot updates config: wetlands=ON, carbon=ON, hydrobasins=ON
     → userOverrides = {} (cleared)
     → All three layers appear
     → Chatbot regains full control
```

This provides a clean handoff: users can explore freely, but when the chatbot sends new instructions, they take full effect.

### Implementation Details

**Config Location:**
- Production: `https://minio.carlboettiger.info/public-outputs/wetlands/layer-config.json`
- Local testing: `layer-config.json` (change `CONFIG_URL` in `map.js`)

**Polling Mechanism:**
- Fetches config every 2 seconds
- Uses checksum to detect actual changes
- Only applies updates when content changes (efficient)

**User Override Tracking:**
```javascript
let userOverrides = {};  // Tracks user-modified layers

// On checkbox click
userOverrides['wetlands-layer'] = true;

// On config apply - skip overridden layers
if (userOverrides[layerId] !== undefined) {
    return;  // Skip - user is in control
}

// On config change - reset everything
if (newChecksum !== configChecksum) {
    userOverrides = {};  // Config wins
}
```

### Generating Configs from Python

Use the included script to upload configs to S3:

```bash
python upload_config_to_s3.py
```

This demonstrates how the MCP server can generate configs based on analysis results.

### Future Extensions

The config format is designed to support (not yet implemented):

- **Layer Filtering** - Show only specific polygons by ID
  ```json
  "filter": ["in", "PFAF_ID", "6010001", "6010002"]
  ```

- **Data-Driven Styling** - Color polygons by attribute
  ```json
  "colorBy": {
    "property": "priority_score",
    "stops": [[0, "#fee5d9"], [0.5, "#fc9272"], [1, "#de2d26"]]
  }
  ```

- **External Data Join** - Load scores from CSV and join to polygons
  ```json
  "dataUrl": "https://minio.carlboettiger.info/.../basin-scores.csv",
  "joinOn": {"layer": "PFAF_ID", "data": "basin_id"}
  ```

## File Structure

```
maplibre/
├── index.html              # Main HTML page
├── map.js                  # MapLibre map setup and layer control
├── chat.js                 # Chatbot UI and MCP integration
├── chat.css                # Chatbot styling
├── style.css               # Map styling
├── config.json             # LLM configuration
├── layer-config.json       # Layer visibility config (local)
├── wetland-colormap.json   # GLWD wetland type colors
├── category_codes.csv      # Wetland type descriptions
├── system-prompt.md        # Chatbot system prompt
└── upload_config_to_s3.py  # Utility to upload configs to S3
```

## Data Sources

All data is served from MinIO S3-compatible storage:

- **GLWD v2.0**: Global Lakes and Wetlands Database
- **NCP**: Nature's Contributions to People (biodiversity importance)
- **Carbon**: Irrecoverable Carbon (Conservation International 2018)
- **Ramsar**: Ramsar Sites Information Service
- **WDPA**: World Database on Protected Areas
- **HydroBASINS**: Level 6 watershed boundaries

Data is stored as:
- **COG** (Cloud-Optimized GeoTIFF) for raster layers
- **PMTiles** for vector polygon layers
- **GeoParquet** for tabular data accessed via MCP/DuckDB

## Supported LLM Providers

Any OpenAI-compatible API:
- **OpenAI**: `https://api.openai.com/v1/chat/completions`
- **Local models** (e.g., Ollama with litellm): `http://localhost:4000/v1/chat/completions`


## Development

### Local Testing of Config System

1. Edit `map.js` to use local config:
   ```javascript
   const CONFIG_URL = 'layer-config.json';
   ```

2. Manually edit `layer-config.json`

3. Refresh browser - changes should apply within 2 seconds

### Debugging

Open browser console to see:
- Config loading and changes
- Layer visibility updates
- User override tracking
- MCP communication

## License

See main project README for licensing information.
