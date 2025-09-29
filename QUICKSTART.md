# Quick Start Guide

Get up and running with the LM Studio Internet Wrapper in under 5 minutes!

## 🚀 **Prerequisites**

- [Bun](https://bun.sh) installed
- [LM Studio](https://lmstudio.ai) running locally
- Basic familiarity with command line

## ⚡ **1. Installation**

```bash
# Clone the repository
git clone <repository-url>
cd lmstudio-internet-wrapper

# Install dependencies
bun install
```

## ⚡ **2. Start LM Studio**

1. Open LM Studio
2. Load any model you prefer
3. Start the local server on port 1234 (default)
4. Verify it's running at `http://localhost:1234`

## ⚡ **3. Start the Wrapper**

```bash
# Start the wrapper server
bun run dev
```

You should see:

```
[INFO] Loading tools...
[INFO] Loaded tool: listFiles
[INFO] Loaded tool: files
... (16 tools total)
[INFO] Server running on http://localhost:3000
```

## ⚡ **4. Test the API**

### Quick Test

```bash
# List available tools
curl http://localhost:3000/tools

# Test a simple tool
curl -X POST http://localhost:3000/call \
  -H "Content-Type: application/json" \
  -d '{"action": "listFiles", "params": {"path": "."}}'
```

### Expected Response

```json
[
  {
    "name": "file1.txt",
    "type": "file"
  },
  {
    "name": "script.js",
    "type": "file"
  }
]
```

## ⚡ **5. Explore the Tools**

### File Operations

```bash
# Create a directory
curl -X POST http://localhost:3000/call \
  -H "Content-Type: application/json" \
  -d '{"action": "createDirectory", "params": {"path": "test-dir", "recursive": true}}'

# Write a file
curl -X POST http://localhost:3000/call \
  -H "Content-Type: application/json" \
  -d '{"action": "writeFile", "params": {"path": "test.txt", "content": "Hello World!"}}'

# Read the file
curl -X POST http://localhost:3000/call \
  -H "Content-Type: application/json" \
  -d '{"action": "files", "params": {"path": "test.txt"}}'
```

### Search Operations

```bash
# Search for text in files
curl -X POST http://localhost:3000/call \
  -H "Content-Type: application/json" \
  -d '{"action": "grep", "params": {"pattern": "function", "path": "script.js"}}'

# Find files by pattern
curl -X POST http://localhost:3000/call \
  -H "Content-Type: application/json" \
  -d '{"action": "findFiles", "params": {"pattern": ".*\\.txt$"}}'
```

### System Operations

```bash
# Execute a safe command
curl -X POST http://localhost:3000/call \
  -H "Content-Type: application/json" \
  -d '{"action": "executeCommand", "params": {"command": "ls", "args": ["-la"]}}'
```

## ⚡ **6. Use with LM Studio**

### Method 1: Direct API Integration

Configure your LM Studio client to use the wrapper:

```typescript
// Example client code
const response = await fetch("http://localhost:3000/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    messages: [
      { role: "user", content: "List the files in the current directory" },
    ],
    stream: false,
  }),
});
```

### Method 2: MCP Protocol

Use the MCP-compliant endpoints:

```bash
# Initialize MCP connection
curl -X POST http://localhost:3000/mcp/initialize \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "init",
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "My App", "version": "1.0.0"}
    }
  }'

# Call a tool via MCP
curl -X POST http://localhost:3000/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "tools_call",
    "method": "tools/call",
    "params": {
      "name": "listFiles",
      "arguments": {"path": "."}
    },
    "connectionId": "default"
  }'
```

## ⚡ **7. Explore the Documentation**

### Interactive API Documentation

Visit: http://localhost:3000/docs/

### Import API Collections

- **Insomnia**: Import `insomnia.json`
- **Postman**: Import `postman_collection.json`

## ⚡ **8. Production Deployment**

### Using PM2

```bash
# Start in production mode
bun run pm2:start:prod

# Check status
bun run pm2:status

# View logs
bun run pm2:logs
```

### Environment Configuration

```bash
# Custom configuration
PORT=8080 WS_PORT=8081 SANDBOX_DIR="/var/sandbox" LM_STUDIO_MODEL="llama-3.1-8b" bun run start
```

## 🎯 **Next Steps**

### 1. **Explore All 16 Tools**

- File system operations (8 tools)
- Search and discovery (2 tools)
- System commands (1 tool)
- Network operations (1 tool)
- Archive operations (2 tools)
- Utilities (2 tools)

### 2. **Integrate with Your Application**

- Use the TypeScript SDK (`client.ts`)
- Implement WebSocket connections for real-time chat
- Set up proper error handling and retry logic

### 3. **Customize for Your Needs**

- Add custom tools in the `tools/` directory
- Configure different sandbox directories
- Set up monitoring and logging

### 4. **Advanced Features**

- Use MCP protocol for standardized integration
- Implement conversation state management
- Set up automated tool-call loops

## 🔧 **Troubleshooting**

### Common Issues

**Server won't start:**

```bash
# Check if port is in use
lsof -i :3000

# Try different port
PORT=3001 bun run dev
```

**LM Studio connection failed:**

```bash
# Verify LM Studio is running
curl http://localhost:1234/v1/models

# Check LM Studio URL in config
LM_STUDIO_URL="http://localhost:1234" bun run dev
```

**Tool execution errors:**

```bash
# Check sandbox directory permissions
ls -la ./sandbox

# Verify tool parameters
curl -X POST http://localhost:3000/tools
```

### Getting Help

1. **Check the logs**: Look for error messages in the console
2. **Verify configuration**: Ensure all environment variables are correct
3. **Test individual tools**: Use the API documentation to test each tool
4. **Check LM Studio**: Ensure LM Studio is running and accessible

## 📚 **Additional Resources**

- **Full Documentation**: [README.md](./README.md)
- **API Reference**: [API.md](./API.md)
- **Changelog**: [CHANGELOG.md](./CHANGELOG.md)
- **OpenAPI Spec**: http://localhost:3000/openapi.json

## 🎉 **You're Ready!**

You now have a fully functional LM Studio Internet Wrapper with 16 powerful tools at your disposal. Start building amazing AI applications that can interact with the outside world!

---

**Need help?** Check the troubleshooting section or explore the comprehensive documentation.
