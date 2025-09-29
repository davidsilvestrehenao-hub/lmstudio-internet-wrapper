# LM Studio API Integration Guide

## Overview

This document provides comprehensive guidance for integrating with LM Studio through the LM Studio Internet Wrapper. The wrapper extends LM Studio's capabilities by providing structured tool access while maintaining compatibility with LM Studio's OpenAI-compatible API.

## 🎯 **Core Integration Principles**

### **1. Structured JSON Communication**

LM Studio doesn't yet support OpenAI's full `tools` / `function_call` schema, but this wrapper enforces a reliable approach that works with any LM Studio model.

**Key Requirements:**
- Use structured system prompts that require JSON output
- Parse JSON responses to extract tool calls
- Handle both streaming and non-streaming responses
- Note: LM Studio doesn't support `response_format: { type: "json_object" }` - use system prompts instead

### **2. System Prompt Engineering**

The wrapper automatically injects a system prompt that enforces structured tool usage:

```typescript
function toolPrompt(): string {
  return `You are a tool-using model. 
Always respond ONLY with a valid JSON object following this schema:

{
  "action": "<tool name>",
  "params": { ... }
}

Available tools:
${Object.values(tools).map(
    (t) =>
      `- ${t.name}: ${t.description}\n  Params: ${JSON.stringify(
        t.schema.properties,
        null,
        2
      )}`
  ).join("\n")}
`;
}
```

### **3. Request Format**

All requests to LM Studio use the standard OpenAI-compatible format:

```typescript
const request = {
  model: "qwen/qwen3-coder-30b", // Configurable via LM_STUDIO_MODEL env var
  messages: [...yourMessages],
  stream: true
};
```

**Note:** LM Studio doesn't support the `response_format` parameter, so JSON output is enforced through system prompts instead.

## 🚀 **API Endpoints**

### **1. Chat Completion (Primary Endpoint)**

**POST** `/chat`

The main endpoint for interacting with LM Studio models through the wrapper.

#### **Request Format**

```json
{
  "messages": [
    {
      "role": "user",
      "content": "List all files in the current directory"
    }
  ],
  "stream": true
}
```

### **2. Chat with LM Studio Overrides**

**POST** `/chat/overrides`

Advanced endpoint that allows you to override LM Studio request parameters for fine-tuned control.

#### **Request Format**

```json
{
  "messages": [
    {
      "role": "user",
      "content": "Tell me about artificial intelligence"
    }
  ],
  "stream": false,
  "overrides": {
    "temperature": 0.7,
    "max_tokens": 150,
    "top_p": 0.9,
    "frequency_penalty": 0.1,
    "presence_penalty": 0.1,
    "model": "qwen/qwen3-coder-30b"
  }
}
```

#### **Available Override Parameters**

| Parameter | Type | Range | Description |
|-----------|------|-------|-------------|
| `model` | string | - | Override the default model |
| `temperature` | number | 0-2 | Controls randomness (0 = deterministic, 2 = very random) |
| `max_tokens` | number | >0 | Maximum tokens to generate |
| `top_p` | number | 0-1 | Nucleus sampling parameter |
| `frequency_penalty` | number | -2 to 2 | Reduces repetition of frequent tokens |
| `presence_penalty` | number | -2 to 2 | Reduces repetition of any tokens |
| `stop` | string/array | - | Stop sequences |
| `user` | string | - | User identifier |
| `seed` | number | - | Random seed for reproducibility |
| `response_format` | object | - | Response format configuration |

#### **Response Format (Non-Streaming)**

```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1759137675,
  "model": "qwen/qwen3-coder-30b",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "{\"action\": \"search\", \"params\": {...}}"
      },
      "logprobs": null,
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 948,
    "completion_tokens": 35,
    "total_tokens": 983
  }
}
```

#### **Response Format (Streaming)**

```
data: {"type":"chunk","data":"I'll help you list the files."}
data: {"type":"action","data":{"action":"listFiles","params":{"path":"."}}}
data: {"type":"done"}
```

#### **Response Format (Non-Streaming)**

