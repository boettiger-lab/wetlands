/**
 * MCP server integration tests with LLM tool calling (JavaScript)
 * 
 * Tests that the LLM can successfully:
 * 1. Connect to the remote MCP server
 * 2. Receive tool definitions
 * 3. Generate SQL queries via tool calls
 * 4. Execute tools and process results
 * 
 * Equivalent to test_mcp_llm_integration.py
 * Based on remote-llm.ipynb
 * 
 * Run with: npm test test_mcp_llm_integration.test.js
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import OpenAI from 'openai';
import EventSource from './eventsource-shim.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Polyfill EventSource for Node.js
global.EventSource = EventSource;

// Load configuration from config.local.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, '..', 'maplibre', 'config.local.json');

let config = {};
if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log(`✓ Loaded configuration from ${configPath}`);
} else {
    console.log('⚠️  No config.local.json found, using environment variables');
}

// Configuration - prefer config file, fallback to env vars
const MCP_URL = process.env.MCP_URL || config.mcp_server_url || 'https://biodiversity-mcp.nrp-nautilus.io/sse';
const LLM_ENDPOINT = process.env.LLM_ENDPOINT || config.llm_host || 'https://ellm.nrp-nautilus.io/v1';
const LLM_MODEL = process.env.LLM_MODEL || config.llm_model || 'glm-v';
const API_KEY = process.env.NRP_API_KEY;

const SYSTEM_PROMPT = `You are a helpful assistant that answers questions about wetlands data.
You have access to a DuckDB database with wetlands information stored in parquet files.
When asked a question, generate appropriate SQL queries to retrieve the needed information.
Always use the 'query' tool to execute SQL queries.`;

/**
 * Convert MCP tool definition to OpenAI function format
 */
function mcpToolToOpenAIFunction(mcpTool) {
    return {
        type: 'function',
        function: {
            name: mcpTool.name,
            description: mcpTool.description,
            parameters: mcpTool.inputSchema || {
                type: 'object',
                properties: {},
                required: []
            }
        }
    };
}

/**
 * Create MCP client and get tools
 */
async function createMCPClient() {
    const transport = new SSEClientTransport(new URL(MCP_URL));
    const client = new Client({
        name: 'test-client',
        version: '1.0.0'
    }, {
        capabilities: {}
    });

    await client.connect(transport);
    const response = await client.listTools();

    return { client, tools: response.tools };
}

describe('MCP Connection Tests', () => {

    test('should connect to MCP server', async () => {
        const { client, tools } = await createMCPClient();

        expect(tools.length).toBeGreaterThan(0);
        console.log(`✓ Connected to MCP server with ${tools.length} tools`);

        await client.close();
    }, 30000);

    test('should find query tool', async () => {
        const { client, tools } = await createMCPClient();

        const queryTool = tools.find(t => t.name === 'query');
        expect(queryTool).toBeDefined();
        expect(queryTool.description).toBeDefined();

        console.log(`✓ Found query tool: ${queryTool.description}`);

        await client.close();
    }, 30000);

    test('should execute tool directly', async () => {
        const { client, tools } = await createMCPClient();

        const queryTool = tools.find(t => t.name === 'query');
        expect(queryTool).toBeDefined();

        const result = await client.callTool({
            name: 'query',
            arguments: { query: 'SELECT 1 as test' }
        });

        expect(result).toBeDefined();
        console.log(`✓ Tool invocation successful:`, result.content);

        await client.close();
    }, 30000);

});

