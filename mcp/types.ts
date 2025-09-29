// Model Context Protocol (MCP) TypeScript definitions
// Based on the MCP specification from Anthropic

export interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: unknown;
}

export interface MCPNotification {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
}

// MCP Tool definitions
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface MCPToolResult {
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError?: boolean;
}

// MCP Resource definitions
export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPResourceContents {
  uri: string;
  mimeType: string;
  text?: string;
  blob?: string; // base64 encoded
}

// MCP Prompt definitions
export interface MCPPrompt {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface MCPPromptResult {
  description?: string;
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: {
      type: "text";
      text: string;
    };
  }>;
}

// MCP Server capabilities
export interface MCPServerCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
  logging?: Record<string, never>;
}

export interface MCPClientCapabilities {
  experimental?: Record<string, unknown>;
  sampling?: Record<string, never>;
}

// MCP Initialize request/response
export interface MCPInitializeRequest extends MCPRequest {
  method: "initialize";
  params: {
    protocolVersion: "2024-11-05";
    capabilities: MCPClientCapabilities;
    clientInfo: {
      name: string;
      version: string;
    };
  };
}

export interface MCPInitializeResponse extends MCPResponse {
  result: {
    protocolVersion: "2024-11-05";
    capabilities: MCPServerCapabilities;
    serverInfo: {
      name: string;
      version: string;
    };
  };
}

// MCP Tool methods
export interface MCPToolsListRequest extends MCPRequest {
  method: "tools/list";
}

export interface MCPToolsListResponse extends MCPResponse {
  result: {
    tools: MCPTool[];
  };
}

export interface MCPToolsCallRequest extends MCPRequest {
  method: "tools/call";
  params: MCPToolCall & Record<string, unknown>;
}

export interface MCPToolsCallResponse extends MCPResponse {
  result: MCPToolResult;
}

// MCP Resource methods
export interface MCPResourcesListRequest extends MCPRequest {
  method: "resources/list";
}

export interface MCPResourcesListResponse extends MCPResponse {
  result: {
    resources: MCPResource[];
  };
}

export interface MCPResourcesReadRequest extends MCPRequest {
  method: "resources/read";
  params: {
    uri: string;
  };
}

export interface MCPResourcesReadResponse extends MCPResponse {
  result: MCPResourceContents;
}

// MCP Prompt methods
export interface MCPPromptsListRequest extends MCPRequest {
  method: "prompts/list";
}

export interface MCPPromptsListResponse extends MCPResponse {
  result: {
    prompts: MCPPrompt[];
  };
}

export interface MCPPromptsGetRequest extends MCPRequest {
  method: "prompts/get";
  params: {
    name: string;
    arguments?: Record<string, unknown>;
  };
}

export interface MCPPromptsGetResponse extends MCPResponse {
  result: MCPPromptResult;
}

// MCP Connection state
export interface MCPConnection {
  id: string;
  capabilities: MCPServerCapabilities;
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: MCPPrompt[];
  isInitialized: boolean;
}

// MCP Error codes
export const MCP_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  SERVER_ERROR: -32000,
} as const;

export type MCPErrorCode =
  (typeof MCP_ERROR_CODES)[keyof typeof MCP_ERROR_CODES];
