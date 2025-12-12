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
        this.systemPrompt = null;
        this.messages = [];
        this.mcpClient = null;
        this.mcpTools = [];
        this.selectedModel = config.llm_model || 'kimi'; // Default model
        this.currentTurnQueries = []; // Track ALL SQL queries in current turn

        this.initializeUI();
        this.loadSystemPrompt();
        this.initMCP();
    }

    getCurrentModelConfig() {
        // Find the config for the currently selected model
        const modelConfig = this.config.llm_models?.find(m => m.value === this.selectedModel);
        if (!modelConfig) {
            console.warn(`Model config not found for ${this.selectedModel}, using first model`);
            return this.config.llm_models?.[0] || {
                value: 'kimi',
                label: 'Kimi',
                endpoint: 'https://llm-proxy.nrp-nautilus.io/v1',
                api_key: 'EMPTY'
            };
        }
        return modelConfig;
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
            this.mcpTools = []; // Ensure tools is an empty array, not undefined
            // Show error in chat UI
            setTimeout(() => {
                this.addMessage('error', 'Database connection failed. Some features may not work. Please refresh the page.');
            }, 1000);
        }
    }

    initializeUI() {
        // Configure marked to use highlight.js
        if (window.marked && window.hljs) {
            marked.setOptions({
                highlight: function (code, lang) {
                    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
                    return hljs.highlight(code, { language }).value;
                },
                langPrefix: 'hljs language-'
            });
        }

        // Chat container
        const container = document.createElement('div');
        container.id = 'chat-container';

        // Build model selector options from config
        const modelOptions = this.config.llm_models?.map(model =>
            `<option value="${model.value}">${model.label}</option>`
        ).join('') || '<option value="kimi">Kimi</option>';

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
                    ${modelOptions}
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
            if (e.key === 'Enter' && !e.shiftKey) this.sendMessage();
        });
        document.getElementById('model-selector').addEventListener('change', (e) => {
            this.selectedModel = e.target.value;
            console.log('Model changed to:', this.selectedModel);
        });

        // Welcome message
        this.addMessage(
            'assistant',
            'Hi! I can help you explore global wetlands data (GLWDv2.0). Try asking:\n\n' +
            '* "How many hectares of peatlands are there?"\n' +
            '* "Calculate vulnerable carbon stored in different wetlands of India?"\n' +
            '* "How many bird species can be found in forested wetlands in Costa Rica? List the species as csv."'
        );
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

        // Debug logging
        console.log('[UI] Adding message, role:', role, 'has SQL queries:', metadata.sqlQueries?.length || 0);

        // Use marked.js for markdown rendering
        // Handle undefined/null/empty content
        const safeContent = content || '';
        const formatted = marked.parse(safeContent);
        messageDiv.innerHTML = formatted;

        messagesDiv.appendChild(messageDiv);

        // Add SQL query details if present - now handles multiple queries
        if (metadata.sqlQueries && metadata.sqlQueries.length > 0) {
            console.log(`[UI] ✅ Appending ${metadata.sqlQueries.length} SQL query details element(s)`);

            metadata.sqlQueries.forEach((sqlQuery, index) => {
                const detailsDiv = document.createElement('details');
                detailsDiv.style.marginTop = '10px';
                detailsDiv.style.fontSize = '12px';
                detailsDiv.style.opacity = '0.8';

                const summaryDiv = document.createElement('summary');
                const queryLabel = metadata.sqlQueries.length > 1 ? `Query ${index + 1}` : 'View SQL Query';
                summaryDiv.textContent = `🔍 ${queryLabel}`;
                summaryDiv.style.cursor = 'pointer';
                summaryDiv.style.userSelect = 'none';

                const codeDiv = document.createElement('pre');
                codeDiv.style.marginTop = '8px';
                codeDiv.style.padding = '0';
                codeDiv.style.borderRadius = '4px';
                codeDiv.style.overflowX = 'auto';

                const codeElement = document.createElement('code');
                codeElement.className = 'language-sql';
                codeElement.textContent = sqlQuery;
                codeDiv.appendChild(codeElement);

                // Apply syntax highlighting if available
                if (window.hljs) {
                    window.hljs.highlightElement(codeElement);
                }

                detailsDiv.appendChild(summaryDiv);
                detailsDiv.appendChild(codeDiv);
                messagesDiv.appendChild(detailsDiv);
            });
        } else if (role === 'assistant') {
            console.log('[UI] No SQL queries in metadata - this is expected for clarifications/follow-ups without prior queries');
        }
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    // Show a tool call proposal and wait for user approval
    async showToolCallProposal(toolCalls, iterationNumber, reasoning) {
        return new Promise((resolve) => {
            const messagesDiv = document.getElementById('chat-messages');

            const proposalDiv = document.createElement('div');
            proposalDiv.className = 'chat-message tool-proposal';

            let content = '';

            // Add reasoning if present
            if (reasoning && reasoning.trim()) {
                content += `<div class="tool-reasoning" style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid rgba(0,0,0,0.1);">${marked.parse(reasoning)}</div>`;
            }

            content += `<div class="tool-proposal-header"><strong>🔧 Tool Call Proposed (Step ${iterationNumber})</strong></div>`;

            toolCalls.forEach((toolCall, index) => {
                const functionArgs = JSON.parse(toolCall.function.arguments);
                const sqlQuery = functionArgs.query || 'No query provided';

                content += `
                    <div class="tool-call-item">
                        <div class="tool-call-name"><strong>Tool:</strong> ${toolCall.function.name}</div>
                `;

                // Show SQL query in collapsible section
                const detailsId = `tool-proposal-${iterationNumber}-${index}`;
                content += `
                    <details>
                        <summary style="cursor: pointer; user-select: none;">📝 View SQL Query</summary>
                        <pre style="margin-top: 8px; padding: 0; border-radius: 4px; overflow-x: auto;"><code class="language-sql">${this.escapeHtml(sqlQuery)}</code></pre>
                    </details>
                `;

                content += `</div>`;
            });

            // Add approval button
            content += `
                <div class="tool-approval-buttons" style="margin-top: 12px;">
                    <button class="approve-btn" style="padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">✓ Run Query</button>
                </div>
            `;

            proposalDiv.innerHTML = content;
            messagesDiv.appendChild(proposalDiv);

            // Apply syntax highlighting
            if (window.hljs) {
                proposalDiv.querySelectorAll('code').forEach(block => {
                    window.hljs.highlightElement(block);
                });
            }

            messagesDiv.scrollTop = messagesDiv.scrollHeight;

            // Re-enable input so user can type new question to interrupt
            const input = document.getElementById('chat-input');
            const sendButton = document.getElementById('chat-send');
            input.disabled = false;
            sendButton.disabled = false;

            // Handle approval
            const approveBtn = proposalDiv.querySelector('.approve-btn');

            approveBtn.addEventListener('click', () => {
                approveBtn.disabled = true;
                approveBtn.textContent = '⏳ Running...';
                resolve({ approved: true, toolCalls });
            });
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Show tool call results
    showToolResults(results, iterationNumber) {
        const messagesDiv = document.getElementById('chat-messages');

        const resultsDiv = document.createElement('div');
        resultsDiv.className = 'chat-message tool-results';

        let content = `<div class="tool-results-header"><strong>✅ Query Results (Step ${iterationNumber})</strong></div>`;

        results.forEach((result, index) => {
            content += `
                <details>
                    <summary style="cursor: pointer; user-select: none;">📊 Result ${index + 1}</summary>
                    <pre style="margin-top: 8px; background: rgba(0,0,0,0.05); padding: 8px; border-radius: 4px; overflow-x: auto; max-height: 300px;"><code>${this.escapeHtml(result.substring(0, 5000))}${result.length > 5000 ? '\n... (truncated)' : ''}</code></pre>
                </details>
            `;
        });

        resultsDiv.innerHTML = content;
        messagesDiv.appendChild(resultsDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    // Ask if user wants to continue with another tool call
    async askContinue(iterationNumber) {
        return new Promise((resolve) => {
            const messagesDiv = document.getElementById('chat-messages');

            const continueDiv = document.createElement('div');
            continueDiv.className = 'chat-message assistant';
            continueDiv.innerHTML = `
                <p><strong>LLM is processing results...</strong></p>
                <p style="font-size: 12px; opacity: 0.7;">Iteration ${iterationNumber} complete. Sending results back to LLM for interpretation or next step...</p>
            `;

            messagesDiv.appendChild(continueDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;

            // Auto-continue after showing message
            setTimeout(() => resolve(true), 500);
        });
    }

    // Show thinking indicator immediately
    showThinking() {
        const messagesDiv = document.getElementById('chat-messages');

        const thinkingDiv = document.createElement('div');
        thinkingDiv.id = 'thinking-indicator';
        thinkingDiv.className = 'chat-message system';
        thinkingDiv.innerHTML = '💭 Thinking...';

        messagesDiv.appendChild(thinkingDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    // Remove thinking indicator
    clearThinking() {
        const thinkingDiv = document.getElementById('thinking-indicator');
        if (thinkingDiv) {
            thinkingDiv.remove();
        }
    }

    // Remove progress container
    clearProgressMessages() {
        const progressContainer = document.getElementById('progress-container');
        if (progressContainer) {
            progressContainer.remove();
        }
    }

    // Generate a human-readable description of what a SQL query does
    describeQuery(sqlQuery) {
        const lower = sqlQuery.toLowerCase();

        // Data export to CSV
        if (lower.includes('.csv') && lower.includes('copy')) {
            return 'Exporting results to CSV file';
        }

        // Count queries
        if (lower.includes('count(')) {
            if (lower.includes('ramsar')) return 'Counting Ramsar wetland sites';
            if (lower.includes('wdpa')) return 'Counting protected areas';
            if (lower.includes('peatland') || (lower.includes('z between') && lower.includes('22'))) {
                return 'Calculating total peatland area';
            }
            if (lower.includes('wetland')) return 'Counting wetlands by type';
            return 'Counting matching records';
        }

        // Sum/aggregate queries
        if (lower.includes('sum(') && lower.includes('carbon')) {
            return 'Calculating total carbon storage';
        }

        // Average queries
        if (lower.includes('avg(') && lower.includes('ncp')) {
            return 'Calculating average biodiversity importance';
        }

        // Geographic filters
        let desc = 'Querying ';
        if (lower.includes('ramsar')) desc += 'Ramsar sites';
        else if (lower.includes('wdpa')) desc += 'protected areas';
        else if (lower.includes('hydrobasin')) desc += 'watershed data';
        else if (lower.includes('wetland')) desc += 'wetlands';
        else desc += 'data';

        // Add geographic context
        if (lower.includes("country = 'us'") || lower.includes("iso3 = 'usa'")) {
            desc += ' in the United States';
        } else if (lower.includes("country = 'br'")) {
            desc += ' in Brazil';
        } else if (lower.includes("country = 'in'")) {
            desc += ' in India';
        } else if (lower.includes("country = 'au'")) {
            desc += ' in Australia';
        } else if (lower.includes('country =')) {
            desc += ' by country';
        }

        return desc;
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

        // Clear any previous progress messages from last turn
        this.clearProgressMessages();

        // Show immediate thinking indicator while LLM generates response
        this.showThinking();

        try {
            console.log('[Chat] Calling queryLLM...');
            const result = await this.queryLLM(userMessage);
            console.log('[Chat] Got response:', result);

            // Clear thinking indicator
            this.clearThinking();

            // Check if cancelled
            if (result.cancelled) {
                console.log('[Chat] User cancelled tool execution');
                return;
            }

            // Add assistant response (handle undefined/null)
            if (result.response) {
                const finalResponse = result.response;

                // Debug logging for SQL queries
                if (result.sqlQueries && result.sqlQueries.length > 0) {
                    console.log(`[Chat] ✅ ${result.sqlQueries.length} SQL queries executed`);
                    result.sqlQueries.forEach((q, i) => console.log(`[Chat]   Query ${i + 1}: ${q.substring(0, 100)}...`));
                }

                // Show final interpretation message
                this.addMessage('assistant', finalResponse);
                this.messages.push({ role: 'assistant', content: finalResponse });
            } else {
                this.addMessage('error', "I received an empty response. Please try again.");
            }

        } catch (error) {
            console.error('[Chat] Error caught:', error);
            console.error('[Chat] Error stack:', error.stack);

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

        // Get current model configuration
        const modelConfig = this.getCurrentModelConfig();

        // Detect GPT-OSS model for conditional API usage
        const isGptOss = this.selectedModel === 'nimbus' || modelConfig.value === 'nimbus';

        // Build full endpoint URL
        let endpoint = modelConfig.endpoint;
        if (isGptOss) {
            // GPT-OSS uses Responses API
            if (!endpoint.endsWith('/responses')) {
                endpoint = endpoint.replace(/\/$/, '') + '/v1/responses';
            }
        } else {
            // Other models use Chat Completions API
            if (!endpoint.endsWith('/chat/completions')) {
                endpoint = endpoint.replace(/\/$/, '') + '/chat/completions';
            }
        }
        console.log('[LLM] Starting request to:', endpoint);
        console.log('[LLM] Using model config:', { model: modelConfig.value, endpoint: modelConfig.endpoint });
        console.log('[LLM] Origin:', window.location.origin);

        // Track ALL SQL queries executed in this turn
        this.currentTurnQueries = [];

        // Build the prompt with system context
        // We will maintain this conversation history for the duration of this turn
        let currentTurnMessages = [
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
        console.log('[LLM] Raw MCP tools available:', this.mcpTools?.length || 0);

        // Check if tools are available
        if (!this.mcpTools || this.mcpTools.length === 0) {
            console.error('[LLM] ❌ No MCP tools available - cannot execute queries');
            return {
                response: 'The database connection is not available. MCP tools failed to load. Please refresh the page and try again.',
                sqlQueries: []
            };
        }

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

        console.log('[LLM] Converted tools:', JSON.stringify(tools, null, 2));

        let toolCallCount = 0;
        const MAX_TOOL_CALLS = 8; // Guardrail: Allow up to 8 tool calls per user message

        while (toolCallCount < MAX_TOOL_CALLS) {
            // Build request payload - conditional format based on model
            let requestPayload;
            if (isGptOss) {
                // Responses API format for GPT-OSS
                // Convert messages to a single input string
                const inputText = currentTurnMessages.map(msg => {
                    if (msg.role === 'system') return `System: ${msg.content}`;
                    if (msg.role === 'user') return `User: ${msg.content}`;
                    if (msg.role === 'assistant') return `Assistant: ${msg.content}`;
                    if (msg.role === 'tool') return `Tool Result: ${msg.content}`;
                    return '';
                }).filter(Boolean).join('\n\n');

                requestPayload = {
                    model: this.selectedModel,
                    input: inputText,
                    tools: tools,
                    tool_choice: 'auto'
                };
            } else {
                // Chat Completions API format for other models
                requestPayload = {
                    model: this.selectedModel,
                    messages: currentTurnMessages,
                    tools: tools,
                    tool_choice: 'auto'
                };
            }

            console.log(`[LLM] Request payload (Step ${toolCallCount + 1}):`, {
                model: requestPayload.model,
                messageCount: requestPayload.messages?.length || 'N/A (using input string)',
                toolCount: requestPayload.tools.length
            });

            // Call the LLM proxy
            console.log('[LLM] Sending fetch request...');
            const startTime = Date.now();

            // Prepare headers with proxy authentication
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${modelConfig.api_key}`
            };

            console.log('[LLM] Using API key from model config');

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestPayload)
            });

            const elapsed = Date.now() - startTime;
            console.log(`[LLM] Response received after ${elapsed}ms, status: ${response.status}`);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[LLM] Error response body:', errorText);
                throw new Error(`LLM API error (${response.status}): ${response.statusText}`);
            }

            const data = await response.json();
            let message;

            if (isGptOss) {
                // Parse Responses API format
                // GPT-OSS returns output array with text and function_call items
                const output = data.output || [];

                // Extract text content
                const textItems = output.filter(item => item.type === 'text');
                const content = textItems.map(item => item.text).join('');

                // Extract function calls
                const functionCallItems = output.filter(item => item.type === 'function_call');
                const toolCalls = functionCallItems.map(item => ({
                    id: item.id || `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    type: 'function',
                    function: {
                        name: item.name,
                        arguments: JSON.stringify(item.arguments)
                    }
                }));

                message = {
                    role: 'assistant',
                    content: content || null,
                    tool_calls: toolCalls.length > 0 ? toolCalls : undefined
                };
            } else {
                // Parse Chat Completions API format
                message = data.choices[0].message;
            }

            // Add the assistant's response to the conversation history
            currentTurnMessages.push(message);

            // Check if LLM wants to call a tool
            if (message.tool_calls && message.tool_calls.length > 0) {
                toolCallCount++;
                console.log(`[LLM] Tool calls requested (${toolCallCount}/${MAX_TOOL_CALLS}):`, message.tool_calls.length);

                // Clear thinking indicator
                this.clearThinking();

                // Show tool call proposal and wait for approval
                // Pass message.content (reasoning) to be displayed inside the proposal
                const approval = await this.showToolCallProposal(message.tool_calls, toolCallCount, message.content);

                if (!approval.approved) {
                    console.log('[User] Tool call rejected by user');
                    this.addMessage('system', 'Tool call cancelled. You can ask a different question or modify your request.');
                    return {
                        response: null,
                        sqlQueries: this.currentTurnQueries,
                        cancelled: true
                    };
                }

                // User approved - execute all tool calls
                const toolResults = [];

                for (const toolCall of message.tool_calls) {
                    console.log('[LLM] Executing tool:', toolCall.function.name);
                    console.log('[LLM] Tool arguments:', toolCall.function.arguments);
                    console.log('[LLM] Tool call ID:', toolCall.id);

                    let functionArgs;
                    try {
                        functionArgs = JSON.parse(toolCall.function.arguments);
                    } catch (e) {
                        console.error('[LLM] Failed to parse tool arguments:', e);
                        const errorMsg = "Error: Failed to parse tool arguments. Please ensure arguments are valid JSON.";
                        currentTurnMessages.push({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            content: errorMsg
                        });
                        toolResults.push(errorMsg);
                        continue;
                    }

                    // Capture the SQL query
                    if (functionArgs.query) {
                        this.currentTurnQueries.push(functionArgs.query);
                        console.log(`[SQL] ✅ SQL query ${this.currentTurnQueries.length} captured`);
                    }

                    // Check if the query argument is missing or empty
                    if (!functionArgs.query || functionArgs.query.trim() === '') {
                        console.warn('[LLM] ⚠️  WARNING: Tool call missing or empty "query" argument!');
                        const errorMsg = "Error: The 'query' argument was missing or empty. Please provide a valid SQL query.";
                        currentTurnMessages.push({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            content: errorMsg
                        });
                        toolResults.push(errorMsg);
                        continue;
                    }

                    // Execute the query via MCP
                    console.log('[MCP] Executing query via MCP...');
                    let queryResult;
                    try {
                        queryResult = await this.executeMCPQuery(functionArgs.query);
                        console.log(`[SQL] ✅ Query ${this.currentTurnQueries.length} completed`);
                        toolResults.push(queryResult);
                    } catch (err) {
                        console.error('[MCP] Execution error:', err);
                        queryResult = `Error executing query: ${err.message}`;
                        toolResults.push(queryResult);
                    }

                    // Add tool result to messages
                    currentTurnMessages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: queryResult
                    });
                }

                // Show results to user
                this.showToolResults(toolResults, toolCallCount);

                // Ask if should continue
                await this.askContinue(toolCallCount);

                // Loop continues to next iteration to send tool results back to LLM
            } else {
                // No tool calls, this is the final response
                console.log('[LLM] Returning direct message content (no tool calls)');
                const directContent = message.content;

                // Check for empty direct response
                if (!directContent || directContent.trim() === '') {
                    console.warn('[LLM] ⚠️  WARNING: LLM returned empty direct content');
                    return {
                        response: 'I received your question but had trouble generating a response. Please try rephrasing or asking something else.',
                        sqlQueries: this.currentTurnQueries
                    };
                }

                // Check for SQL as text (fallback check)
                if (directContent.toLowerCase().includes('select ') &&
                    directContent.toLowerCase().includes('from ') &&
                    this.currentTurnQueries.length === 0) {
                    console.warn('[LLM] ⚠️  WARNING: LLM appears to be returning SQL as text instead of using tool call!');
                }

                return {
                    response: directContent,
                    sqlQueries: this.currentTurnQueries
                };
            }
        }

        // If we exit the loop, we hit the max tool calls limit
        console.warn(`[LLM] ⚠️  Hit maximum tool call limit (${MAX_TOOL_CALLS})`);
        return {
            response: `I've reached the maximum number of steps (${MAX_TOOL_CALLS}) allowed to answer your question without finding a final answer. I may be getting stuck in a loop. Please try to be more specific or ask a simpler question.`,
            sqlQueries: this.currentTurnQueries
        };
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

// Wait for DOM to be ready before initializing chatbot
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeChatbot);
} else {
    // DOM is already ready
    initializeChatbot();
}

function initializeChatbot() {
    fetch('config.json')
        .then(response => response.json())
        .then(config => {
            console.log('Config loaded successfully');
            chatbot = new WetlandsChatbot(config);
            console.log('Wetlands chatbot initialized');
        })
        .catch(error => {
            console.error('Failed to load chatbot config:', error);
        });
}

