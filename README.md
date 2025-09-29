# LM Studio Internet Wrapper

A **production-ready** MCP (Model Context Protocol) compliant tool system that extends LM Studio's capabilities beyond its normal restrictions. This wrapper enables local LLMs to interact with external systems, access the internet, and manipulate files through a standardized, secure interface.

## 🚀 **Key Features**

- ✅ **16 High-Priority Tools** - Comprehensive toolset for file operations, search, and system commands
- ✅ **MCP Compliance** - Full Model Context Protocol implementation
- ✅ **Production Ready** - PM2 deployment, monitoring, and error handling
- ✅ **Security First** - Sandboxed operations with path traversal protection
- ✅ **Multiple Protocols** - SSE, WebSocket, and MCP endpoints
- ✅ **Complete Documentation** - OpenAPI, Insomnia, and Postman collections

## 🛠 **Available Tools (16 Total)**

### **File System Operations (8)**

- `listFiles` - List files and directories
- `files` - Read file content
- `writeFile` - Write text to files
- `deleteFile` - Delete files
- `createDirectory` - Create directories (with recursive option)
- `moveFile` - Move/rename files and directories
- `copyFile` - Copy files and directories (recursive)
- `getFileInfo` - Get detailed file metadata

### **Search & Discovery (2)**

- `grep` - Search for text patterns in files with regex support
- `findFiles` - Find files by name patterns with depth control

### **System Operations (1)**

- `executeCommand` - Execute safe shell commands with restrictions

### **Network Operations (1)**

- `fetch` - HTTP request capabilities

### **Archive Operations (2)**

- `zipFiles` - Create ZIP archives from multiple files
- `unzipFile` - Extract ZIP archives

### **Utilities (2)**

- `math` - Safe mathematical expression evaluation
- `search` - Web search with multiple engine support

## 🚀 **Quick Start**

### **1. Installation**

```bash
# Clone the repository
git clone <repository-url>
cd lmstudio-internet-wrapper

# Install dependencies
bun install
```

### **2. Configuration**

The sandbox directory is configurable via environment variables:

| Variable          | Default                 | Description                             |
| ----------------- | ----------------------- | --------------------------------------- |
| `SANDBOX_DIR`     | `./sandbox`             | Directory for sandboxed file operations |
| `PORT`            | `3000`                  | HTTP server port                        |
| `WS_PORT`         | `3001`                  | WebSocket server port                   |
| `LM_STUDIO_URL`   | `http://localhost:1234` | LM Studio API URL                       |
| `LM_STUDIO_MODEL` | `qwen3-coder-30b`       | LM Studio model name                    |

### **3. Start the Server**

```bash
# Development mode
bun run dev

# Production mode
bun run start

# With custom sandbox directory
SANDBOX_DIR="/tmp/my-sandbox" bun run server.ts

# With custom model
LM_STUDIO_MODEL="llama-3.1-8b" bun run server.ts

# With custom ports, sandbox, and model
PORT=8080 WS_PORT=8081 SANDBOX_DIR="/var/sandbox" LM_STUDIO_MODEL="llama-3.1-8b" bun run server.ts
```

### **4. Test the API**

```bash
# List available tools
curl http://localhost:3000/tools

# Test a tool call
curl -X POST http://localhost:3000/call \
  -H "Content-Type: application/json" \
  -d '{"action": "listFiles", "params": {"path": "."}}'
```

## 📚 **API Documentation**

### **Interactive Documentation**

Access the interactive API documentation:

- **Swagger UI**: http://localhost:3000/docs/
- **OpenAPI Spec**: http://localhost:3000/openapi.json

### **API Testing Tools**

- **Insomnia**: Import `insomnia.json` collection
- **Postman**: Import `postman_collection.json` collection

## 🔧 **API Endpoints**

### **Core Endpoints**

- `POST /chat` - Chat with LM Studio (SSE and JSON)
- `GET /ws` - WebSocket endpoint for real-time chat
- `GET /tools` - List available tools
- `POST /call` - Execute a specific tool

### **MCP Endpoints**

- `POST /mcp/initialize` - Initialize MCP connection
- `POST /mcp/tools/list` - List MCP tools
- `POST /mcp/tools/call` - Call MCP tool
- `POST /mcp/resources/list` - List MCP resources
- `POST /mcp/resources/read` - Read MCP resource

## 🔒 **Security Features**

### **Sandboxed Operations**

- All file operations restricted to configurable sandbox directory
- Path traversal protection prevents directory escaping
- Automatic sandbox directory creation

### **Command Execution Safety**

- `executeCommand` tool limited to safe commands only
- Timeout protection for long-running commands
- No arbitrary shell access

### **Input Validation**

- JSON schema validation for all tool parameters
- Type-safe TypeScript implementation
- Comprehensive error handling

## 🏗 **Architecture**

### **Server Components**

- **Bun + Hono** - High-performance web framework
- **TypeScript** - Full type safety throughout
- **MCP Protocol** - Standardized tool integration
- **Dynamic Tool Loading** - Recursive tool discovery

### **Tool System**

