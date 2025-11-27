// Wetlands Data Chatbot
// Uses an OpenAI-compatible LLM with MCP server access for querying wetlands data
//
// Debugging & Error Handling:
// - Enhanced logging for MCP query results and empty responses
// - Detects and warns about potential truncation (50K character limit in mcp-server-motherduck)
// - Validates tool call arguments and LLM responses for empty content
// - Provides user-friendly error messages for common failure scenarios

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
        this.selectedModel = config.llm_model || 'glm-4.6'; // Default model

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
            <div id="chat-footer">
                <select id="model-selector" title="Select LLM Model">
                    <option value="glm-4.6">GLM-4.6</option>
                    <option value="gpt-oss">GPT-OSS</option>
                    <option value="qwen3">Qwen3</option>
                    <option value="glm-v">GLM-V</option>
                    <option value="gemma">Gemma</option>
                    <option value="kimi">Kimi</option>
                </select>
            </div>
        `;
        document.body.appendChild(container);

        // Set initial model value
        document.getElementById('model-selector').value = this.selectedModel;

        // Event listeners
        document.getElementById('chat-toggle').addEventListener('click', () => this.toggleChat());
        document.getElementById('chat-send').addEventListener('click', () => this.sendMessage());
        document.getElementById('chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
        document.getElementById('model-selector').addEventListener('change', (e) => {
            this.selectedModel = e.target.value;
            console.log('Model changed to:', this.selectedModel);
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

    addMessage(role, content, metadata = {}) {
        const messagesDiv = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${role}`;

        // Use marked.js for markdown rendering
        // Handle undefined/null/empty content
        const safeContent = content || '';
        const formatted = marked.parse(safeContent);
        messageDiv.innerHTML = formatted;

        // Add SQL query details if present
        if (metadata.sqlQuery) {
            const detailsDiv = document.createElement('details');
            detailsDiv.style.marginTop = '10px';
            detailsDiv.style.fontSize = '12px';
            detailsDiv.style.opacity = '0.8';

            const summaryDiv = document.createElement('summary');
            summaryDiv.textContent = '🔍 View SQL Query';
            summaryDiv.style.cursor = 'pointer';
            summaryDiv.style.userSelect = 'none';

            const codeDiv = document.createElement('pre');
            codeDiv.style.marginTop = '8px';
            codeDiv.style.background = 'rgba(0, 0, 0, 0.1)';
            codeDiv.style.padding = '8px';
            codeDiv.style.borderRadius = '4px';
            codeDiv.style.overflowX = 'auto';

            const codeElement = document.createElement('code');
            codeElement.textContent = metadata.sqlQuery;
            codeDiv.appendChild(codeElement);

            detailsDiv.appendChild(summaryDiv);
            detailsDiv.appendChild(codeDiv);
            messageDiv.appendChild(detailsDiv);
        }

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
            const result = await this.queryLLM(userMessage);
            console.log('[Chat] Got response, length:', result?.response?.length);

            // Remove loading message
            const messagesDiv = document.getElementById('chat-messages');
            messagesDiv.removeChild(messagesDiv.lastChild);

            // Add assistant response (handle undefined/null)
            const finalResponse = result.response || "I received an empty response. Please try again.";
            const metadata = result.sqlQuery ? { sqlQuery: result.sqlQuery } : {};
            this.addMessage('assistant', finalResponse, metadata);
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
            return { response: "Sorry, the database connection is not available. Please refresh the page to try again." };
        }

        // Use the configured endpoint directly
        let endpoint = this.llmEndpoint;
        console.log('[LLM] Starting request to:', endpoint);
        console.log('[LLM] Origin:', window.location.origin);

        // Track SQL queries executed
        let sqlQuery = null;

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
            model: this.selectedModel,
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
            console.log('[LLM] Tool call ID:', toolCall.id);

            const functionArgs = JSON.parse(toolCall.function.arguments);

            // Capture the SQL query
            sqlQuery = functionArgs.query;

            console.log('[LLM] Parsed query argument length:', functionArgs.query?.length || 0);

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
                        model: this.selectedModel,
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
                            // Update captured SQL query
                            sqlQuery = retryArgs.query;
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
            console.warn('[MCP] 🔍 Query result type:', typeof queryResult);
            console.warn('[MCP] 🔍 Query result length:', queryResult?.length || 0);
            console.warn('[MCP] 🔍 Query result preview:', queryResult?.substring(0, 500));

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
            console.warn('[LLM] 🔍 Follow-up messages count:', followUpMessages.length);
            console.warn('[LLM] 🔍 Tool result being sent to LLM (first 300 chars):', queryResult.substring(0, 300));
            const followUpStartTime = Date.now();

            const followUpResponse = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.selectedModel,
                    messages: followUpMessages,
                    // Do NOT allow additional tool calls - LLM should just interpret the result
                    tool_choice: 'none'
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
            
            // Log if LLM is trying to make additional tool calls
            const followUpMessage = followUpData.choices?.[0]?.message;
            if (followUpMessage?.tool_calls && followUpMessage.tool_calls.length > 0) {
                console.warn('[LLM] ⚠️  LLM attempting additional tool calls in follow-up!');
                console.warn('[LLM] 🔧 Attempted tool calls:', followUpMessage.tool_calls.map(tc => ({
                    tool: tc.function.name,
                    args: tc.function.arguments
                })));
            }
            
            console.warn('[LLM] 🔍 Follow-up full response:', followUpData);
            console.warn('[LLM] 🔍 Follow-up choices:', followUpData.choices);
            console.warn('[LLM] 🔍 Follow-up message:', followUpMessage);
            console.log('[LLM] Follow-up message content length:', followUpMessage?.content?.length || 0);

            const finalContent = followUpData.choices[0].message.content;

            // Check for empty response from LLM
            if (!finalContent || finalContent.trim() === '') {
                console.warn('[LLM] ⚠️  WARNING: LLM returned empty content after tool call');
                console.log('[LLM] Tool result was:', queryResult.substring(0, 200));
                console.log('[LLM] SQL query preserved for debugging:', sqlQuery.substring(0, 100) + '...');
                return {
                    response: 'I processed the query but had trouble generating a response. **Check the SQL query below** to see what was executed. The query ran successfully but I couldn\'t interpret the results. Please try rephrasing your question.',
                    sqlQuery: sqlQuery  // SQL query is preserved for UI display
                };
            }

            return {
                response: finalContent,
                sqlQuery: sqlQuery
            };
        }

        console.log('[LLM] Returning direct message content (no tool calls)');
        console.log('[LLM] Direct content length:', message.content?.length || 0);

        const directContent = message.content;

        // Check for empty direct response
        if (!directContent || directContent.trim() === '') {
            console.warn('[LLM] ⚠️  WARNING: LLM returned empty direct content');
            return {
                response: 'I received your question but had trouble generating a response. Please try rephrasing or asking something else.',
                sqlQuery: null
            };
        }

        return {
            response: directContent,
            sqlQuery: null
        };
    } async executeMCPQuery(sqlQuery) {
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

            console.log('[MCP] Raw result structure:', {
                hasContent: !!result.content,
                contentLength: result.content?.length,
                contentType: typeof result.content
            });

            // Extract text from result
            if (result.content && result.content.length > 0) {
                const text = result.content[0].text;
                const textLength = text?.length || 0;

                console.log('[MCP] Result text length:', textLength, 'characters');

                // Check for empty results
                if (!text || text.trim() === '') {
                    console.warn('[MCP] ⚠️  WARNING: Query returned empty text content');
                    console.log('[MCP] Content object:', result.content[0]);
                    console.log('[MCP] NOTE: SQL query is preserved and will be shown in UI for debugging');
                    return 'The query executed successfully but returned no data. This could mean:\n- No rows matched your query criteria\n- The result was empty\n\n**Check the SQL query below** to verify it\'s correct, or try a different query.';
                }

                // Check for potential truncation (mcp-server-motherduck has 50,000 char limit)
                if (textLength >= 49000) {
                    console.warn('[MCP] ⚠️  WARNING: Result may be truncated (approaching 50K character limit)');
                    console.warn('[MCP] Consider adding LIMIT clause to reduce result size');
                }

                console.log('✅ Query result received:', text.substring(0, 200) + '...');
                return text;
            }

            // No content in response
            console.error('[MCP] ❌ No content in MCP response');
            console.error('[MCP] Full result object:', JSON.stringify(result, null, 2));
            throw new Error('No content in MCP response');

        } catch (error) {
            console.error('❌ MCP query error:', error);
            console.error('[MCP] Error details:', {
                message: error.message,
                stack: error.stack,
                type: error.constructor.name
            });
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
