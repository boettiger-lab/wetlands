#!/usr/bin/env python3
"""
Test script to verify MCP server can access S3 data via HTTP
Uses the MCP HTTP stream transport
"""

import requests
import json

MCP_SERVER_URL = "http://localhost:8001/mcp"

# Test query that sets up S3 endpoint and queries wetlands data
test_query = """
CREATE OR REPLACE SECRET s3 (
    TYPE S3,
    ENDPOINT 'minio.carlboettiger.info',
    URL_STYLE 'path'
);

SELECT * FROM read_parquet('s3://public-wetlands/hex/**') LIMIT 5;
"""

def test_mcp_list_tools():
    """List available MCP tools"""
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/list"
    }
    
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    
    print(f"Listing tools from MCP server at {MCP_SERVER_URL}")
    
    try:
        response = requests.post(MCP_SERVER_URL, json=payload, headers=headers, timeout=10)
        print(f"Status: {response.status_code}")
        result = response.json()
        print(f"Tools: {json.dumps(result, indent=2)}\n")
        return result
    except Exception as e:
        print(f"Error: {e}\n")
        return None

def test_mcp_query():
    """Send a query to the MCP server"""
    payload = {
        "jsonrpc": "2.0",
        "id": 2,
        "method": "tools/call",
        "params": {
            "name": "query",
            "arguments": {
                "query": test_query
            }
        }
    }
    
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    
    print(f"Testing MCP server query")
    print(f"Query:\n{test_query}\n")
    
    try:
        response = requests.post(MCP_SERVER_URL, json=payload, headers=headers, timeout=30)
        print(f"Status: {response.status_code}")
        print(f"Response:\n{json.dumps(response.json(), indent=2)}")
        return response.json()
    except Exception as e:
        print(f"Error: {e}")
        return None

if __name__ == "__main__":
    # First list tools to verify connection
    test_mcp_list_tools()
    
    # Then try the query
    test_mcp_query()
