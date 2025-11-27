// Wetlands Data Chatbot
// Uses an OpenAI-compatible LLM with MCP server access for querying wetlands data

// Import MCP SDK for proper SSE communication
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

class WetlandsChatbot {
    constructor(config) {
        this.config = config;
        this.mcpServerUrl = config.mcp_server_url;
        this.llmEndpoint = config.llm_endpoint;
        this.systemPrompt = null;
        this.messages = [];
        this.mcpClient = null;
        this.mcpTools = [];

        this.initializeUI();
        this.loadSystemPrompt();
        this.initMCP();
    }

    async loadSystemPrompt() {
        try {
            const response = await fetch('system-prompt.md');
            this.systemPrompt = await response.text();
            console.log('✓ System prompt loaded');
        } catch (error) {
            console.error('Failed to load system prompt:', error);
            this.systemPrompt = 'You are a helpful assistant for wetlands data analysis.';
        }
    }

    async initMCP() {
        try {
            console.log('🔌 Initializing MCP connection...');

            // Create SSE transport
            const transport = new SSEClientTransport(new URL(this.mcpServerUrl));

            // Create MCP client
            this.mcpClient = new Client({
                name: 'wetlands-chatbot',
                version: '1.0.0'
            }, {
                capabilities: {}
            });

            // Connect to MCP server
            await this.mcpClient.connect(transport);
            console.log('✓ MCP client connected');

            // Get available tools
            const toolsResponse = await this.mcpClient.listTools();
            this.mcpTools = toolsResponse.tools;
            console.log('✓ Available MCP tools:', this.mcpTools.map(t => t.name));

        } catch (error) {
            console.error('❌ MCP initialization error:', error);
            this.mcpClient = null;
            // Show error in chat UI
            setTimeout(() => {
                this.addMessage('error', 'Database connection failed. Some features may not work. Please refresh the page.');
            }, 1000);
        }
    }

