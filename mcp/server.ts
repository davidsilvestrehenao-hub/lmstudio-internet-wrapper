// MCP Server implementation for our LM Studio wrapper
import {
  MCPTool,
  MCPResource,
  MCPPrompt,
  MCPToolCall,
  MCPToolResult,
  MCPResourceContents,
  MCPPromptResult,
  MCPServerCapabilities,
  MCPConnection,
} from "./types.js";
import { logger } from "../logger.js";

// Our existing tool interface
type Tool = {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  run: (params: Record<string, unknown>) => Promise<string>;
};

export class MCPServer {
  private connections = new Map<string, MCPConnection>();
  private tools: MCPTool[] = [];
  private resources: MCPResource[] = [];
  private prompts: MCPPrompt[] = [];

  constructor() {
    this.initializeDefaultPrompts();
  }

  // Initialize MCP connection
  async initializeConnection(connectionId: string): Promise<MCPConnection> {
    const capabilities: MCPServerCapabilities = {
      tools: {
        listChanged: true,
      },
      resources: {
        subscribe: true,
        listChanged: true,
      },
      prompts: {
        listChanged: true,
      },
      logging: {},
    };

    const connection: MCPConnection = {
      id: connectionId,
      capabilities,
      tools: this.tools,
      resources: this.resources,
      prompts: this.prompts,
      isInitialized: true,
    };

    this.connections.set(connectionId, connection);
    logger.info(`MCP connection initialized: ${connectionId}`);

    return connection;
  }

