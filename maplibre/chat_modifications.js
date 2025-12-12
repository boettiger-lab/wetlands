// Modification 1: Endpoint construction (around line 438-441)
// Original:
//     let endpoint = modelConfig.endpoint;
//     if (!endpoint.endsWith('/chat/completions')) {
//         endpoint = endpoint.replace(/\/$/, '') + '/chat/completions';
//     }

// Modified:
const isGptOss = this.selectedModel === 'nimbus' || modelConfig.value === 'nimbus';
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

// Modification 2: Request payload (around line 531-538)
// For GPT-OSS, convert messages to input format
let requestPayload;
if (isGptOss) {
    // Responses API format for GPT-OSS
    // Convert messages to a single input string
    const inputText = currentTurnMessages.map(msg => {
        if (msg.role === 'system') return `System: ${msg.content}`;
        if (msg.role === 'user') return `User: ${msg.content}`;
        if (msg.role === 'assistant') return `Assistant: ${msg.content}`;
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

// Modification 3: Response parsing (around line 571-580)
// Original:
//     const data = await response.json();
//     const message = data.choices[0].message;

// Modified:
const data = await response.json();
let message;
let toolCalls = [];

if (isGptOss) {
    // Parse Responses API format
    // GPT-OSS returns output array with text and function_call items
    const output = data.output || [];
    
    // Extract text content
    const textItems = output.filter(item => item.type === 'text');
    const content = textItems.map(item => item.text).join('');
    
    // Extract function calls
    const functionCallItems = output.filter(item => item.type === 'function_call');
    toolCalls = functionCallItems.map(item => ({
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