```json
{
  "chunks": [
    {"type":"chunk","data":"I'll help you list the files."},
    {"type":"action","data":{"action":"listFiles","params":{"path":"."}}},
    {"type":"done"}
  ]
}
```

#### **Event Types**

- `chunk`: Text content from the model
- `action`: Tool call with action and parameters
- `done`: End of response
- `error`: Error occurred during processing

### **2. WebSocket Connection**

**GET** `/ws`

Real-time communication with LM Studio models.

#### **Connection URL**
```
ws://localhost:3001/ws
```

#### **Message Format**

```json
{
  "type": "message",
  "data": {
    "messages": [
      {
        "role": "user",
        "content": "What files are in the sandbox?"
      }
    ]
  }
}
```

#### **Response Format**

Same event types as SSE endpoint, but delivered via WebSocket messages.

### **3. Direct Tool Execution**

**POST** `/call`

Execute tools directly without going through LM Studio.

#### **Request Format**

```json
{
  "action": "listFiles",
  "params": {
    "path": "."
  }
}
```

#### **Response Format**

```json
{
  "result": "file1.txt\nfile2.txt\nscript.js"
}
```

### **4. Tool Discovery**

**GET** `/tools`

Get a list of all available tools with their schemas.

#### **Response Format**

```json
[
  {
    "name": "listFiles",
    "description": "List files in a sandboxed directory",
    "schema": {
      "type": "object",
      "properties": {
        "path": { "type": "string" }
      },
      "required": ["path"]
    }
  }
]
```

## 🛠 **Available Tools (16 Total)**

### **File System Operations (8 tools)**

#### `listFiles`
List files and directories in the sandbox.

```json
{
  "action": "listFiles",
  "params": {
    "path": "."
  }
}
```

#### `files`
Read text content from a file.

```json
{
  "action": "files",
  "params": {
    "path": "example.txt"
  }
}
```

#### `writeFile`
Write text content to a file.

```json
{
  "action": "writeFile",
  "params": {
    "path": "new-file.txt",
    "content": "Hello, World!"
  }
}
```

#### `deleteFile`
Delete a file.

```json
{
  "action": "deleteFile",
  "params": {
    "path": "old-file.txt"
  }
}
```

#### `createDirectory`
Create a directory.

```json
{
  "action": "createDirectory",
  "params": {
    "path": "new-folder",
    "recursive": true
  }
}
```

#### `moveFile`
Move or rename a file or directory.

```json
{
  "action": "moveFile",
  "params": {
    "source": "old-name.txt",
    "destination": "new-name.txt"
  }
}
```

#### `copyFile`
Copy a file or directory.

```json
{
  "action": "copyFile",
  "params": {
    "source": "file1.txt",
    "destination": "file1-copy.txt"
  }
}
```

#### `getFileInfo`
Get detailed information about a file or directory.

```json
{
  "action": "getFileInfo",
  "params": {
    "path": "example.txt"
  }
}
```

### **Search Operations (2 tools)**

#### `grep`
Search for text patterns in files.

```json
{
  "action": "grep",
  "params": {
    "pattern": "function",
    "path": "script.js",
    "caseSensitive": false,
    "wholeWord": false
  }
}
```

#### `findFiles`
Find files by name pattern.

```json
{
  "action": "findFiles",
  "params": {
    "pattern": ".*\\.txt$",
    "directory": ".",
    "includeDirectories": false,
    "maxDepth": 5
  }
}
```

### **System Operations (1 tool)**

#### `executeCommand`
Execute safe shell commands.

```json
{
  "action": "executeCommand",
  "params": {
    "command": "ls",
    "args": ["-la"],
    "timeout": 30000,
    "workingDirectory": "."
  }
}
```

### **Network Operations (1 tool)**

#### `fetch`
Make HTTP requests.

```json
{
  "action": "fetch",
  "params": {
    "url": "https://api.example.com/data"
  }
}
```

### **Archive Operations (2 tools)**

#### `zipFiles`
Create a ZIP archive from multiple files.

```json
{
  "action": "zipFiles",
  "params": {
    "files": ["file1.txt", "file2.txt"],
    "output": "archive.zip"
  }
}
```

