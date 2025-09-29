// Model Context Protocol (MCP) implementation
import {
  MCPRequest,
  MCPResponse,
  MCPError,
  MCPNotification,
  MCPErrorCode,
  MCP_ERROR_CODES,
} from "./types.js";

export class MCPProtocol {
  private requestId = 0;

  // Generate unique request ID
  private generateId(): string {
    return `req_${++this.requestId}_${Date.now()}`;
  }

  // Create MCP request
  createRequest(method: string, params?: Record<string, unknown>): MCPRequest {
    return {
      jsonrpc: "2.0",
      id: this.generateId(),
      method,
      params,
    };
  }

  // Create MCP response
  createResponse(
    id: string | number,
    result?: unknown,
    error?: MCPError,
  ): MCPResponse {
    const response: MCPResponse = {
      jsonrpc: "2.0",
      id,
    };

    if (error) {
      response.error = error;
    } else {
      response.result = result;
    }

    return response;
  }

  // Create MCP notification
  createNotification(
    method: string,
    params?: Record<string, unknown>,
  ): MCPNotification {
    return {
      jsonrpc: "2.0",
      method,
      params,
    };
  }

  // Create MCP error
  createError(code: MCPErrorCode, message: string, data?: unknown): MCPError {
    return {
      code,
      message,
      data,
    };
  }

  // Parse incoming MCP message
  parseMessage(data: string): MCPRequest | MCPNotification | null {
    try {
      const parsed = JSON.parse(data);

      // Validate JSON-RPC structure
      if (parsed.jsonrpc !== "2.0") {
        throw new Error("Invalid JSON-RPC version");
      }

      if (!parsed.method) {
        throw new Error("Missing method");
      }

      // Check if it's a request (has id) or notification (no id)
      if (parsed.id !== undefined) {
        return parsed as MCPRequest;
      } else {
        return parsed as MCPNotification;
      }
    } catch (error) {
      console.error("Failed to parse MCP message:", error);
      return null;
    }
  }

  // Validate MCP request
  validateRequest(request: MCPRequest): { valid: boolean; error?: MCPError } {
    if (!request.jsonrpc || request.jsonrpc !== "2.0") {
      return {
        valid: false,
        error: this.createError(
          MCP_ERROR_CODES.INVALID_REQUEST,
          "Invalid JSON-RPC version",
        ),
      };
    }

    if (!request.method) {
      return {
        valid: false,
        error: this.createError(
          MCP_ERROR_CODES.INVALID_REQUEST,
          "Missing method",
        ),
      };
    }

    if (request.id === undefined) {
      return {
        valid: false,
        error: this.createError(
          MCP_ERROR_CODES.INVALID_REQUEST,
          "Missing request ID",
        ),
      };
    }

    return { valid: true };
  }

  // Handle MCP errors
  handleError(error: unknown, requestId?: string | number): MCPResponse {
    let mcpError: MCPError;

    if (error instanceof Error) {
      mcpError = this.createError(
        MCP_ERROR_CODES.INTERNAL_ERROR,
        error.message,
      );
    } else {
      mcpError = this.createError(
        MCP_ERROR_CODES.INTERNAL_ERROR,
        "Unknown error occurred",
      );
    }

    return this.createResponse(requestId || "unknown", undefined, mcpError);
  }

  // Create method not found error
  createMethodNotFoundError(
    method: string,
    requestId: string | number,
  ): MCPResponse {
    return this.createResponse(
      requestId,
      undefined,
      this.createError(
        MCP_ERROR_CODES.METHOD_NOT_FOUND,
        `Method '${method}' not found`,
      ),
    );
  }

  // Create invalid params error
  createInvalidParamsError(
    message: string,
    requestId: string | number,
  ): MCPResponse {
    return this.createResponse(
      requestId,
      undefined,
      this.createError(MCP_ERROR_CODES.INVALID_PARAMS, message),
    );
  }

  // Serialize MCP message to JSON
  serialize(message: MCPRequest | MCPResponse | MCPNotification): string {
    return JSON.stringify(message);
  }

  // Check if message is a request
  isRequest(message: MCPRequest | MCPNotification): message is MCPRequest {
    return "id" in message;
  }

  // Check if message is a notification
  isNotification(
    message: MCPRequest | MCPNotification,
  ): message is MCPNotification {
    return !("id" in message);
  }
}

// Export singleton instance
export const mcpProtocol = new MCPProtocol();
