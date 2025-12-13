# Responses API Integration

## Summary
Modified `chat.js` to support both OpenAI's Responses API (`/v1/responses`) and Chat Completions API (`/v1/chat/completions`) based on explicit configuration, rather than hardcoded model detection.

## Changes Made

### 1. Configuration-Based API Selection (Line ~500)
**Changed:** From hardcoded model name detection to explicit configuration flag

Models can now opt-in to using the Responses API by setting `"use_responses_api": true` in their config:

```json
{
    "value": "my-model",
    "label": "My Model",
    "endpoint": "https://api.example.com/v1",
    "api_key": "...",
    "use_responses_api": true
}
```

```javascript
// Check if model explicitly requests Responses API
const useResponsesAPI = modelConfig.use_responses_api === true;

// Build full endpoint URL
let endpoint = modelConfig.endpoint;
if (useResponsesAPI) {
    // Model explicitly configured to use Responses API
    if (!endpoint.endsWith('/responses')) {
        endpoint = endpoint.replace(/\/$/, '') + '/responses';
    }
} else {
    // Default: use Chat Completions API
    if (!endpoint.endsWith('/chat/completions')) {
        endpoint = endpoint.replace(/\/$/, '') + '/chat/completions';
    }
}
```

### 2. Request Payload Format (Line ~575)
**Modified:** Conditional request format based on configuration

- **Responses API:** Uses `input` (string) instead of `messages` (array)
- **Chat Completions API (default):** Uses standard `messages` array format

```javascript
let requestPayload;
if (useResponsesAPI) {
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

### 3. Response Parsing (Line ~635)
**Modified:** Conditional response parsing to handle different API formats

- **Responses API:** Parses `output` array containing `text` and `function_call` items
- **Chat Completions API (default):** Parses standard `choices[0].message` format

```javascript
const data = await response.json();
let message;

if (useResponsesAPI) {
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

| Feature | Chat Completions API (default) | Responses API |
|---------|-------------------------------|---------------|
| Endpoint | `/v1/chat/completions` | `/v1/responses` |
| Input Format | `messages: [{role, content}]` | `input: "text string"` |
| Output Format | `choices[0].message` | `output: [{type, ...}]` |
| Tool Calls | `message.tool_calls[]` | `output[].type === 'function_call'` |
| Text Content | `message.content` | `output[].type === 'text'` |
| Configuration | Default (no flag needed) | Set `"use_responses_api": true` |

### Configuration Examples

**Standard Chat Completions API (default):**
```json
{
    "value": "kimi",
    "label": "Kimi",
    "endpoint": "https://llm-proxy.nrp-nautilus.io/v1",
    "api_key": "EMPTY"
}
```

**Responses API (explicit opt-in):**
```json
{
    "value": "gpt-oss",
    "label": "GPT-OSS",
    "endpoint": "https://llm-proxy.nrp-nautilus.io/v1",
    "api_key": "EMPTY",
    "use_responses_api": true
}
```

### Migration from Old Version
**Old (hardcoded):** Any model with value "nimbus" automatically used Responses API
**New (explicit):** Models must explicitly set `"use_responses_api": true` to use Responses API

### Testing
After deployment, verify:
- ✅ Models with `use_responses_api: true` use Responses API
- ✅ Models without this flag use Chat Completions API (default)
- ✅ SQL queries are executed as tool calls (not returned as text)
- ✅ Tool approval workflow functions correctly
- ✅ Results are properly displayed to the user

---
**Updated:** December 12, 2025
**Change:** Replaced hardcoded model name detection with explicit configuration flag
