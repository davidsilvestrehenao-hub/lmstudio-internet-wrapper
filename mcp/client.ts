// MCP Client implementation for LM Studio integration
import {
  MCPTool,
  MCPResource,
  MCPPrompt,
  MCPToolCall,
  MCPToolResult,
  MCPResourceContents,
  MCPPromptResult,
} from "./types.js";
import { logger } from "../logger.js";

export class MCPClient {
  private connectionId: string;
  private tools: MCPTool[] = [];
  private resources: MCPResource[] = [];
  private prompts: MCPPrompt[] = [];
  private isInitialized = false;

  constructor(connectionId: string) {
    this.connectionId = connectionId;
  }

  // Initialize MCP client
  async initialize(): Promise<void> {
    try {
      // In a real implementation, this would connect to an MCP server
      // For now, we'll simulate the initialization
      this.isInitialized = true;
      logger.info(`MCP client initialized: ${this.connectionId}`);
    } catch (error) {
      logger.error("Failed to initialize MCP client", { error });
      throw error;
    }
  }

  // List available tools
  async listTools(): Promise<MCPTool[]> {
    if (!this.isInitialized) {
      throw new Error("MCP client not initialized");
    }

    // In a real implementation, this would make a request to the MCP server
    // For now, we'll return the tools we have
    return this.tools;
  }

  // Call a tool
  async callTool(toolCall: MCPToolCall): Promise<MCPToolResult> {
    if (!this.isInitialized) {
      throw new Error("MCP client not initialized");
    }

    // In a real implementation, this would make a request to the MCP server
    // For now, we'll simulate the tool call
    const tool = this.tools.find((t) => t.name === toolCall.name);
    if (!tool) {
      throw new Error(`Tool '${toolCall.name}' not found`);
    }

    // This would be handled by the MCP server in a real implementation
    return {
      content: [
        {
          type: "text",
          text: `Tool '${toolCall.name}' called with arguments: ${JSON.stringify(toolCall.arguments)}`,
        },
      ],
      isError: false,
    };
  }

  // List available resources
  async listResources(): Promise<MCPResource[]> {
    if (!this.isInitialized) {
      throw new Error("MCP client not initialized");
    }

    return this.resources;
  }

  // Read a resource
  async readResource(uri: string): Promise<MCPResourceContents> {
    if (!this.isInitialized) {
      throw new Error("MCP client not initialized");
    }

    const resource = this.resources.find((r) => r.uri === uri);
    if (!resource) {
      throw new Error(`Resource '${uri}' not found`);
    }

    // In a real implementation, this would make a request to the MCP server
    return {
      uri,
      mimeType: resource.mimeType || "text/plain",
      text: `Content of resource: ${uri}`,
    };
  }

  // List available prompts
  async listPrompts(): Promise<MCPPrompt[]> {
    if (!this.isInitialized) {
      throw new Error("MCP client not initialized");
    }

    return this.prompts;
  }

  // Get a prompt
  async getPrompt(name: string): Promise<MCPPromptResult> {
    if (!this.isInitialized) {
      throw new Error("MCP client not initialized");
    }

    const prompt = this.prompts.find((p) => p.name === name);
    if (!prompt) {
      throw new Error(`Prompt '${name}' not found`);
    }

    // In a real implementation, this would make a request to the MCP server
    return {
      description: prompt.description,
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Execute prompt: ${name}`,
          },
        },
      ],
    };
  }

  // Set tools (for integration with our existing system)
  setTools(tools: MCPTool[]) {
    this.tools = tools;
  }

  // Set resources (for integration with our existing system)
  setResources(resources: MCPResource[]) {
    this.resources = resources;
  }

  // Set prompts (for integration with our existing system)
  setPrompts(prompts: MCPPrompt[]) {
    this.prompts = prompts;
  }

  // Convert our existing tool format to MCP format
  convertToolsToMCP(
    existingTools: Record<
      string,
      {
        name: string;
        description: string;
        schema: { properties?: Record<string, unknown>; required?: string[] };
      }
    >,
  ): MCPTool[] {
    return Object.values(existingTools).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: {
        type: "object",
        properties: tool.schema.properties || {},
        required: tool.schema.required || [],
      },
    }));
  }

  // Convert MCP tool call to our existing format
  convertToolCallToExisting(mcpToolCall: MCPToolCall): {
    action: string;
    params: Record<string, unknown>;
  } {
    return {
      action: mcpToolCall.name,
      params: mcpToolCall.arguments,
    };
  }

  // Convert our existing tool result to MCP format
  convertResultToMCP(result: string, isError = false): MCPToolResult {
    return {
      content: [
        {
          type: "text",
          text: result,
        },
      ],
      isError,
    };
  }

  // Generate system prompt with MCP tools
  generateSystemPrompt(): string {
    const toolDescriptions = this.tools
      .map((tool) => {
        const params = Object.entries(tool.inputSchema.properties || {})
          .map(([key, schema]: [string, unknown]) => {
            const required = tool.inputSchema.required?.includes(key)
              ? " (required)"
              : " (optional)";
            return `    ${key}: ${(schema as { type?: string })?.type || "unknown"}${required}`;
          })
          .join("\n");

        return `- ${tool.name}: ${tool.description}\n  Parameters:\n${params}`;
      })
      .join("\n");

    return `You are a tool-using model with access to the following tools via MCP (Model Context Protocol).

Always respond with valid JSON in this exact format:
{
  "action": "tool_name",
  "params": {
    "parameter_name": "value"
  }
}

Available tools:
${toolDescriptions}

No narration, no natural language — just structured JSON tool calls.`;
  }

  // Check if client is initialized
  get initialized(): boolean {
    return this.isInitialized;
  }

  // Get connection ID
  get id(): string {
    return this.connectionId;
  }
}

// Factory function to create MCP client
export function createMCPClient(connectionId: string): MCPClient {
  return new MCPClient(connectionId);
}
