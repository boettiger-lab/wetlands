#!/bin/bash

# Step 1: Modify endpoint construction (line 438-441)
sed -i '438,441c\
        // Detect GPT-OSS model\
        const isGptOss = this.selectedModel === '\''nimbus'\'' || modelConfig.value === '\''nimbus'\'';\
        let endpoint = modelConfig.endpoint;\
        if (isGptOss) {\
            // GPT-OSS uses Responses API\
            if (!endpoint.endsWith('\''/responses'\'')) {\
                endpoint = endpoint.replace(/\\/$/, '\'''\'') + '\''/v1/responses'\'';\
            }\
        } else {\
            // Other models use Chat Completions API\
            if (!endpoint.endsWith('\''/chat/completions'\'')) {\
                endpoint = endpoint.replace(/\\/$/, '\'''\'') + '\''/chat/completions'\'';\
            }\
        }' chat.js

# Step 2: Modify request payload construction (line 531-538)
sed -i '531,538c\
            // Build request payload - conditional format based on model\
            let requestPayload;\
            if (isGptOss) {\
                // Responses API format for GPT-OSS\
                // Convert messages to a single input string\
                const inputText = currentTurnMessages.map(msg => {\
                    if (msg.role === '\''system'\'') return `System: ${msg.content}`;\
                    if (msg.role === '\''user'\'') return `User: ${msg.content}`;\
                    if (msg.role === '\''assistant'\'') return `Assistant: ${msg.content}`;\
                    if (msg.role === '\''tool'\'') return `Tool Result: ${msg.content}`;\
                    return '\'''\'';\
                }).filter(Boolean).join('\''\\n\\n'\'');\
                \
                requestPayload = {\
                    model: this.selectedModel,\
                    input: inputText,\
                    tools: tools,\
                    tool_choice: '\''auto'\''\
                };\
            } else {\
                // Chat Completions API format for other models\
                requestPayload = {\
                    model: this.selectedModel,\
                    messages: currentTurnMessages,\
                    tools: tools,\
                    tool_choice: '\''auto'\''\
                };\
            }' chat.js

# Step 3: Modify response parsing (line 571-573)
sed -i '571,573c\
            const data = await response.json();\
            let message;\
            \
            if (isGptOss) {\
                // Parse Responses API format\
                // GPT-OSS returns output array with text and function_call items\
                const output = data.output || [];\
                \
                // Extract text content\
                const textItems = output.filter(item => item.type === '\''text'\'');\
                const content = textItems.map(item => item.text).join('\'''\'');\
                \
                // Extract function calls\
                const functionCallItems = output.filter(item => item.type === '\''function_call'\'');\
                const toolCalls = functionCallItems.map(item => ({\
                    id: item.id || `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,\
                    type: '\''function'\'',\
                    function: {\
                        name: item.name,\
                        arguments: JSON.stringify(item.arguments)\
                    }\
                }));\
                \
                message = {\
                    role: '\''assistant'\'',\
                    content: content || null,\
                    tool_calls: toolCalls.length > 0 ? toolCalls : undefined\
                };\
            } else {\
                // Parse Chat Completions API format\
                message = data.choices[0].message;\
            }' chat.js

echo "Modifications applied successfully"
