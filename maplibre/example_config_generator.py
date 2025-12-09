"""
Example: How the MCP server could generate layer configuration

This shows how the chatbot + MCP server can control the map layers
by generating a layer-config.json file.
"""

import json

def generate_layer_config_for_query(user_query: str) -> dict:
    """
    Based on user query, determine which layers should be visible.
    
    Examples:
    - "Show me wetlands and carbon" -> wetlands + carbon visible
    - "Show protected areas" -> wdpa + ramsar visible
    - "Show watersheds with high biodiversity" -> hydrobasins + ncp visible
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
    
    # Simple keyword matching (in reality, this would be smarter)
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


def generate_config_sql(layer_settings: dict) -> str:
    """
    Generate SQL that creates the layer-config.json file in the outputs bucket.
    This would be executed by the MCP server's DuckDB connection.
    """
    
    # Build the JSON structure using DuckDB's JSON functions
    layers_json = ", ".join([
        f"'{layer_id}', JSON_OBJECT('visible', {str(settings['visible']).lower()})"
        for layer_id, settings in layer_settings.items()
    ])
    
    sql = f"""
SET THREADS=100;
INSTALL httpfs; LOAD httpfs;

CREATE OR REPLACE SECRET outputs (
    TYPE S3,
    ENDPOINT 'minio.carlboettiger.info',
    URL_STYLE 'path',
    SCOPE 's3://public-outputs'
);

COPY (
  SELECT JSON_OBJECT(
    'layers', JSON_OBJECT({layers_json})
  ) as config
) TO 's3://public-outputs/wetlands/layer-config.json'
(FORMAT JSON, ARRAY true);
"""
    
    return sql


# Example usage
if __name__ == "__main__":
    # Example 1: User asks about wetlands and carbon
    query1 = "Show me wetlands with high carbon storage"
    config1 = generate_layer_config_for_query(query1)
    print("Query:", query1)
    print("Config:", json.dumps(config1, indent=2))
    print("\nSQL to generate:")
    print(generate_config_sql(config1["layers"]))
    print("\n" + "="*60 + "\n")
    
    # Example 2: User asks about protected areas
    query2 = "Show me all protected areas and Ramsar sites"
    config2 = generate_layer_config_for_query(query2)
    print("Query:", query2)
    print("Config:", json.dumps(config2, indent=2))
    print()
    
    # Example 3: Watershed analysis
    query3 = "Analyze watersheds with high biodiversity"
    config3 = generate_layer_config_for_query(query3)
    print("Query:", query3)
    print("Config:", json.dumps(config3, indent=2))