describe('LLM Tool Calling Tests', () => {

    let openai;

    beforeAll(() => {
        if (!API_KEY) {
            console.warn('NRP_API_KEY not set, skipping LLM tests');
        }

        openai = new OpenAI({
            baseURL: LLM_ENDPOINT,
            apiKey: API_KEY || 'dummy-key'
        });
    });

    test('should bind LLM with MCP tools', async () => {
        if (!API_KEY) {
            console.log('⊘ Skipped: API key not set');
            return;
        }

        const { client, tools } = await createMCPClient();

        // Convert MCP tools to OpenAI format
        const openaiTools = tools.map(mcpToolToOpenAIFunction);

        expect(openaiTools.length).toBeGreaterThan(0);
        console.log(`✓ Converted ${openaiTools.length} MCP tools to OpenAI format`);

        await client.close();
    }, 30000);

    test('should generate tool calls from LLM', async () => {
        if (!API_KEY) {
            console.log('⊘ Skipped: API key not set');
            return;
        }

        const { client, tools } = await createMCPClient();
        const openaiTools = tools.map(mcpToolToOpenAIFunction);

        const response = await openai.chat.completions.create({
            model: LLM_MODEL,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: 'How many wetland records are there? Use SELECT COUNT(*) to find out.' }
            ],
            tools: openaiTools,
            temperature: 0.7
        });

        const message = response.choices[0].message;
        console.log('✓ LLM response received');

        // Check if tool calls were generated
        if (message.tool_calls) {
            console.log(`✓ LLM generated ${message.tool_calls.length} tool call(s)`);

            const toolCall = message.tool_calls[0];
            expect(toolCall).toHaveProperty('function');
            expect(toolCall.function).toHaveProperty('name');
            expect(toolCall.function).toHaveProperty('arguments');

            const args = JSON.parse(toolCall.function.arguments);
            expect(args).toHaveProperty('query');

            console.log(`✓ Tool call structure valid: ${toolCall.function.name}`);
            console.log(`  Generated SQL: ${args.query.substring(0, 100)}...`);
        } else {
            console.log(`ℹ LLM responded without tool calls: ${message.content?.substring(0, 100)}`);
        }

        await client.close();
    }, 30000);

    test('should execute end-to-end tool workflow', async () => {
        if (!API_KEY) {
            console.log('⊘ Skipped: API key not set');
            return;
        }

        const { client, tools } = await createMCPClient();
        const openaiTools = tools.map(mcpToolToOpenAIFunction);

        // Ask LLM a question
        const response = await openai.chat.completions.create({
            model: LLM_MODEL,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: 'Execute SELECT 1 as test to verify the database connection.' }
            ],
            tools: openaiTools,
            temperature: 0.7
        });

        const message = response.choices[0].message;

        if (message.tool_calls && message.tool_calls.length > 0) {
            const toolCall = message.tool_calls[0];
            console.log(`✓ LLM generated tool call: ${toolCall.function.name}`);

            const args = JSON.parse(toolCall.function.arguments);
            console.log(`  Query: ${args.query}`);

            // Execute the tool with fresh client
            const { client: freshClient } = await createMCPClient();

            const result = await freshClient.callTool({
                name: toolCall.function.name,
                arguments: args
            });

            expect(result).toBeDefined();
            console.log(`✓ Tool executed successfully`);
            console.log(`  Result:`, JSON.stringify(result.content).substring(0, 200));

            // Get LLM interpretation
            const finalResponse = await openai.chat.completions.create({
                model: LLM_MODEL,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: 'Execute SELECT 1 as test to verify the database connection.' },
                    message,
                    {
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: JSON.stringify(result.content)
                    }
                ],
                temperature: 0.7
            });

            const finalMessage = finalResponse.choices[0].message;
            expect(finalMessage.content).toBeDefined();
            console.log(`✓ LLM interpretation: ${finalMessage.content.substring(0, 200)}`);

            await freshClient.close();
        } else {
            // LLM responded without tools
            expect(message.content).toBeDefined();
            console.log(`ℹ LLM responded without tools: ${message.content.substring(0, 200)}`);
        }

        await client.close();
    }, 60000);

});

describe('Real World Query Tests', () => {

    let openai;

    beforeAll(() => {
        if (!API_KEY) {
            console.warn('NRP_API_KEY not set, skipping real world query tests');
        }

        openai = new OpenAI({
            baseURL: LLM_ENDPOINT,
            apiKey: API_KEY || 'dummy-key'
        });
    });

    test('should generate count query', async () => {
        if (!API_KEY) {
            console.log('⊘ Skipped: API key not set');
            return;
        }

        const { client, tools } = await createMCPClient();
        const openaiTools = tools.map(mcpToolToOpenAIFunction);

        const response = await openai.chat.completions.create({
            model: LLM_MODEL,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: 'How many total wetland hexagons are in the database?' }
            ],
            tools: openaiTools,
            temperature: 0.7
        });

        const message = response.choices[0].message;

        // Should generate a response (with or without tools)
        expect(message.tool_calls || message.content).toBeTruthy();

        if (message.tool_calls) {
            console.log('✓ Generated query for counting wetlands');
            const args = JSON.parse(message.tool_calls[0].function.arguments);
            const query = args.query;

            expect(query.toUpperCase()).toContain('SELECT');
            console.log(`  SQL: ${query.substring(0, 150)}...`);
        }

        await client.close();
    }, 30000);

});
