# API Documentation

## Overview

The LM Studio Internet Wrapper provides a comprehensive API for integrating local LLMs with external tools and services. The API supports multiple protocols including REST, WebSocket, and MCP (Model Context Protocol).

## Base URL

- **Development**: `http://localhost:3000`
- **Production**: Configure via `PORT` environment variable

## Authentication

Currently, no authentication is required. All endpoints are publicly accessible.

## Response Format

All API responses follow a consistent JSON format:

### Success Response

```json
{
  "result": "Tool execution result"
}
```

### Error Response

```json
{
  "error": "Error message describing what went wrong"
}
```

### MCP Response

```json
{
  "jsonrpc": "2.0",
  "id": "request_id",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Tool execution result"
      }
    ],
    "isError": false
  }
}
```

## Core Endpoints

### 1. List Available Tools

**GET** `/tools`

Returns a list of all available tools with their schemas.

**Response:**

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

### 2. Execute Tool (Direct Call)

**POST** `/call`

Execute a tool directly using the simplified API.

**Request Body:**

```json
{
  "action": "tool_name",
  "params": {
    "param1": "value1",
    "param2": "value2"
  }
}
```

**Example:**

```json
{
  "action": "listFiles",
  "params": {
    "path": "."
  }
}
```

### 3. Chat with LM Studio

**POST** `/chat`

Send messages to LM Studio and receive responses. Supports both streaming and non-streaming responses.

**Request Body:**

```json
{
  "messages": [
    {
      "role": "user",
      "content": "Hello, can you help me list files?"
    }
  ],
  "stream": true
}
```

**Response (Streaming):**

```
data: {"type":"chunk","data":"I'll help you list files."}
data: {"type":"action","data":{"action":"listFiles","params":{"path":"."}}}
data: {"type":"done"}
```

### 4. WebSocket Connection

**GET** `/ws`

Establish a WebSocket connection for real-time communication.

**Connection URL:** `ws://localhost:3001/ws`

**Message Format:**

```json
{
  "type": "message",
  "data": {
    "messages": [...]
  }
}
```

## MCP Endpoints

### 1. Initialize MCP Connection

**POST** `/mcp/initialize`

Initialize a new MCP connection.

**Request Body:**

```json
{
  "jsonrpc": "2.0",
  "id": "init",
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "My App",
      "version": "1.0.0"
    }
  }
}
```

### 2. List MCP Tools

**POST** `/mcp/tools/list`

Get a list of available tools via MCP protocol.

**Request Body:**

```json
{
  "jsonrpc": "2.0",
  "id": "tools_list",
  "method": "tools/list"
}
```

### 3. Call MCP Tool

**POST** `/mcp/tools/call`

Execute a tool via MCP protocol.

**Request Body:**

```json
{
  "jsonrpc": "2.0",
  "id": "tools_call",
  "method": "tools/call",
  "params": {
    "name": "listFiles",
    "arguments": {
      "path": "."
    }
  },
  "connectionId": "default"
}
```

### 4. List MCP Resources

**POST** `/mcp/resources/list`

List available resources (files) via MCP protocol.

**Request Body:**

```json
{
  "jsonrpc": "2.0",
  "id": "resources_list",
  "method": "resources/list"
}
```

### 5. Read MCP Resource

**POST** `/mcp/resources/read`

Read a resource (file) via MCP protocol.

**Request Body:**

```json
{
  "jsonrpc": "2.0",
  "id": "resources_read",
  "method": "resources/read",
  "params": {
    "uri": "example.txt"
  }
}
```

## Available Tools

### File System Operations

#### `listFiles`

List files and directories in the sandbox.

**Parameters:**

- `path` (string, required): Directory path to list

**Example:**

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

**Parameters:**

- `path` (string, required): File path to read

**Example:**

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

**Parameters:**

- `path` (string, required): File path to write
- `content` (string, required): Content to write

**Example:**

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

**Parameters:**

- `path` (string, required): File path to delete

**Example:**

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

**Parameters:**

- `path` (string, required): Directory path to create
- `recursive` (boolean, optional): Create parent directories if needed

**Example:**

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

**Parameters:**

- `source` (string, required): Source path
- `destination` (string, required): Destination path

**Example:**

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

**Parameters:**

- `source` (string, required): Source path
- `destination` (string, required): Destination path

**Example:**

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

**Parameters:**

- `path` (string, required): File or directory path

**Example:**

```json
{
  "action": "getFileInfo",
  "params": {
    "path": "example.txt"
  }
}
```

### Search Operations

#### `grep`

Search for text patterns in files.

**Parameters:**