#### `unzipFile`
Extract a ZIP archive.

```json
{
  "action": "unzipFile",
  "params": {
    "archive": "archive.zip",
    "outputDir": "extracted"
  }
}
```

### **Utilities (2 tools)**

#### `math`
Evaluate mathematical expressions safely.

```json
{
  "action": "math",
  "params": {
    "expr": "2 + 2 * 3"
  }
}
```

#### `search`
Search the web.

```json
{
  "action": "search",
  "params": {
    "query": "artificial intelligence",
    "engine": "duckduckgo"
  }
}
```

## 🔧 **Integration Examples**

### **1. Basic Chat Integration**

```typescript
// Send a message to LM Studio
const response = await fetch('http://localhost:3000/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    messages: [
      {
        role: 'user',
        content: 'List all files in the current directory and tell me which ones are text files'
      }
    ],
    stream: true
  })
});

// Handle streaming response
const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      
      switch (data.type) {
        case 'chunk':
          console.log('Model output:', data.data);
          break;
        case 'action':
          console.log('Tool call:', data.data);
          // Execute the tool call
          break;
        case 'done':
          console.log('Response complete');
          break;
        case 'error':
          console.error('Error:', data.error);
          break;
      }
    }
  }
}
```

### **2. Chat with LM Studio Overrides**

```typescript
// Send a message with custom LM Studio parameters
const response = await fetch('http://localhost:3000/chat/overrides', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    messages: [
      {
        role: 'user',
        content: 'Write a creative story about a robot'
      }
    ],
    stream: false,
    overrides: {
      temperature: 0.9,        // More creative
      max_tokens: 200,         // Limit length
      top_p: 0.95,             // High nucleus sampling
      frequency_penalty: 0.5,  // Reduce repetition
      presence_penalty: 0.3    // Encourage new topics
    }
  })
});

const data = await response.json();
console.log('Response:', data.choices[0].message.content);
```

### **3. Streaming with Overrides**

```typescript
// Streaming with custom parameters
const response = await fetch('http://localhost:3000/chat/overrides', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    messages: [
      {
        role: 'user',
        content: 'Explain quantum computing'
      }
    ],
    stream: true,
    overrides: {
      temperature: 0.3,        // More focused/technical
      max_tokens: 300,         // Longer response
      top_p: 0.8               // More focused sampling
    }
  })
});

// Handle streaming response (same as basic chat)
const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      
      switch (data.type) {
        case 'chunk':
          console.log('Model output:', data.data);
          break;
        case 'action':
          console.log('Tool call:', data.data);
          break;
        case 'done':
          console.log('Response complete');
          break;
        case 'error':
          console.error('Error:', data.error);
          break;
      }
    }
  }
}
```

### **2. WebSocket Integration**

```typescript
const ws = new WebSocket('ws://localhost:3001/ws');

ws.onopen = () => {
  // Send a message
  ws.send(JSON.stringify({
    type: 'message',
    data: {
      messages: [
        {
          role: 'user',
          content: 'Create a new file called test.txt with some content'
        }
      ]
    }
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case 'chunk':
      console.log('Model output:', data.data);
      break;
    case 'action':
      console.log('Tool call:', data.data);
      break;
    case 'done':
      console.log('Response complete');
      break;
    case 'error':
      console.error('Error:', data.error);
      break;
  }
};
```

### **3. Direct Tool Execution**

```typescript
// Execute a tool directly
const response = await fetch('http://localhost:3000/call', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    action: 'listFiles',
    params: {
      path: '.'
    }
  })
});

const result = await response.json();
console.log('Tool result:', result.result);
```

## 📋 **cURL Examples**

### **1. Basic Chat - Non-Streaming**

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "List all files in the current directory"
      }
    ],
    "stream": false
  }'
