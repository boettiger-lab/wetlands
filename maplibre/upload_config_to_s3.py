"""
Upload layer-config.json to S3 bucket using Python

This script demonstrates how to directly write the layer-config.json
to the public-outputs bucket without using DuckDB.
"""

import json
import subprocess
import sys

def generate_layer_config_for_query(user_query: str) -> dict:
    """
    Based on user query, determine which layers should be visible.
    """
    
    # Default: all layers off
    config = {
        "layers": {
            "wetlands-layer": {"visible": False},
            "ncp-layer": {"visible": False},
            "carbon-layer": {"visible": False},
            "ramsar-layer": {"visible": False},
            "wdpa-layer": {"visible": False},
            "hydrobasins-layer": {"visible": False}
        }
    }
    
    query_lower = user_query.lower()
    
    # Simple keyword matching
    if "wetland" in query_lower:
        config["layers"]["wetlands-layer"]["visible"] = True
    
    if "biodiversity" in query_lower or "ncp" in query_lower or "nature" in query_lower:
        config["layers"]["ncp-layer"]["visible"] = True
    
    if "carbon" in query_lower:
        config["layers"]["carbon-layer"]["visible"] = True
    
    if "ramsar" in query_lower or "protected" in query_lower:
        config["layers"]["ramsar-layer"]["visible"] = True
        config["layers"]["wdpa-layer"]["visible"] = True
    
    if "watershed" in query_lower or "basin" in query_lower or "hydro" in query_lower:
        config["layers"]["hydrobasins-layer"]["visible"] = True
    
    return config


def upload_config_to_s3(config: dict, bucket_path: str = "nvme/public-outputs/wetlands/layer-config.json"):
    """
    Upload the config to S3 using mc (MinIO client).
    
    Requires mc to be installed and configured.
    """
    
    # Write to temporary file
    temp_file = "/tmp/layer-config.json"
    with open(temp_file, 'w') as f:
        json.dump(config, f, indent=2)
    
    print(f"Config written to {temp_file}")
    print(json.dumps(config, indent=2))
    
    # Upload using mc
    try:
        result = subprocess.run(
            ["mc", "cp", temp_file, bucket_path],
            capture_output=True,
            text=True,
            check=True
        )
        print(f"\n✓ Successfully uploaded to {bucket_path}")
        print(f"  Public URL: https://minio.carlboettiger.info/public-outputs/wetlands/layer-config.json")
        return True
    except subprocess.CalledProcessError as e:
        print(f"\n✗ Upload failed:", file=sys.stderr)
        print(f"  Error: {e.stderr}", file=sys.stderr)
        return False
    except FileNotFoundError:
        print("\n✗ 'mc' command not found. Please install MinIO client:", file=sys.stderr)
        print("  https://min.io/docs/minio/linux/reference/minio-mc.html", file=sys.stderr)
        return False


if __name__ == "__main__":
    # Example: User asks about wetlands and carbon
    query = "Show me wetlands with high carbon storage"
    
    print(f"Query: {query}\n")
    
    config = generate_layer_config_for_query(query)
    
    # Upload to S3
    upload_config_to_s3(config)
