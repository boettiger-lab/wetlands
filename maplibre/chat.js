// Wetlands Data Chatbot
// Uses an OpenAI-compatible LLM with MCP server access for querying wetlands data

class WetlandsChatbot {
    constructor(config) {
        this.config = config;
        this.mcpServerUrl = config.mcp_server_url;
        this.llmEndpoint = config.llm_endpoint;
        this.llmApiKey = null; // Will prompt user
        this.systemPrompt = null;
        this.messages = [];

        this.initializeUI();
        this.loadSystemPrompt();
        this.promptForApiKey();
    }

    promptForApiKey() {
        // Check if API key is in sessionStorage (cleared when tab closes)
        this.llmApiKey = sessionStorage.getItem('nrp_api_key');

        if (!this.llmApiKey) {
            this.llmApiKey = prompt(
                'Enter your NRP API key:\n\n' +
                '(This will only be stored in your browser session and cleared when you close the tab)'
            );

            if (this.llmApiKey) {
                sessionStorage.setItem('nrp_api_key', this.llmApiKey);
            } else {
                this.addMessage('system', 'API key not provided. Chat functionality will be limited.');
            }
        }
    }

    async loadSystemPrompt() {
        try {
            const response = await fetch('system-prompt.md');
            this.systemPrompt = await response.text();
            console.log('System prompt loaded');
        } catch (error) {
            console.error('Failed to load system prompt:', error);
            this.systemPrompt = 'You are a helpful assistant for wetlands data analysis.';
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
        this.addMessage('assistant', 'Hi! I can help you explore global wetlands data indexed by H3 hexagons (73.73 ha each). Try asking:\n\n• "How many hectares of peatlands are there?"\n• "What is the total area of freshwater wetlands?"\n• "Which wetlands have the highest biodiversity?"\n• "Compare coastal vs inland wetland areas"');
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

        // Simple markdown-like formatting
        const formatted = content
            .replace(/```(\w+)?\n([\s\S]+?)```/g, '<pre><code>$2</code></pre>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');

        messageDiv.innerHTML = formatted;
        messagesDiv.appendChild(messageDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    async sendMessage() {
        const input = document.getElementById('chat-input');
        const sendButton = document.getElementById('chat-send');
        const userMessage = input.value.trim();

        if (!userMessage) return;

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
            const response = await this.queryLLM(userMessage);

            // Remove loading message
            const messagesDiv = document.getElementById('chat-messages');
            messagesDiv.removeChild(messagesDiv.lastChild);

            // Add assistant response
            this.addMessage('assistant', response);
            this.messages.push({ role: 'assistant', content: response });

        } catch (error) {
            console.error('Chat error:', error);

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
        // Use the configured endpoint directly
        let endpoint = this.llmEndpoint;

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

        // Call the LLM directly with user's API key
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.llmApiKey}`
            },
            body: JSON.stringify({
                model: this.config.llm_model || 'gpt-4',
                messages: messages,
                tools: [
                    {
                        type: 'function',
                        function: {
                            name: 'query_wetlands_data',
                            description: 'Execute a SQL query on the wetlands database using DuckDB',
                            parameters: {
                                type: 'object',
                                properties: {
                                    query: {
                                        type: 'string',
                                        description: 'SQL query to execute. Must start with S3 secret setup.'
                                    }
                                },
                                required: ['query']
                            }
                        }
                    }
                ],
                tool_choice: 'auto'
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('LLM API Error:', response.status, errorText);
            throw new Error(`LLM API error (${response.status}): ${response.statusText}`);
        }

        const data = await response.json();
        const message = data.choices[0].message;

        // Check if LLM wants to call a tool
        if (message.tool_calls && message.tool_calls.length > 0) {
            const toolCall = message.tool_calls[0];
            const functionArgs = JSON.parse(toolCall.function.arguments);

            // Execute the query via MCP
            const queryResult = await this.executeMCPQuery(functionArgs.query);

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

            const followUpResponse = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.llmApiKey}`
                },
                body: JSON.stringify({
                    model: this.config.llm_model || 'gpt-4',
                    messages: followUpMessages
                })
            });

            const followUpData = await followUpResponse.json();
            return followUpData.choices[0].message.content;
        }

        return message.content;
    }

    async executeMCPQuery(sqlQuery) {
        console.log('Executing MCP query:', sqlQuery);

        const response = await fetch(this.mcpServerUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: Date.now(),
                method: 'tools/call',
                params: {
                    name: 'query',
                    arguments: {
                        query: sqlQuery
                    }
                }
            })
        });

        if (!response.ok) {
            throw new Error(`MCP server error: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(`MCP error: ${data.error.message}`);
        }

        // Extract the text content from MCP response
        const result = data.result.content[0].text;
        return result;
    }
}

// Initialize chatbot when config is loaded
let chatbot;

fetch('config.json')
    .then(response => response.json())
    .then(config => {
        chatbot = new WetlandsChatbot(config);
        console.log('Wetlands chatbot initialized');
    })
    .catch(error => {
        console.error('Failed to load chatbot config:', error);
        // Initialize with default config so UI still appears
        chatbot = new WetlandsChatbot({
            mcp_server_url: 'http://localhost:8001/mcp',
            llm_model: 'glm-v'
        });
    });