```

**Response:**
```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1759137955,
  "model": "qwen/qwen3-coder-30b",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "{\n  \"action\": \"listFiles\",\n  \"params\": {\n    \"path\": \".\"\n  }\n}"
      },
      "logprobs": null,
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 948,
    "completion_tokens": 35,
    "total_tokens": 983
  }
}
```

### **2. Basic Chat - Streaming**

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Search for information about artificial intelligence"
      }
    ],
    "stream": true
  }'
```

**Response:**
```
data: {"type":"chunk","data":"{\n"}
data: {"type":"chunk","data":"  \""}
data: {"type":"chunk","data":"action"}
data: {"type":"chunk","data":"\":"}
data: {"type":"chunk","data":" \""}
data: {"type":"chunk","data":"search"}
data: {"type":"chunk","data":"\",\n"}
data: {"type":"chunk","data":"  \""}
data: {"type":"chunk","data":"params"}
data: {"type":"chunk","data":"\":"}
data: {"type":"chunk","data":" {\n"}
data: {"type":"chunk","data":"   "}
data: {"type":"chunk","data":" \""}
data: {"type":"chunk","data":"query"}
data: {"type":"chunk","data":"\":"}
data: {"type":"chunk","data":" \""}
data: {"type":"chunk","data":"artificial intelligence"}
data: {"type":"chunk","data":"\",\n"}
data: {"type":"chunk","data":"   "}
data: {"type":"chunk","data":" \""}
data: {"type":"chunk","data":"engine"}
data: {"type":"chunk","data":"\":"}
data: {"type":"chunk","data":" \""}
data: {"type":"chunk","data":"duckduckgo"}
data: {"type":"chunk","data":"\"\n"}
data: {"type":"chunk","data":"  }\n"}
data: {"type":"chunk","data":"}"}
data: {"type":"done"}
```

### **3. Chat with Overrides - Non-Streaming**

```bash
curl -X POST http://localhost:3000/chat/overrides \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Write a creative story about a robot"
      }
    ],
    "stream": false,
    "overrides": {
      "temperature": 0.9,
      "max_tokens": 200,
      "top_p": 0.95,
      "frequency_penalty": 0.5,
      "presence_penalty": 0.3
    }
  }'
```

**Response:**
```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1759137955,
  "model": "qwen/qwen3-coder-30b",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "{\n  \"action\": \"writeFile\",\n  \"params\": {\n    \"path\": \"robot_story.txt\",\n    \"content\": \"Once upon a time, in a world where machines had learned to dream...\"\n  }\n}"
      },
      "logprobs": null,
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 951,
    "completion_tokens": 45,
    "total_tokens": 996
  }
}
```

### **4. Chat with Overrides - Streaming**

```bash
curl -X POST http://localhost:3000/chat/overrides \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Explain quantum computing in simple terms"
      }
    ],
    "stream": true,
    "overrides": {
      "temperature": 0.3,
      "max_tokens": 300,
      "top_p": 0.8
    }
  }'
```

**Response:**
```
data: {"type":"chunk","data":"{\n"}
data: {"type":"chunk","data":"  \""}
data: {"type":"chunk","data":"action"}
data: {"type":"chunk","data":"\":"}
data: {"type":"chunk","data":" \""}
data: {"type":"chunk","data":"writeFile"}
data: {"type":"chunk","data":"\",\n"}
data: {"type":"chunk","data":"  \""}
data: {"type":"chunk","data":"params"}
data: {"type":"chunk","data":"\":"}
data: {"type":"chunk","data":" {\n"}
data: {"type":"chunk","data":"   "}
data: {"type":"chunk","data":" \""}
data: {"type":"chunk","data":"path"}
data: {"type":"chunk","data":"\":"}
data: {"type":"chunk","data":" \""}
data: {"type":"chunk","data":"quantum_explanation.txt"}
data: {"type":"chunk","data":"\",\n"}
data: {"type":"chunk","data":"   "}
data: {"type":"chunk","data":" \""}
data: {"type":"chunk","data":"content"}
data: {"type":"chunk","data":"\":"}
data: {"type":"chunk","data":" \""}
data: {"type":"chunk","data":"Quantum computing is like having a computer that can be in multiple states at once..."}
data: {"type":"chunk","data":"\"\n"}
data: {"type":"chunk","data":"  }\n"}
data: {"type":"chunk","data":"}"}
data: {"type":"done"}
```

