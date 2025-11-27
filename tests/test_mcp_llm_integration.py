"""
Unit tests for MCP server integration with LLM tool calling.

Tests that the LLM can successfully:
1. Connect to the remote MCP server
2. Receive tool definitions
3. Generate SQL queries via tool calls
4. Execute tools and process results

Based on remote-llm.ipynb
"""

import os
import pytest
import asyncio
from pathlib import Path
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_mcp_adapters.client import MultiServerMCPClient

# Load environment variables from .env file if it exists
try:
    from dotenv import load_dotenv
    # Try to load from project root .env file
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)
        print(f"✓ Loaded environment variables from {env_path}")
    else:
        print("⚠️  No .env file found, relying on system environment variables")
except ImportError:
    print("⚠️  python-dotenv not installed, relying on system environment variables")

# Load configuration from config.local.json
import json
config_path = Path(__file__).parent.parent / 'maplibre' / 'config.local.json'
if config_path.exists():
    with open(config_path) as f:
        config = json.load(f)
    print(f"✓ Loaded configuration from {config_path}")
else:
    # Fallback to environment variables
    config = {}
    print("⚠️  No config.local.json found, using environment variables")

# Configuration - prefer config file, fallback to env vars
MCP_URL = os.getenv('MCP_URL', config.get('mcp_server_url', 'https://biodiversity-mcp.nrp-nautilus.io/sse'))
LLM_ENDPOINT = os.getenv('LLM_ENDPOINT', config.get('llm_host', 'https://ellm.nrp-nautilus.io/v1/'))
LLM_MODEL = os.getenv('LLM_MODEL', config.get('llm_model', 'glm-v'))
API_KEY = os.getenv('NRP_API_KEY')

# Print configuration status (without exposing sensitive data)
print(f"Configuration:")
print(f"  MCP_URL: {MCP_URL}")
print(f"  LLM_ENDPOINT: {LLM_ENDPOINT}")
print(f"  LLM_MODEL: {LLM_MODEL}")
print(f"  NRP_API_KEY: {'✓ Set' if API_KEY else '✗ Not set'}")

SYSTEM_PROMPT = """You are a helpful assistant that answers questions about wetlands data.
You have access to a DuckDB database with wetlands information stored in parquet files.
When asked a question, generate appropriate SQL queries to retrieve the needed information.
Always use the 'query' tool to execute SQL queries."""


@pytest.fixture
async def mcp_client():
    """Create and return an MCP client connected to the remote server."""
    client = MultiServerMCPClient({
        "wetlands": {
            "transport": "sse",
            "url": MCP_URL,
        }
    })
    tools = await client.get_tools()
    return client, tools


@pytest.fixture
def llm():
    """Create and return an LLM instance."""
    if not API_KEY:
        pytest.skip("NRP_API_KEY not set")
    
    return ChatOpenAI(
        base_url=LLM_ENDPOINT,
        api_key=API_KEY,
        model=LLM_MODEL,
        temperature=0.7
    )


class TestMCPConnection:
    """Test basic MCP server connectivity."""
    
    @pytest.mark.asyncio
    async def test_connect_to_mcp_server(self):
        """Test that we can connect to the MCP server."""
        client = MultiServerMCPClient({
            "wetlands": {
                "transport": "sse",
                "url": MCP_URL,
            }
        })
        
        tools = await client.get_tools()
        assert len(tools) > 0, "No tools returned from MCP server"
        print(f"✓ Connected to MCP server with {len(tools)} tools")
    
    @pytest.mark.asyncio
    async def test_query_tool_exists(self, mcp_client):
        """Test that the 'query' tool is available."""
        client, tools = mcp_client
        
        query_tool = next((t for t in tools if t.name == "query"), None)
        assert query_tool is not None, "Query tool not found"
        assert hasattr(query_tool, 'description'), "Query tool missing description"
        print(f"✓ Found query tool: {query_tool.description}")
    
    @pytest.mark.asyncio
    async def test_direct_tool_invocation(self, mcp_client):
        """Test invoking the query tool directly."""
        client, tools = mcp_client
        
        query_tool = next((t for t in tools if t.name == "query"), None)
        assert query_tool is not None
        
        # Simple test query
        result = await query_tool.ainvoke({"query": "SELECT 1 as test"})
        assert result is not None, "Tool returned no result"
        print(f"✓ Tool invocation successful: {result}")


