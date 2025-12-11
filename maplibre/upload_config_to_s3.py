"""
Upload layer-config.json to S3 bucket using DuckDB

This script demonstrates how the chatbot updates map layers using DuckDB SQL,
matching the workflow described in the system prompt.
"""

import subprocess
import sys

"""
Upload layer-config.json to S3 bucket using DuckDB

This script demonstrates how the chatbot updates map layers using DuckDB SQL,
matching the workflow described in the system prompt.
"""

import subprocess
import sys


def generate_duckdb_sql(wetlands=True, ncp=False, carbon=False, ramsar=False, wdpa=False, hydrobasins=False):
    """
    Generate DuckDB SQL to create layer-config.json with specified layer visibility.
    
    This matches exactly what the LLM should do when controlling the map.
    """
    
    # Build JSON_OBJECT arguments for layers
    sql = f"""
SET THREADS=100;
INSTALL httpfs; LOAD httpfs;

CREATE OR REPLACE SECRET s3 (
    TYPE S3,
    ENDPOINT 'rook-ceph-rgw-nautiluss3.rook',
    URL_STYLE 'path',
    USE_SSL 'false',
    KEY_ID '',
    SECRET ''
);

CREATE OR REPLACE SECRET outputs (
    TYPE S3,
    ENDPOINT 'minio.carlboettiger.info',
    URL_STYLE 'path',
    SCOPE 's3://public-outputs'
);

COPY (
  SELECT JSON_OBJECT(
    'layers', JSON_OBJECT(
      'wetlands-layer', JSON_OBJECT('visible', {str(wetlands).lower()}),
      'ncp-layer', JSON_OBJECT('visible', {str(ncp).lower()}),
      'carbon-layer', JSON_OBJECT('visible', {str(carbon).lower()}),
      'ramsar-layer', JSON_OBJECT('visible', {str(ramsar).lower()}),
      'wdpa-layer', JSON_OBJECT('visible', {str(wdpa).lower()}),
      'hydrobasins-layer', JSON_OBJECT('visible', {str(hydrobasins).lower()})
    )
  ) as json_val
) TO 's3://public-outputs/wetlands/layer-config.json'
(FORMAT JSON, ARRAY false, RECORDS true, OVERWRITE_OR_IGNORE true);
"""
    
    return sql


def upload_config_via_duckdb(wetlands=True, ncp=False, carbon=False, ramsar=False, wdpa=False, hydrobasins=False):
    """
    Upload the config to S3 using DuckDB SQL (same as chatbot).
    """
    
    # First generate SQL to write to a temp file in better format
    sql = f"""
SET THREADS=100;
INSTALL httpfs; LOAD httpfs;

CREATE OR REPLACE SECRET s3 (
    TYPE S3,
    ENDPOINT 'rook-ceph-rgw-nautiluss3.rook',
    URL_STYLE 'path',
    USE_SSL 'false',
    KEY_ID '',
    SECRET ''
);

CREATE OR REPLACE SECRET outputs (
    TYPE S3,
    ENDPOINT 'minio.carlboettiger.info',
    URL_STYLE 'path',
    SCOPE 's3://public-outputs'
);

-- Write the config using DuckDB struct syntax
COPY (
  SELECT {{
    'wetlands-layer': {str(wetlands).lower()},
    'ncp-layer': {str(ncp).lower()},
    'carbon-layer': {str(carbon).lower()},
    'ramsar-layer': {str(ramsar).lower()},
    'wdpa-layer': {str(wdpa).lower()},
    'hydrobasins-layer': {str(hydrobasins).lower()}
  }} as layers
) TO 's3://public-outputs/wetlands/layer-config.json'
(FORMAT JSON, OVERWRITE_OR_IGNORE true);
"""
    
    print("Executing DuckDB SQL to update layer config...")
    print("\nSQL:")
    print("=" * 60)
    print(sql)
    print("=" * 60)
    
    # Execute via duckdb CLI
    try:
        result = subprocess.run(
            ["duckdb", "-c", sql],
            capture_output=True,
            text=True,
            check=True
        )
        print("\n✓ Successfully uploaded layer-config.json to S3")
        print("  Public URL: https://minio.carlboettiger.info/public-outputs/wetlands/layer-config.json")
        if result.stdout:
            print("\nDuckDB output:", result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print(f"\n✗ DuckDB execution failed:", file=sys.stderr)
        print(f"  Error: {e.stderr}", file=sys.stderr)
        return False
    except FileNotFoundError:
        print("\n✗ 'duckdb' command not found. Please install DuckDB:", file=sys.stderr)
        print("  https://duckdb.org/docs/minio/linux/reference/minio-mc.html", file=sys.stderr)
        return False


if __name__ == "__main__":
    # Example: Show wetlands and carbon layers
    print("Example 1: Carbon analysis\n")
    upload_config_via_duckdb(
        wetlands=False,
        carbon=True,
        ncp=False,
        ramsar=False,
        wdpa=True,
        hydrobasins=False
    )
