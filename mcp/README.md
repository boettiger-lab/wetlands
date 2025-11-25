# Wetlands MCP Server Configuration

This directory contains the configuration for the MotherDuck MCP server that provides SQL query access to wetlands data stored in MinIO/S3.

## Data Sources

- **Wetlands Data**: `s3://public-wetlands/hex/**` (GeoParquet files)
- **Species Richness**: `https://minio.carlboettiger.info/public-mobi/hex/all-richness-h8.parquet`
- **Social Vulnerability**: `https://minio.carlboettiger.info/public-social-vulnerability/2022-tracts-h3-z8.parquet`
- **S3 Endpoint**: `minio.carlboettiger.info` (custom MinIO endpoint)

## Setup

The MCP server uses DuckDB to query GeoParquet files directly from S3/MinIO storage.

### VS Code Configuration

Add to your VS Code settings (`.vscode/settings.json` or User Settings):

```json
{
  "mcp": {
    "servers": {
      "wetlands": {
        "command": "uvx",
        "args": [
          "mcp-server-motherduck",
          "--db-path",
          ":memory:"
        ]
      }
    }
  }
}
```

### Usage

Once configured, you can query the data using SQL:

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