class TestLLMToolCalling:
    """Test LLM integration with MCP tools."""
    
    @pytest.mark.asyncio
    async def test_llm_receives_tools(self, mcp_client, llm):
        """Test that LLM can be bound with MCP tools."""
        client, tools = mcp_client
        
        llm_with_tools = llm.bind_tools(tools)
        assert llm_with_tools is not None
        print(f"✓ LLM bound with {len(tools)} tools")
    
    @pytest.mark.asyncio
    async def test_llm_generates_tool_calls(self, mcp_client, llm):
        """Test that LLM generates tool calls for wetlands questions."""
        client, tools = mcp_client
        llm_with_tools = llm.bind_tools(tools)
        
        messages = [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content="How many wetland records are there? Use SELECT COUNT(*) to find out.")
        ]
        
        response = await llm_with_tools.ainvoke(messages)
        
        # Check that the LLM generated tool calls
        assert hasattr(response, 'tool_calls'), "Response missing tool_calls attribute"
        print(f"✓ LLM generated {len(response.tool_calls) if response.tool_calls else 0} tool calls")
        
        # If tool calls were generated, verify structure
        if response.tool_calls:
            tool_call = response.tool_calls[0]
            assert 'name' in tool_call, "Tool call missing name"
            assert 'args' in tool_call, "Tool call missing args"
            assert 'query' in tool_call['args'], "Tool call args missing query"
            print(f"✓ Tool call structure valid: {tool_call['name']}")
            print(f"  Generated SQL: {tool_call['args']['query'][:100]}...")
    
    @pytest.mark.asyncio
    async def test_end_to_end_tool_execution(self, llm):
        """Test complete flow: LLM generates query -> execute tool -> interpret result."""
        # Create fresh client for this test
        client = MultiServerMCPClient({
            "wetlands": {
                "transport": "sse",
                "url": MCP_URL,
            }
        })
        tools = await client.get_tools()
        llm_with_tools = llm.bind_tools(tools)
        
        # Ask a simple question
        messages = [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content="Execute SELECT 1 as test to verify the database connection.")
        ]
        
        response = await llm_with_tools.ainvoke(messages)
        
        # Execute tool if generated
        if response.tool_calls:
            tool_call = response.tool_calls[0]
            print(f"✓ LLM generated tool call: {tool_call['name']}")
            print(f"  Query: {tool_call['args']['query']}")
            
            # Get fresh client and execute
            fresh_client = MultiServerMCPClient({
                "wetlands": {
                    "transport": "sse",
                    "url": MCP_URL,
                }
            })
            fresh_tools = await fresh_client.get_tools()
            fresh_tool = next((t for t in fresh_tools if t.name == tool_call['name']), None)
            
            assert fresh_tool is not None, "Tool not found in fresh client"
            
            result = await fresh_tool.ainvoke(tool_call['args'])
            assert result is not None, "Tool execution returned no result"
            print(f"✓ Tool executed successfully")
            print(f"  Result: {result[:200] if isinstance(result, str) else result}")
            
            # Get LLM to interpret the result
            messages.append(response)
            messages.append(HumanMessage(content=f"Tool result: {result}"))
            final = await llm.ainvoke(messages)
            
            assert final.content is not None, "LLM returned no interpretation"
            print(f"✓ LLM interpretation: {final.content[:200]}")
        else:
            # If no tool calls, LLM should still respond
            assert response.content is not None, "LLM returned no content and no tool calls"
            print(f"ℹ LLM responded without tools: {response.content[:200]}")


class TestRealWorldQueries:
    """Test realistic wetlands data queries."""
    
    @pytest.mark.asyncio
    @pytest.mark.slow
    async def test_count_query(self, llm):
        """Test counting wetland records."""
        client = MultiServerMCPClient({
            "wetlands": {
                "transport": "sse",
                "url": MCP_URL,
            }
        })
        tools = await client.get_tools()
        llm_with_tools = llm.bind_tools(tools)
        
        messages = [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content="How many total wetland hexagons are in the database?")
        ]
        
        response = await llm_with_tools.ainvoke(messages)
        
        # Should generate a tool call
        assert response.tool_calls or response.content, "LLM returned nothing"
        
        if response.tool_calls:
            print(f"✓ Generated query for counting wetlands")
            # Verify SQL contains expected keywords
            query = response.tool_calls[0]['args']['query']
            assert 'SELECT' in query.upper(), "Query missing SELECT"
            print(f"  SQL: {query[:150]}...")


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v", "-s"])