```
tools/
├── filesystem/     # File operations (8 tools)
├── search/         # Search and discovery (2 tools)
├── system/         # System commands (1 tool)
├── network/        # Network operations (1 tool)
├── archive/        # Archive operations (2 tools)
└── math/           # Utilities (2 tools)
```

### **Configuration Management**

- Environment-based configuration with Zod validation
- Home directory expansion (`~` support)
- Configurable timeouts and retry policies

## 🚀 **Production Deployment**

### **PM2 Setup**

```bash
# Automated setup
./scripts/pm2-setup.sh

# Manual setup
bun run pm2:start:prod
bun run pm2:startup
bun run pm2:save
```

### **PM2 Management**

```bash
# Application control
bun run pm2:start        # Start application
bun run pm2:stop         # Stop application
bun run pm2:restart      # Restart application
bun run pm2:reload       # Zero-downtime reload

# Monitoring
bun run pm2:status       # Check status
bun run pm2:logs         # View logs
bun run pm2:monit        # Open monitoring dashboard
```

### **Quality Assurance**

```bash
# Run all quality checks
bun run quality:check

# Individual checks
bun run format:check     # Code formatting
bun run lint            # ESLint checks
bun run type-check      # TypeScript validation
```

## 📖 **Usage Examples**

### **Basic Tool Call**

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

### **MCP Tool Call**

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

### **File Operations**

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
```

## 🔧 **Development**

### **Requirements**

- Bun runtime
- TypeScript
- LM Studio running locally
- PM2 (for production deployment)

### **Development Commands**

```bash
# Start development server
bun run dev

# Run quality checks
bun run quality:check

# Format code
bun run format

# Fix linting issues
bun run lint:fix

# Type check
bun run type-check
```

### **Adding New Tools**

1. Create a new file in the appropriate `tools/` subdirectory
2. Follow the tool interface:

```typescript
export const name = "myTool";
export const description = "Tool description";
export const schema = {
  type: "object",
  properties: {
    param1: { type: "string" },
  },
  required: ["param1"],
};

export async function run(params: { param1: string }): Promise<string> {
  // Tool implementation
  return "Tool result";
}
```

3. The tool will be automatically discovered and loaded

## 📊 **Project Structure**

```
lmstudio-internet-wrapper/
├── server.ts              # Main server implementation
├── client.ts              # TypeScript SDK
├── config.ts              # Configuration management
├── sandbox.ts             # Sandbox security layer
├── tools/                 # Tool implementations
│   ├── filesystem/        # File operations (8 tools)
│   ├── search/           # Search tools (2 tools)
│   ├── system/           # System commands (1 tool)
│   ├── network/          # Network operations (1 tool)
│   ├── archive/          # Archive operations (2 tools)
│   └── math/             # Utilities (2 tools)
├── mcp/                  # MCP protocol implementation
├── utils/                # Utility functions
├── middleware.ts         # Express middleware
├── openapi.yaml         # OpenAPI specification
├── insomnia.json        # Insomnia collection
├── postman_collection.json # Postman collection
└── README.md            # This file
```

## 🎯 **Integration with LM Studio**

### **1. Force Structured Output**

```typescript
const request = {
  model: "qwen3-coder-30b", // Configurable via LM_STUDIO_MODEL env var
  messages: [...yourMessages],
  response_format: { type: "json_object" },
};
```

### **2. System Prompt Engineering**

```typescript
const systemPrompt = `You are a tool-using model.
ALWAYS respond in this JSON format only:
{
  "action": "tool_name",
  "params": { 
    // parameters matching the tool's schema
  }
}`;
```

### **3. Response Handling**

```typescript
try {
  const json = JSON.parse(modelOutput);
  if (json.action && json.params) {
    const result = await executeTool(json.action, json.params);
  }
} catch {
  // Handle free-form text as needed
}
```

## 🔄 **Event Protocol**

All communication uses a consistent JSON event format:

```json
{"type":"chunk","data":"..."}        // Model output
{"type":"action","data":{...}}       // Tool calls
{"type":"done"}                      // Stream end
{"type":"error","error":"..."}       // Error messages
```

## 🚀 **Performance Features**

- **Efficient Tool Loading** - Dynamic loading with error handling
- **Request Timeouts** - Configurable timeouts prevent hanging
- **Rate Limiting** - Built-in protection against abuse
- **Circuit Breaker** - Automatic failure detection and recovery
- **Structured Logging** - JSON-formatted logs with levels

## 📈 **Monitoring & Health Checks**

- **Health Endpoint** - `/health` for monitoring
- **Request Tracking** - Full request/response logging
- **PM2 Integration** - Process monitoring and auto-restart
- **Log Management** - Automatic log rotation and cleanup

## 🔮 **Future Development**

- Automatic tool-call loop execution
- WebSocket auto-reconnect in client SDK
- Persistent conversation state with history
- Context window management
- Additional tool categories (database, cloud services)

## 📄 **License**

ISC License - See package.json for details

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run quality checks: `bun run quality:check`
5. Submit a pull request

---

**Built with ❤️ using Bun, TypeScript, and Hono**
