import asyncio
import time
from langchain_mcp_adapters.client import MultiServerMCPClient

QUERIES = {
    "Count wetlands by category": """
SET THREADS=100;
SET preserve_insertion_order=false;
SET enable_object_cache=true;
SET temp_directory='/tmp';
INSTALL httpfs; LOAD httpfs;
INSTALL h3 FROM community; LOAD h3;
CREATE OR REPLACE SECRET s3 (TYPE S3, ENDPOINT 'rook-ceph-rgw-nautiluss3.rook', 
    URL_STYLE 'path', USE_SSL 'false', KEY_ID '', SECRET '');
CREATE OR REPLACE SECRET outputs (
    TYPE S3, ENDPOINT 'minio.carlboettiger.info',
    URL_STYLE 'path', SCOPE 's3://public-outputs'
);

SELECT c.category, COUNT(*) as hex_count,
    ROUND(hex_count * 73.7327598, 2) as area_hectares
FROM read_parquet('s3://public-wetlands/glwd/hex/**') w
JOIN read_csv('s3://public-wetlands/glwd/category_codes.csv') c ON w.Z = c.Z
WHERE w.Z > 0 GROUP BY c.category ORDER BY area_hectares DESC;
""",
    "Carbon in India's wetlands": """
SET THREADS=100;
SET preserve_insertion_order=false;
SET enable_object_cache=true;
SET temp_directory='/tmp';
INSTALL httpfs; LOAD httpfs;
INSTALL h3 FROM community; LOAD h3;
CREATE OR REPLACE SECRET s3 (TYPE S3, ENDPOINT 'rook-ceph-rgw-nautiluss3.rook', 
    URL_STYLE 'path', USE_SSL 'false', KEY_ID '', SECRET '');
CREATE OR REPLACE SECRET outputs (
    TYPE S3, ENDPOINT 'minio.carlboettiger.info',
    URL_STYLE 'path', SCOPE 's3://public-outputs'
);

SELECT c.name, COUNT(*) as hex_count, ROUND(SUM(carb.carbon), 2) as total_carbon
FROM read_parquet('s3://public-overturemaps/hex/countries.parquet') ctry
JOIN read_parquet('s3://public-wetlands/glwd/hex/**') w ON ctry.h8 = w.h8 AND ctry.h0 = w.h0
JOIN read_parquet('s3://public-carbon/hex/vulnerable-carbon/**') carb ON w.h8 = carb.h8 AND w.h0 = carb.h0
JOIN read_csv('s3://public-wetlands/glwd/category_codes.csv') c ON w.Z = c.Z
WHERE ctry.country = 'IN' GROUP BY c.name ORDER BY total_carbon DESC;
""",
    "Bird species in Costa Rica forested wetlands": """
SET THREADS=100;
SET preserve_insertion_order=false;
SET enable_object_cache=true;
SET temp_directory='/tmp';
INSTALL httpfs; LOAD httpfs;
INSTALL h3 FROM community; LOAD h3;
CREATE OR REPLACE SECRET s3 (TYPE S3, ENDPOINT 'rook-ceph-rgw-nautiluss3.rook', 
    URL_STYLE 'path', USE_SSL 'false', KEY_ID '', SECRET '');
CREATE OR REPLACE SECRET outputs (
    TYPE S3, ENDPOINT 'minio.carlboettiger.info',
    URL_STYLE 'path', SCOPE 's3://public-outputs'
);

COPY (
  SELECT 
      t.scientificName,
      t.vernacularName as common_name,
      t.family,
      t.order,
      COUNT(DISTINCT w.h8) as wetland_hexagons,
      ROUND(COUNT(DISTINCT w.h8) * 73.7327598, 2) as area_hectares
  FROM read_parquet('s3://public-overturemaps/hex/countries.parquet') c
  JOIN read_parquet('s3://public-wetlands/glwd/hex/**') w 
      ON c.h8 = w.h8 AND c.h0 = w.h0
  JOIN read_parquet('s3://public-inat/range-maps/hex/**') pos 
      ON h3_cell_to_parent(w.h8, 4) = pos.h4 AND w.h0 = pos.h0
  JOIN read_parquet('s3://public-inat/taxonomy/taxa_and_common.parquet') t
      ON pos.taxon_id = t.id
  WHERE c.country = 'CR'
  AND w.Z IN (8, 10, 12, 14, 16, 18, 20, 22, 24, 26)
  AND t.class = 'Aves'
  AND pos.rank = 'species'
  GROUP BY t.scientificName, t.vernacularName, t.family, t.order
  ORDER BY wetland_hexagons DESC
) TO 's3://public-outputs/wetlands/cr_forested_wetland_birds.csv'
(FORMAT CSV, HEADER, OVERWRITE_OR_IGNORE);
"""
}

async def benchmark():
    print("🔌 Connecting to MCP Server...")
    client = MultiServerMCPClient({
        "my-server": {
            "url": "https://biodiversity-mcp.nrp-nautilus.io/sse",
            "transport": "sse",
        }
    })

    print("   Fetching tool list...")
    tools = await client.get_tools()
    query_tool = next((t for t in tools if t.name == "query"), None)

    if not query_tool:
        print("❌ Tool 'query' not found.")
        return

    print(f"✅ Found tool: {query_tool.name}")

    for name, sql in QUERIES.items():
        print(f"\n⏱️  Running query: {name}...")
        start_time = time.time()
        try:
            result = await query_tool.ainvoke({"query": sql})
            end_time = time.time()
            duration = end_time - start_time
            print(f"   ✅ Completed in {duration:.2f} seconds")
            # print(f"   Result snippet: {str(result)[:100]}...") 
        except Exception as e:
            end_time = time.time()
            duration = end_time - start_time
            print(f"   ❌ Failed after {duration:.2f} seconds: {e}")

if __name__ == "__main__":
    asyncio.run(benchmark())
