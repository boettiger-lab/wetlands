import asyncio
import time
from langchain_mcp_adapters.client import MultiServerMCPClient

QUERIES = {
    "Count wetlands by category": """
SET THREADS=100;
INSTALL httpfs; LOAD httpfs;
CREATE OR REPLACE SECRET s3 (TYPE S3, ENDPOINT 'minio.carlboettiger.info', URL_STYLE 'path');

SELECT 
    c.category,
    COUNT(*) as hex_count,
    ROUND(hex_count * 73.7327598, 2) as area_hectares,
    ROUND(hex_count * 0.737327598, 2) as area_km2
FROM read_parquet('s3://public-wetlands/glwd/hex/**') w
JOIN read_csv('s3://public-wetlands/glwd/category_codes.csv') c ON w.Z = c.Z
WHERE w.Z > 0
GROUP BY c.category
ORDER BY area_km2 DESC;
""",
    "Calculate vulnerable carbon in India": """
SET THREADS=100;
INSTALL httpfs; LOAD httpfs;
CREATE OR REPLACE SECRET s3 (TYPE S3, ENDPOINT 'minio.carlboettiger.info', URL_STYLE 'path');

SELECT 
    c.name as wetland_type,
    COUNT(*) as hex_count,
    ROUND(SUM(carb.carbon), 2) as total_carbon,
    ROUND(hex_count * 73.7327598, 2) as area_hectares
FROM read_parquet('s3://public-overturemaps/hex/countries.parquet') ctry
JOIN read_parquet('s3://public-wetlands/glwd/hex/**') w ON ctry.h8 = w.h8 AND ctry.h0 = w.h0
JOIN read_parquet('s3://public-carbon/hex/vulnerable-carbon/**') carb ON w.h8 = carb.h8 AND w.h0 = carb.h0
JOIN read_csv('s3://public-wetlands/glwd/category_codes.csv') c ON w.Z = c.Z
WHERE ctry.country = 'IN'
GROUP BY c.name
ORDER BY total_carbon DESC;
""",
    "Calculate total peatland area": """
SET THREADS=100;
INSTALL httpfs; LOAD httpfs;
CREATE OR REPLACE SECRET s3 (TYPE S3, ENDPOINT 'minio.carlboettiger.info', URL_STYLE 'path');

SELECT 
    'Peatlands (codes 22-27)' as wetland_group,
    COUNT(*) as total_hexagons,
    ROUND(total_hexagons * 73.7327598, 2) as total_hectares,
    ROUND(total_hexagons * 0.737327598, 2) as total_km2,
    ROUND(total_hexagons * 0.284679, 2) as total_sq_miles
FROM read_parquet('s3://public-wetlands/glwd/hex/**')
WHERE Z BETWEEN 22 AND 27;
""",
    "Evaluate wetlands by NCP in Australia": """
SET THREADS=100;
INSTALL httpfs; LOAD httpfs;
CREATE OR REPLACE SECRET s3 (TYPE S3, ENDPOINT 'minio.carlboettiger.info', URL_STYLE 'path');

SELECT 
    r.name as region_name,
    COUNT(*) as wetland_hex_count,
    ROUND(COUNT(*) * 73.7327598, 2) as wetland_area_hectares,
    ROUND(AVG(n.ncp), 3) as avg_ncp_score
FROM read_parquet('s3://public-overturemaps/hex/regions/**') r
JOIN read_parquet('s3://public-wetlands/glwd/hex/**') w ON r.h8 = w.h8 AND r.h0 = w.h0
JOIN read_parquet('s3://public-ncp/hex/ncp_biod_nathab/**') n ON w.h8 = n.h8 AND w.h0 = n.h0
WHERE r.country = 'AU'
GROUP BY r.name
ORDER BY avg_ncp_score DESC
LIMIT 10;
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