### **5. Complex Multi-Step Task - Non-Streaming**

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Search for '\''machine learning'\'', then calculate 2+2, then write both results to a file called '\''results.txt'\''"
      }
    ],
    "stream": false
  }'
```

**Response:**
```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1759137955,
  "model": "qwen/qwen3-coder-30b",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "{\n  \"action\": \"search\",\n  \"params\": {\n    \"query\": \"machine learning\"\n  }\n}\n{\n  \"action\": \"math\",\n  \"params\": {\n    \"expr\": \"2+2\"\n  }\n}\n{\n  \"action\": \"writeFile\",\n  \"params\": {\n    \"path\": \"results.txt\",\n    \"content\": \"Search results for '\''machine learning'\'':\\n\\n[Search results would appear here]\\n\\nCalculation result: 2+2=4\"\n  }\n}"
      },
      "logprobs": null,
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 972,
    "completion_tokens": 109,
    "total_tokens": 1081
  }
}
```

### **6. Direct Tool Call**

```bash
curl -X POST http://localhost:3000/call \
  -H "Content-Type: application/json" \
  -d '{
    "action": "grep",
    "params": {
      "pattern": "function",
      "path": "script.js",
      "caseSensitive": false
    }
  }'
```

**Response:**
```json
{
  "result": "function calculateTotal() {\n  return 42;\n}\nfunction processData() {\n  // ...\n}"
}
```

### **7. MCP Tool Call**

```bash
curl -X POST http://localhost:3000/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "tools_call",
    "method": "tools/call",
    "params": {
      "name": "createDirectory",
      "arguments": {
        "path": "new-folder",
        "recursive": true
      }
    },
    "connectionId": "default"
  }'
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": "tools_call",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Directory 'new-folder' created successfully"
      }
    ],
    "isError": false
  }
}
```

### **8. File Operations Examples**

```bash
# Create a directory
curl -X POST http://localhost:3000/call \
  -H "Content-Type: application/json" \
  -d '{"action": "createDirectory", "params": {"path": "test-dir", "recursive": true}}'

# Write a file
curl -X POST http://localhost:3000/call \
  -H "Content-Type: application/json" \
  -d '{"action": "writeFile", "params": {"path": "test.txt", "content": "Hello World"}}'

# List files
curl -X POST http://localhost:3000/call \
  -H "Content-Type: application/json" \
  -d '{"action": "listFiles", "params": {"path": "."}}'

# Read a file
curl -X POST http://localhost:3000/call \
  -H "Content-Type: application/json" \
  -d '{"action": "files", "params": {"path": "test.txt"}}'

# Search in files
curl -X POST http://localhost:3000/call \
  -H "Content-Type: application/json" \
  -d '{"action": "grep", "params": {"pattern": "Hello", "path": "test.txt"}}'

# Calculate math
curl -X POST http://localhost:3000/call \
  -H "Content-Type: application/json" \
  -d '{"action": "math", "params": {"expr": "2 + 2 * 3"}}'

# Web search
curl -X POST http://localhost:3000/call \
  -H "Content-Type: application/json" \
  -d '{"action": "search", "params": {"query": "artificial intelligence", "engine": "duckduckgo"}}'
```

### **9. Override Parameter Examples**

```bash
# High creativity (for creative writing)
curl -X POST http://localhost:3000/chat/overrides \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Write a poem about space"}],
    "stream": false,
    "overrides": {
      "temperature": 1.2,
      "top_p": 0.95,
      "frequency_penalty": 0.8,
      "presence_penalty": 0.6
    }
  }'

# Low creativity (for technical documentation)
curl -X POST http://localhost:3000/chat/overrides \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Explain how HTTP works"}],
    "stream": false,
    "overrides": {
      "temperature": 0.1,
      "top_p": 0.7,
      "frequency_penalty": 0.0,
      "presence_penalty": 0.0
    }
  }'