    initializeUI() {
        // Chat container
        const container = document.createElement('div');
        container.id = 'chat-container';
        container.innerHTML = `
            <div id="chat-header">
                <h3>🦆 Wetlands Data Assistant</h3>
                <button id="chat-toggle">−</button>
            </div>
            <div id="chat-messages"></div>
            <div id="chat-input-container">
                <input type="text" id="chat-input" placeholder="Ask about wetlands data..." />
                <button id="chat-send">Send</button>
            </div>
        `;
        document.body.appendChild(container);

        // Event listeners
        document.getElementById('chat-toggle').addEventListener('click', () => this.toggleChat());
        document.getElementById('chat-send').addEventListener('click', () => this.sendMessage());
        document.getElementById('chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        // Welcome message
        this.addMessage('assistant', 'Hi! I can help you explore global wetlands data (GLWDv2.0). Try asking:\n\n* "How many hectares of peatlands are there?"\n* "What is the total area of freshwater wetlands?"\n* "Which wetlands have the highest biodiversity?"\n* "Compare coastal vs inland wetland areas"');
    }

    toggleChat() {
        const container = document.getElementById('chat-container');
        const toggle = document.getElementById('chat-toggle');
        container.classList.toggle('collapsed');
        toggle.textContent = container.classList.contains('collapsed') ? '+' : '−';
    }

    addMessage(role, content) {
        const messagesDiv = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${role}`;

        // Use marked.js for markdown rendering
        // Handle undefined/null/empty content
        const safeContent = content || '';
        const formatted = marked.parse(safeContent);
        messageDiv.innerHTML = formatted;
        messagesDiv.appendChild(messageDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    async sendMessage() {
        const input = document.getElementById('chat-input');
        const sendButton = document.getElementById('chat-send');
        const userMessage = input.value.trim();

        if (!userMessage) return;

        console.log('[Chat] Sending message:', userMessage);

        // Add user message
        this.addMessage('user', userMessage);
        this.messages.push({ role: 'user', content: userMessage });

        // Clear input and disable
        input.value = '';
        input.disabled = true;
        sendButton.disabled = true;

        // Show loading
        this.addMessage('system', 'Analyzing data<span class="loading-dots"></span>');

        try {
            console.log('[Chat] Calling queryLLM...');
            const response = await this.queryLLM(userMessage);
            console.log('[Chat] Got response, length:', response?.length);

            // Remove loading message
            const messagesDiv = document.getElementById('chat-messages');
            messagesDiv.removeChild(messagesDiv.lastChild);

            // Add assistant response (handle undefined/null)
            const finalResponse = response || "I received an empty response. Please try again.";
            this.addMessage('assistant', finalResponse);
            this.messages.push({ role: 'assistant', content: finalResponse });

        } catch (error) {
            console.error('[Chat] Error caught:', error);
            console.error('[Chat] Error stack:', error.stack);

            // Remove loading message
            const messagesDiv = document.getElementById('chat-messages');
            messagesDiv.removeChild(messagesDiv.lastChild);

            this.addMessage('error', `Error: ${error.message}`);
        } finally {
            input.disabled = false;
            sendButton.disabled = false;
            input.focus();
        }
    }

    async queryLLM(userMessage) {
        if (!this.mcpClient) {
            return "Sorry, the database connection is not available. Please refresh the page to try again.";
        }

        // Use the configured endpoint directly
        let endpoint = this.llmEndpoint;
        console.log('[LLM] Starting request to:', endpoint);
        console.log('[LLM] Origin:', window.location.origin);

        // Build the prompt with system context
        const messages = [
            {
                role: 'system',
                content: this.systemPrompt
            },
            ...this.messages.slice(-10), // Keep last 10 messages for context
            {
                role: 'user',
                content: userMessage
            }
        ];

        // Convert MCP tools to OpenAI function format
        const tools = this.mcpTools.map(tool => ({
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.inputSchema || {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'SQL query to execute'
                        }
                    },
                    required: ['query']
                }
            }
        }));

        const requestPayload = {
            model: this.config.llm_model || 'gpt-4',
            messages: messages,
            tools: tools,
            tool_choice: 'auto'
        };

        console.log('[LLM] Request payload:', {
            model: requestPayload.model,
            messageCount: requestPayload.messages.length,
            toolCount: requestPayload.tools.length
        });

        // Call the LLM proxy (API key handled server-side)
        console.log('[LLM] Sending fetch request...');
        const startTime = Date.now();

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestPayload)
        });

        const elapsed = Date.now() - startTime;
        console.log(`[LLM] Response received after ${elapsed}ms, status: ${response.status}`);
        console.log('[LLM] Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[LLM] Error response body:', errorText);
            console.error('[LLM] Full response status:', response.status, response.statusText);
            throw new Error(`LLM API error (${response.status}): ${response.statusText}`);
        }

        console.log('[LLM] Parsing JSON response...');
        const data = await response.json();
        console.log('[LLM] Response parsed successfully:', {
            hasChoices: !!data.choices,
            choiceCount: data.choices?.length
        });
        const message = data.choices[0].message;

        // Check if LLM wants to call a tool
        if (message.tool_calls && message.tool_calls.length > 0) {
            console.log('[LLM] Tool calls requested:', message.tool_calls.length);
            const toolCall = message.tool_calls[0];
            console.log('[LLM] Executing tool:', toolCall.function.name);
            console.log('[LLM] Tool arguments:', toolCall.function.arguments);

            const functionArgs = JSON.parse(toolCall.function.arguments);

            // Check if the query argument is missing or empty
            if (!functionArgs.query || functionArgs.query.trim() === '') {
                console.warn('[LLM] ⚠️  WARNING: Tool call missing or empty "query" argument!');
                console.log('[LLM] Attempting retry with explicit prompt...');

                // Retry with explicit prompt
                const retryMessages = [
                    ...messages,
                    {
                        role: 'user',
                        content: 'Please provide the exact SQL query to answer this question. Use the "query" tool with the SQL as the argument.'
                    }
                ];

                const retryResponse = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: this.config.llm_model || 'gpt-4',
                        messages: retryMessages,
                        tools: tools,
                        tool_choice: 'auto'
                    })
                });

                if (retryResponse.ok) {
                    const retryData = await retryResponse.json();
                    const retryMessage = retryData.choices[0].message;

                    if (retryMessage.tool_calls && retryMessage.tool_calls.length > 0) {
                        const retryToolCall = retryMessage.tool_calls[0];
                        const retryArgs = JSON.parse(retryToolCall.function.arguments);

                        if (retryArgs.query && retryArgs.query.trim() !== '') {
                            console.log('[LLM] ✅ Retry successful, got query!');
                            // Use the retry results
                            toolCall.function.arguments = retryToolCall.function.arguments;
                            toolCall.id = retryToolCall.id;
                            Object.assign(functionArgs, retryArgs);
                        } else {
                            console.error('[LLM] ❌ Retry failed - still no query argument');
                            throw new Error('LLM failed to provide SQL query after retry');
                        }
                    } else {
                        console.error('[LLM] ❌ Retry did not generate tool calls');
                        throw new Error('LLM did not generate a tool call after retry');
                    }
                } else {
                    console.error('[LLM] ❌ Retry request failed');
                    throw new Error('Failed to retry LLM request');
                }
            }

            // Execute the query via MCP
            console.log('[MCP] Executing query via MCP...');
            console.log('[MCP] Query:', functionArgs.query.substring(0, 100) + '...');
            const queryResult = await this.executeMCPQuery(functionArgs.query);
            console.log('[MCP] Query result length:', queryResult.length);

            // Send the result back to LLM for interpretation
            const followUpMessages = [
                ...messages,
                message, // LLM's tool call message
                {
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: queryResult
                }
            ];

            console.log('[LLM] Sending follow-up request with tool result...');
            const followUpStartTime = Date.now();

            const followUpResponse = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.llmApiKey}`
                },
                body: JSON.stringify({
                    model: this.config.llm_model || 'gpt-4',
                    messages: followUpMessages,
                    tools: tools,  // Include tools so LLM can make additional tool calls if needed
                    tool_choice: 'auto'
                })
            });

            const followUpElapsed = Date.now() - followUpStartTime;
            console.log(`[LLM] Follow-up response received after ${followUpElapsed}ms, status: ${followUpResponse.status}`);

            if (!followUpResponse.ok) {
                const errorText = await followUpResponse.text();
                console.error('[LLM] Follow-up error:', followUpResponse.status, errorText);
                throw new Error(`LLM follow-up error (${followUpResponse.status}): ${followUpResponse.statusText}`);
            }

            const followUpData = await followUpResponse.json();
            console.log('[LLM] Follow-up response parsed successfully');
            return followUpData.choices[0].message.content;
        }

        console.log('[LLM] Returning direct message content (no tool calls)');
        return message.content;
    }

    async executeMCPQuery(sqlQuery) {
        if (!this.mcpClient) {
            throw new Error('MCP client not initialized');
        }

        console.log('🔧 Executing MCP query:', sqlQuery.substring(0, 100) + '...');

        try {
            // Use MCP SDK to call the tool
            const result = await this.mcpClient.callTool({
                name: 'query',
                arguments: {
                    query: sqlQuery
                }
            });

            // Extract text from result
            if (result.content && result.content.length > 0) {
                const text = result.content[0].text;
                console.log('✅ Query result received:', text.substring(0, 200) + '...');
                return text;
            }

            throw new Error('No content in MCP response');

        } catch (error) {
            console.error('❌ MCP query error:', error);
            throw new Error(`Database query failed: ${error.message}`);
        }
    }
}

// Initialize chatbot when config is loaded
let chatbot;

// Try loading local config first (for local testing), fall back to production config
fetch('config.local.json')
    .then(response => {
        if (!response.ok) throw new Error('Local config not found');
        return response.json();
    })
    .then(config => {
        console.log('Using local config for testing');
        chatbot = new WetlandsChatbot(config);
        console.log('Wetlands chatbot initialized');
    })
    .catch(() => {
        // Fall back to production config
        fetch('config.json')
            .then(response => response.json())
            .then(config => {
                console.log('Using production config');
                chatbot = new WetlandsChatbot(config);
                console.log('Wetlands chatbot initialized');
            })
            .catch(error => {
                console.error('Failed to load chatbot config:', error);
                // Initialize with default config so UI still appears
                chatbot = new WetlandsChatbot({
                    mcp_server_url: 'https://biodiversity-mcp.nrp-nautilus.io/sse',
                    llm_endpoint: 'https://llm-proxy.nrp-nautilus.io/chat',
                    llm_model: 'qwen3'
                });
            });
    });
