# GPT-OSS Responses API Integration

## Summary
Modified `chat.js` to conditionally use OpenAI's Responses API (`/v1/responses`) for the GPT-OSS model (nimbus), while maintaining Chat Completions API compatibility for all other models.

## Changes Made

### 1. Model Detection & Endpoint Selection (Line 469)
**Added:** Conditional detection of GPT-OSS model and appropriate API endpoint selection

```javascript
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
```

### 2. Request Payload Format (Line 542)
**Modified:** Conditional request format based on model type

- **GPT-OSS (Responses API):** Uses `input` (string) instead of `messages` (array)
- **Other Models:** Uses standard Chat Completions format with `messages` array

```javascript
let requestPayload;
if (isGptOss) {
    // Responses API format - convert messages to single input string
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
    // Chat Completions API format
    requestPayload = {
        model: this.selectedModel,
        messages: currentTurnMessages,
        tools: tools,
        tool_choice: 'auto'
    };
}
```

### 3. Response Parsing (Line 604)
**Modified:** Conditional response parsing to handle different API formats

- **GPT-OSS (Responses API):** Parses `output` array containing `text` and `function_call` items
- **Other Models:** Parses standard `choices[0].message` format

```javascript
const data = await response.json();
let message;

if (isGptOss) {
    // Parse Responses API format
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
```

## Technical Details

### API Differences

| Feature | Chat Completions API | Responses API (GPT-OSS) |
|---------|---------------------|-------------------------|
| Endpoint | `/v1/chat/completions` | `/v1/responses` |
| Input Format | `messages: [{role, content}]` | `input: "text string"` |
| Output Format | `choices[0].message` | `output: [{type, ...}]` |
| Tool Calls | `message.tool_calls[]` | `output[].type === 'function_call'` |
| Text Content | `message.content` | `output[].type === 'text'` |

### Testing
After deployment, test with the GPT-OSS/nimbus model to verify:
- ✅ SQL queries are executed as tool calls (not returned as text)
- ✅ Tool approval workflow functions correctly
- ✅ Results are properly displayed to the user
- ✅ Other models (Qwen, Llama, Kimi) still work correctly

### Backup
Original file backed up as: `chat.js.backup`

To restore: `cp chat.js.backup chat.js`

---
**Date:** December 12, 2025
**Model:** openai/gpt-oss-120b (served as "nimbus" via vLLM)