# Balanced (for general conversation)
curl -X POST http://localhost:3000/chat/overrides \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Tell me about renewable energy"}],
    "stream": false,
    "overrides": {
      "temperature": 0.7,
      "top_p": 0.9,
      "frequency_penalty": 0.2,
      "presence_penalty": 0.1
    }
  }'
```

## ⚙️ **Configuration**

### **Environment Variables**

| Variable | Default | Description |
|----------|---------|-------------|
| `LM_STUDIO_URL` | `http://localhost:1234` | LM Studio API URL |
| `LM_STUDIO_MODEL` | `qwen3-coder-30b` | LM Studio model name |
| `PORT` | `3000` | HTTP server port |
| `WS_PORT` | `3001` | WebSocket server port |
| `SANDBOX_DIR` | `./sandbox` | Sandbox directory for file operations |

### **Model Configuration**

The wrapper automatically configures LM Studio requests with:

```typescript
{
  model: process.env.LM_STUDIO_MODEL || "qwen/qwen3-coder-30b",
  messages: [...],
  stream: true
}
```

**Note:** The `response_format` parameter is not supported by LM Studio, so JSON output is enforced through system prompts.

## 🔒 **Security Features**

### **Sandboxed Operations**
- All file operations restricted to configurable sandbox directory
- Path traversal protection prevents directory escaping
- No access to system files outside the sandbox

### **Command Execution Safety**
- `executeCommand` tool limited to safe commands only
- Timeout protection for long-running commands
- No arbitrary shell access

### **Input Validation**
- JSON schema validation for all tool parameters
- Type-safe TypeScript implementation
- Comprehensive error handling

## 🚀 **Getting Started**

### **1. Start LM Studio**
Ensure LM Studio is running on `http://localhost:1234` with your desired model loaded.

### **2. Start the Wrapper**
```bash
# Install dependencies
bun install

# Start the wrapper
bun run dev

# Or with custom configuration
LM_STUDIO_MODEL="llama-3.1-8b" SANDBOX_DIR="/tmp/sandbox" bun run dev
```

### **3. Test the Integration**
```bash
# Test tool discovery
curl http://localhost:3000/tools

# Test chat completion
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "List files in the current directory"}],
    "stream": true
  }'
```

## 🔄 **Event Protocol**

All communication uses a consistent JSON event format:

```json
{"type":"chunk","data":"..."}        // Model output
{"type":"action","data":{...}}       // Tool calls
{"type":"done"}                      // Stream end
{"type":"error","error":"..."}       // Error messages
```

## 📊 **Performance Features**

- **Efficient Tool Loading** - Dynamic loading with error handling
- **Request Timeouts** - Configurable timeouts prevent hanging
- **Rate Limiting** - Built-in protection against abuse
- **Circuit Breaker** - Automatic failure detection and recovery
- **Structured Logging** - JSON-formatted logs with levels

## 🎯 **Best Practices**

### **1. Model Selection**
Choose models that are good at following structured output instructions:
- Code-focused models (like `qwen3-coder-30b`)
- Models trained on structured data
- Models with good instruction-following capabilities

### **2. Prompt Engineering**
- Be specific about what tools to use
- Provide clear context about the task
- Use examples when possible

### **3. Error Handling**
- Always handle both `chunk` and `action` events
- Implement proper error handling for tool execution
- Use timeouts for long-running operations

### **4. Security**
- Never expose the wrapper to untrusted networks
- Use appropriate sandbox directories
- Monitor tool usage and implement rate limiting

## 🔮 **Future Enhancements**

- Automatic tool-call loop execution
- WebSocket auto-reconnect in client SDK
- Persistent conversation state with history
- Context window management
- Additional tool categories (database, cloud services)

## 📚 **Additional Resources**

- [Full API Documentation](./API.md) - Complete API reference
- [Quick Start Guide](./QUICKSTART.md) - Getting started quickly
- [OpenAPI Specification](./openapi.yaml) - Machine-readable API spec
- [Insomnia Collection](./insomnia.json) - API testing collection
- [Postman Collection](./postman_collection.json) - Postman collection

---

**Built with ❤️ using Bun, TypeScript, and Hono**
