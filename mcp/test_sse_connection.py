#!/usr/bin/env python3
import requests
import json

url = "https://biodiversity-mcp.nrp-nautilus.io/sse"

print(f"Connecting to {url}...")
try:
    response = requests.get(url, stream=True, timeout=10)
    print(f"Status: {response.status_code}")
    print(f"Headers: {dict(response.headers)}")
    
    print("\nReceiving events:")
    for i, line in enumerate(response.iter_lines(decode_unicode=True)):
        if line:
            print(f"  {line}")
        if i > 10:  # Just get first few events
            break
    print("\n✅ Connection successful!")
except requests.exceptions.Timeout:
    print("❌ Connection timed out")
except Exception as e:
    print(f"❌ Error: {e}")