  // Register tools from our existing tool system
  registerTools(existingTools: Record<string, Tool>) {
    this.tools = Object.values(existingTools).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: {
        type: "object",
        properties: (tool.schema.properties as Record<string, unknown>) || {},
        required: Array.isArray(tool.schema.required)
          ? tool.schema.required
          : [],
      },
    }));

    // Update all connections
    for (const connection of this.connections.values()) {
      connection.tools = this.tools;
    }

    logger.info(`Registered ${this.tools.length} MCP tools`);
  }

  // Register resources (files, documents)
  registerResources(resourceList: MCPResource[]) {
    this.resources = resourceList;

    // Update all connections
    for (const connection of this.connections.values()) {
      connection.resources = this.resources;
    }

    logger.info(`Registered ${this.resources.length} MCP resources`);
  }

  // Handle MCP tool list request
  async handleToolsList(connectionId: string): Promise<MCPTool[]> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error("Connection not found");
    }

    return connection.tools;
  }

  // Handle MCP tool call request
  async handleToolCall(
    connectionId: string,
    toolCall: MCPToolCall,
    toolRunner: (
      name: string,
      params: Record<string, unknown>,
    ) => Promise<string>,
  ): Promise<MCPToolResult> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error("Connection not found");
    }

    const tool = connection.tools.find((t) => t.name === toolCall.name);
    if (!tool) {
      throw new Error(`Tool '${toolCall.name}' not found`);
    }

    try {
      // Validate parameters against schema
      this.validateToolParameters(tool, toolCall.arguments);

      // Execute the tool
      const result = await toolRunner(toolCall.name, toolCall.arguments);

      return {
        content: [
          {
            type: "text",
            text: result,
          },
        ],
        isError: false,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error(`Tool execution failed: ${toolCall.name}`, {
        error: errorMessage,
      });

      return {
        content: [
          {
            type: "text",
            text: `Tool execution failed: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }

  // Handle MCP resource list request
  async handleResourcesList(connectionId: string): Promise<MCPResource[]> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error("Connection not found");
    }

    return connection.resources;
  }

  // Handle MCP resource read request
  async handleResourceRead(
    connectionId: string,
    uri: string,
    resourceReader: (
      uri: string,
    ) => Promise<{ mimeType: string; content: string }>,
  ): Promise<MCPResourceContents> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error("Connection not found");
    }

    const resource = connection.resources.find((r) => r.uri === uri);
    if (!resource) {
      throw new Error(`Resource '${uri}' not found`);
    }

    try {
      const { mimeType, content } = await resourceReader(uri);

      return {
        uri,
        mimeType,
        text: content,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to read resource '${uri}': ${errorMessage}`);
    }
  }

  // Handle MCP prompt list request
  async handlePromptsList(connectionId: string): Promise<MCPPrompt[]> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error("Connection not found");
    }

    return connection.prompts;
  }

  // Handle MCP prompt get request
  async handlePromptGet(
    connectionId: string,
    name: string,
  ): Promise<MCPPromptResult> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error("Connection not found");
    }

    const prompt = connection.prompts.find((p) => p.name === name);
    if (!prompt) {
      throw new Error(`Prompt '${name}' not found`);
    }

    // Generate prompt based on name and arguments
    return this.generatePrompt(prompt);
  }

  // Validate tool parameters against schema
  private validateToolParameters(
    tool: MCPTool,
    params: Record<string, unknown>,
  ) {
    const { properties, required = [] } = tool.inputSchema;

    // Check required parameters
    for (const param of required) {
      if (!(param in params)) {
        throw new Error(`Missing required parameter: ${param}`);
      }
    }

    // Validate parameter types (basic validation)
    for (const [key, value] of Object.entries(params)) {
      if (key in properties) {
        const paramSchema = properties[key] as { type?: string };
        const expectedType = paramSchema.type;
        const actualType = typeof value;

        if (expectedType === "string" && actualType !== "string") {
          throw new Error(`Parameter '${key}' must be a string`);
        }
        if (expectedType === "number" && actualType !== "number") {
          throw new Error(`Parameter '${key}' must be a number`);
        }
        if (expectedType === "boolean" && actualType !== "boolean") {
          throw new Error(`Parameter '${key}' must be a boolean`);
        }
        if (expectedType === "array" && !Array.isArray(value)) {
          throw new Error(`Parameter '${key}' must be an array`);
        }
        if (
          expectedType === "object" &&
          (actualType !== "object" || Array.isArray(value))
        ) {
          throw new Error(`Parameter '${key}' must be an object`);
        }
      }
    }
  }

  // Generate prompt based on template
  private generatePrompt(prompt: MCPPrompt): MCPPromptResult {
    switch (prompt.name) {
      case "tool_usage_guide":
        return {
          description: "Guide for using tools with LM Studio",
          messages: [
            {
              role: "system",
              content: {
                type: "text",
                text: `You are a tool-using model. Always respond with valid JSON in this format:
{
  "action": "tool_name",
  "params": { ... }
}

Available tools will be provided separately.`,
              },
            },
          ],
        };

      case "search_and_analyze":
        return {
          description: "Search for information and analyze results",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Search for "information" and provide a detailed analysis of the results.`,
              },
            },
          ],
        };

      case "file_operations":
        return {
          description: "Perform file operations",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Help me with file operations. What would you like to do with files?`,
              },
            },
          ],
        };

      default:
        return {
          description: prompt.description,
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Execute prompt: ${prompt.name}`,
              },
            },
          ],
        };
    }
  }

  // Initialize default prompts
  private initializeDefaultPrompts() {
    this.prompts = [
      {
        name: "tool_usage_guide",
        description: "Guide for using tools with LM Studio",
        arguments: [],
      },
      {
        name: "search_and_analyze",
        description: "Search for information and analyze results",
        arguments: [
          {
            name: "query",
            description: "Search query",
            required: true,
          },
        ],
      },
      {
        name: "file_operations",
        description: "Help with file operations",
        arguments: [
          {
            name: "task",
            description: "File operation task",
            required: false,
          },
        ],
      },
    ];
  }

  // Get connection by ID
  getConnection(connectionId: string): MCPConnection | undefined {
    return this.connections.get(connectionId);
  }

  // Close connection
  closeConnection(connectionId: string) {
    this.connections.delete(connectionId);
    logger.info(`MCP connection closed: ${connectionId}`);
  }

  // Get all connections
  getAllConnections(): MCPConnection[] {
    return Array.from(this.connections.values());
  }
}

// Export singleton instance
export const mcpServer = new MCPServer();
