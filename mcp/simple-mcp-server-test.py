import asyncio
from langchain_mcp_adapters.client import MultiServerMCPClient

async def test_mcp_connection():
    print("🔌 Connecting to MCP Server...")

    # 1. Initialize the client (Standard object creation, NOT a context manager)
    client = MultiServerMCPClient({
        "my-server": {
            "url": "https://biodiversity-mcp.nrp-nautilus.io/sse",
            "transport": "sse",
        }
    })

    # 2. Fetch the tools (This triggers the connection)
    print("   Fetching tool list...")
    tools = await client.get_tools()

    # 3. Find the 'query' tool from the list
    query_tool = next((t for t in tools if t.name == "query"), None)

    if query_tool:
        print(f"✅ Found tool: {query_tool.name}")
        print(f"   Description: {query_tool.description}")

        # 4. Invoke the tool object directly
        # We do NOT call client.call_tool(), we call the tool itself.
        print("\n🧪 Invoking 'query' tool (SELECT 1)...")
        
        try:
            result = await query_tool.ainvoke({"query": "SELECT 1"})
            print(f"   Response: {result}")
        except Exception as e:
            print(f"❌ Execution Error: {e}")

    else:
        print("❌ Tool 'query' not found.")

    # 5. No explicit close() is needed or available on this client version.
    # The session persists for the lifecycle of the client object.

if __name__ == "__main__":
    asyncio.run(test_mcp_connection())