- `pattern` (string, required): Search pattern (regex supported)
- `path` (string, required): File path to search
- `caseSensitive` (boolean, optional): Case-sensitive search
- `wholeWord` (boolean, optional): Whole word matching

**Example:**

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

**Parameters:**

- `pattern` (string, required): File name pattern (regex)
- `directory` (string, optional): Directory to search in
- `includeDirectories` (boolean, optional): Include directories in results
- `maxDepth` (number, optional): Maximum search depth

**Example:**

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

### System Operations

#### `executeCommand`

Execute a safe shell command.

**Parameters:**

- `command` (string, required): Command to execute
- `args` (array, optional): Command arguments
- `timeout` (number, optional): Timeout in milliseconds
- `workingDirectory` (string, optional): Working directory

**Example:**

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

### Network Operations

#### `fetch`

Make HTTP requests.

**Parameters:**

- `url` (string, required): URL to fetch

**Example:**

```json
{
  "action": "fetch",
  "params": {
    "url": "https://api.example.com/data"
  }
}
```

#### `search`

Search the web.

**Parameters:**

- `query` (string, required): Search query
- `engine` (string, optional): Search engine (duckduckgo only) - defaults to duckduckgo

**Example:**

```json
{
  "action": "search",
  "params": {
    "query": "artificial intelligence",
    "engine": "duckduckgo"
  }
}
```

### Archive Operations

#### `zipFiles`

Create a ZIP archive from multiple files.

**Parameters:**

- `files` (array, required): Array of file paths to compress
- `output` (string, required): Output ZIP file path

**Example:**

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

**Parameters:**

- `archive` (string, required): ZIP file path
- `outputDir` (string, required): Directory to extract to

**Example:**

```json
{
  "action": "unzipFile",
  "params": {
    "archive": "archive.zip",
    "outputDir": "extracted"
  }
}
```

### Utilities

#### `math`

Evaluate mathematical expressions safely.

**Parameters:**

- `expr` (string, required): Mathematical expression

**Example:**

```json
{
  "action": "math",
  "params": {
    "expr": "2 + 2 * 3"
  }
}
```

## Error Handling

### Common Error Codes

- **400 Bad Request**: Invalid request format or missing required parameters
- **404 Not Found**: Tool or resource not found
- **500 Internal Server Error**: Server error or tool execution failure

### Error Response Format

```json
{
  "error": "Detailed error message",
  "code": "ERROR_CODE",
  "details": {
    "tool": "tool_name",
    "params": {...}
  }
}
```

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Default**: 100 requests per minute per IP
- **Configurable**: Via `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS` environment variables

## Security Considerations

### Sandboxed Operations

- All file operations are restricted to the configured sandbox directory
- Path traversal attacks are prevented
- No access to system files outside the sandbox

### Command Execution

- Only safe commands are allowed in `executeCommand`
- Commands are restricted to a predefined allowlist
- Timeout protection prevents hanging processes

### Input Validation

- All parameters are validated against JSON schemas
- Type checking ensures parameter types are correct
- Malformed requests are rejected with clear error messages

## Testing

### Using cURL

```bash
# List tools
curl http://localhost:3000/tools

# Execute a tool
curl -X POST http://localhost:3000/call \
  -H "Content-Type: application/json" \
  -d '{"action": "listFiles", "params": {"path": "."}}'
```

### Using the API Collections

1. **Insomnia**: Import `insomnia.json`
2. **Postman**: Import `postman_collection.json`
3. **Swagger UI**: Visit `http://localhost:3000/docs/`

## Configuration

### Environment Variables

| Variable               | Default                 | Description                           |
| ---------------------- | ----------------------- | ------------------------------------- |
| `PORT`                 | `3000`                  | HTTP server port                      |
| `WS_PORT`              | `3001`                  | WebSocket server port                 |
| `LM_STUDIO_URL`        | `http://localhost:1234` | LM Studio API URL                     |
| `LM_STUDIO_MODEL`      | `qwen3-coder-30b`       | LM Studio model name                  |
| `SANDBOX_DIR`          | `./sandbox`             | Sandbox directory for file operations |
| `LOG_LEVEL`            | `info`                  | Logging level                         |
| `RATE_LIMIT_MAX`       | `100`                   | Rate limit per window                 |
| `RATE_LIMIT_WINDOW_MS` | `60000`                 | Rate limit window in milliseconds     |

### Example Configuration

```bash
# Development
PORT=3000 WS_PORT=3001 SANDBOX_DIR="./sandbox" bun run dev

# Production
PORT=8080 WS_PORT=8081 SANDBOX_DIR="/var/sandbox" LM_STUDIO_MODEL="llama-3.1-8b" bun run start
```
