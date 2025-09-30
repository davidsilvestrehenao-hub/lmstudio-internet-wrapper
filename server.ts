import { Hono } from "hono";
import { serve } from "bun";
import fs from "fs/promises";
import path from "path";
import { $ } from "bun";
import { swaggerUI } from "@hono/swagger-ui";
import { load } from "js-yaml";
import { zValidator } from "@hono/zod-validator";
import { ensureSandbox, getSandboxRoot } from "./sandbox";
import { config } from "./config";
import { logger } from "./logger";
import { wsManager } from "./websocket";
import { startServerWithPortRetry } from "./utils/port";
import {
  requestLogger,
  rateLimit,
  errorHandler,
  timeout,
  cors,
} from "./middleware";
import {
  withRetry,
  CircuitBreaker,
  ConnectionError,
  formatUserError,
  safeFetch,
  RetryOptions,
} from "./utils/error-handler";
import { chatRequestSchema, toolCallRequestSchema, chatWithOverridesSchema, LMStudioOverrides } from "./schemas";
import { healthCheck, setCircuitBreakerState } from "./health";
import { mcpServer } from "./mcp/server.js";
import { mcpProtocol } from "./mcp/protocol.js";

type Tool = {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  run: (params: Record<string, unknown>) => Promise<string>;
};

type LMStudioStreamChunk =
  | { type: "done" }
  | { type: "chunk"; data: string }
  | {
      type: "action";
      data: { action: string; params: Record<string, unknown> };
    }
  | { type: "error"; error: string };

const app = new Hono();
const tools: Record<string, Tool> = {};

// Circuit breaker for LM Studio
const lmStudioCircuitBreaker = new CircuitBreaker(3, 60000, 30000);

// Retry options for LM Studio
const lmStudioRetryOptions: RetryOptions = {
  maxRetries: config.maxRetries,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
};

// Add middleware
app.use("*", requestLogger);
app.use("*", cors);
app.use("*", timeout);
app.use("*", rateLimit);
app.onError(errorHandler);

// Health check endpoint
app.get("/health", healthCheck);

// Circuit breaker status endpoint
app.get("/status", (c) => {
  return c.json({
    circuitBreaker: lmStudioCircuitBreaker.getState(),
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// LM Studio connection test endpoint
app.get("/test-lmstudio", async (c) => {
  try {
    const response = await safeFetch(
      `${config.lmStudioUrl}/v1/models`,
      {
        method: "GET",
      },
      10000,
    );

    const models = (await response.json()) as { data?: unknown[] };
    return c.json({
      status: "connected",
      lmStudioUrl: config.lmStudioUrl,
      modelsCount: models.data?.length || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(
      {
        status: "disconnected",
        lmStudioUrl: config.lmStudioUrl,
        error: formatUserError(error),
        timestamp: new Date().toISOString(),
      },
      503,
    );
  }
});

// Load all tools dynamically
async function loadTools() {
  logger.info("Loading tools...");
  const toolsDir = path.resolve("./tools");

  async function loadToolsFromDirectory(dir: string) {
    const files = await fs.readdir(dir, { withFileTypes: true });

    for (const file of files) {
      const fullPath = path.join(dir, file.name);

      if (file.isDirectory()) {
        // Recursively load from subdirectories
        await loadToolsFromDirectory(fullPath);
      } else if (
        file.isFile() &&
        (file.name.endsWith(".ts") || file.name.endsWith(".js"))
      ) {
        try {
          const mod = await import(fullPath);
          if (mod.name && mod.run) {
            tools[mod.name] = {
              name: mod.name,
              description: mod.description,
              schema: mod.schema,
              run: mod.run,
            };
            logger.info(`Loaded tool: ${mod.name}`);
          }
        } catch (error) {
          logger.error(`Failed to load tool: ${file.name}`, { error });
        }
      }
    }
  }

  await loadToolsFromDirectory(toolsDir);
  logger.info("Finished loading tools.");
}

// Inject tool metadata into a system prompt for the model
function toolPrompt(): string {
  const toolList = Object.values(tools).map(
    (t) =>
      `- ${t.name}: ${t.description}\n  Params: ${JSON.stringify(
        t.schema.properties,
        null,
        2,
      )}`,
  );
  return `You are a tool-using model with access to tools via MCP (Model Context Protocol).

You can generate MULTIPLE tool calls in a single response. Each tool call should be a separate JSON object on its own line.

Example format for multiple tool calls:
{
  "action": "search",
  "params": { "query": "cows", "engine": "duckduckgo" }
}
{
  "action": "writeFile", 
  "params": { "path": "cows.txt", "content": "Search results..." }
}

Available tools:
${toolList.join("\n")}

This system uses MCP (Model Context Protocol) for standardized tool integration.
No narration, no natural language — just structured JSON tool calls.`;
}

// Helper function to parse multiple JSON objects from a string
function parseMultipleJSONObjects(text: string): Array<{ action: string; params: Record<string, unknown> }> {
  const results: Array<{ action: string; params: Record<string, unknown> }> = [];
  
  // First, try to parse the entire text as a single JSON object
  try {
    const json = JSON.parse(text);
    if (json.action && json.params) {
      results.push(json);
      return results;
    }
  } catch {
    // If that fails, try to find multiple JSON objects
  }
  
  // Look for complete JSON objects in the text using a more robust approach
  const remaining = text;
  let braceCount = 0;
  let startIndex = -1;
  
  for (let i = 0; i < remaining.length; i++) {
    const char = remaining[i];
    
    if (char === '{') {
      if (braceCount === 0) {
        startIndex = i;
      }
      braceCount++;
    } else if (char === '}') {
      braceCount--;
      
      if (braceCount === 0 && startIndex !== -1) {
        // We have a complete JSON object
        const jsonStr = remaining.substring(startIndex, i + 1);
        try {
          const json = JSON.parse(jsonStr);
          if (json.action && json.params) {
            results.push(json);
          }
        } catch {
          // Skip invalid JSON
        }
        startIndex = -1;
      }
    }
  }
  
  return results;
}

// Helper function to build LM Studio request body with overrides
function buildLMStudioRequest(
  messages: { role: string; content: string }[],
  overrides?: LMStudioOverrides,
  stream: boolean = true
): Record<string, unknown> {
  const baseRequest: Record<string, unknown> = {
    model: config.lmStudioModel,
    messages,
    stream,
    // Note: LM Studio doesn't support response_format: { type: "json_object" }
    // We'll rely on the system prompt to enforce JSON responses
  };

  if (!overrides) {
    return baseRequest;
  }

  // Apply overrides
  if (overrides.model) {
    baseRequest.model = overrides.model;
  }
  if (overrides.temperature !== undefined) {
    baseRequest.temperature = overrides.temperature;
  }
  if (overrides.max_tokens !== undefined) {
    baseRequest.max_tokens = overrides.max_tokens;
  }
  if (overrides.top_p !== undefined) {
    baseRequest.top_p = overrides.top_p;
  }
  if (overrides.frequency_penalty !== undefined) {
    baseRequest.frequency_penalty = overrides.frequency_penalty;
  }
  if (overrides.presence_penalty !== undefined) {
    baseRequest.presence_penalty = overrides.presence_penalty;
  }
  if (overrides.stop !== undefined) {
    baseRequest.stop = overrides.stop;
  }
  if (overrides.user !== undefined) {
    baseRequest.user = overrides.user;
  }
  if (overrides.seed !== undefined) {
    baseRequest.seed = overrides.seed;
  }
  if (overrides.response_format !== undefined) {
    baseRequest.response_format = overrides.response_format;
  }

  return baseRequest;
}

// Stream helper: normalize LM Studio chunks with robust error handling
async function* streamLMStudio(
  messages: { role: string; content: string }[],
  overrides?: LMStudioOverrides,
): AsyncGenerator<LMStudioStreamChunk> {
  try {
    const resp = await lmStudioCircuitBreaker.execute(
      () =>
        withRetry(
          () =>
            safeFetch(`${config.lmStudioUrl}/v1/chat/completions`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(buildLMStudioRequest(messages, overrides, true)),
            }),
          lmStudioRetryOptions,
          "LM Studio chat completion",
        ),
      "LM Studio",
    );

    const reader = resp.body?.getReader();
    if (!reader) {
      throw new ConnectionError(
        "No response stream from LM Studio",
        "LM Studio",
      );
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let contentBuffer = ""; // Buffer to accumulate content chunks

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") {
              // Process any remaining content in the buffer
              if (contentBuffer.trim()) {
                const jsonObjects = parseMultipleJSONObjects(contentBuffer);
                if (jsonObjects.length > 0) {
                  for (const json of jsonObjects) {
                    yield { type: "action", data: json } as const;
                  }
                } else {
                  yield { type: "chunk", data: contentBuffer } as const;
                }
              }
              yield { type: "done" };
            } else if (payload) {
              try {
                const parsed = JSON.parse(payload);
                const text =
                  parsed.choices?.[0]?.delta?.content ??
                  parsed.choices?.[0]?.message?.content ??
                  "";
                if (text) {
                  contentBuffer += text;
                  
                  // Try to parse complete JSON objects from the accumulated content
                  const jsonObjects = parseMultipleJSONObjects(contentBuffer);
                  if (jsonObjects.length > 0) {
                    // Yield each JSON object as a separate action
                    for (const json of jsonObjects) {
                      yield { type: "action", data: json } as const;
                    }
                    // Clear the buffer after successful parsing
                    contentBuffer = "";
                  }
                  // Don't yield chunks immediately - wait for complete JSON or end of stream
                }
              } catch (parseError) {
                logger.debug("Ignoring malformed LM Studio chunk", {
                  payload,
                  error:
                    parseError instanceof Error
                      ? parseError.message
                      : "Unknown",
                });
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    logger.error("LM Studio streaming failed", { error });
    yield {
      type: "error",
      error: formatUserError(error),
    };
  }
}

// Enhanced chat with automatic tool execution
async function* chatWithTools(
  messages: { role: string; content: string }[],
  maxIterations: number = 5,
  overrides?: LMStudioOverrides,
): AsyncGenerator<LMStudioStreamChunk> {
  const currentMessages = [...messages];
  let iterations = 0;

  while (iterations < maxIterations) {
    const systemMessage = { role: "system", content: toolPrompt() };
    const mergedMessages = [systemMessage, ...currentMessages];

    let toolCallDetected = false;
    let toolResult = "";

    for await (const chunk of streamLMStudio(mergedMessages, overrides)) {
      if (chunk.type === "action") {
        // Execute the tool automatically
        const { action, params } = chunk.data;
        const tool = tools[action];

        if (tool) {
          try {
            toolResult = await withRetry(
              () => tool.run(params),
              {
                maxRetries: 2,
                baseDelay: 500,
                maxDelay: 2000,
                backoffMultiplier: 2,
              },
              `Tool execution: ${action}`,
            );
            toolCallDetected = true;

            // Send tool execution result
            yield {
              type: "chunk",
              data: `\n🔧 **Tool executed: ${action}**\n`,
            };
            yield { type: "chunk", data: `Result: ${toolResult}\n\n` };

            // Add tool result to conversation for follow-up
            currentMessages.push({
              role: "assistant",
              content: JSON.stringify({ action, params }),
            });
            currentMessages.push({
              role: "user",
              content: `Tool result: ${toolResult}`,
            });
          } catch (error) {
            const errorMsg = formatUserError(error);
            logger.error("Tool execution failed", {
              tool: action,
              params,
              error: error instanceof Error ? error.message : "Unknown error",
            });
            yield { type: "error", error: errorMsg };
            toolCallDetected = true;
          }
        } else {
          const errorMsg = `Unknown tool: ${action}. Available tools: ${Object.keys(tools).join(", ")}`;
          logger.warn("Unknown tool requested", {
            tool: action,
            availableTools: Object.keys(tools),
          });
          yield { type: "error", error: errorMsg };
          toolCallDetected = true;
        }
        break;
      } else {
        yield chunk;
      }
    }

    if (!toolCallDetected) {
      break; // No tool call detected, conversation complete
    }

    iterations++;
  }

  if (iterations >= maxIterations) {
    yield {
      type: "chunk",
      data: "\n⚠️ **Maximum tool execution iterations reached**\n",
    };
  }
}

// SSE endpoint
app.post("/chat", zValidator("json", chatRequestSchema), async (c) => {
  const { messages, stream } = c.req.valid("json");

  if (stream) {
    const encoder = new TextEncoder();
    const iterator = chatWithTools(messages);

    return new Response(
      new ReadableStream({
        async pull(ctrl) {
          const { value, done } = await iterator.next();
          if (done) {
            ctrl.close();
            return;
          }
          if (value) {
            ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`));
          }
        },
      }),
      {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      },
    );
  }

  // Non-streaming fallback - direct LM Studio call with tool execution
  try {
    const systemMessage = { role: "system", content: toolPrompt() };
    const mergedMessages = [systemMessage, ...messages];

    const resp = await lmStudioCircuitBreaker.execute(
      () =>
        withRetry(
          () =>
            safeFetch(`${config.lmStudioUrl}/v1/chat/completions`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(buildLMStudioRequest(mergedMessages, undefined, false)),
            }),
          lmStudioRetryOptions,
          "LM Studio chat completion (non-streaming)",
        ),
      "LM Studio",
    );

    const data = await resp.json() as {
      choices?: Array<{
        message?: { content?: string };
      }>;
    };
    
    // Parse the response content for tool calls
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      const jsonObjects = parseMultipleJSONObjects(content);
      if (jsonObjects.length > 0) {
        // Execute all tool calls and collect results
        const results: string[] = [];
        
        for (const json of jsonObjects) {
          const tool = tools[json.action];
          if (tool) {
            try {
              const toolResult = await withRetry(
                () => tool.run(json.params),
                {
                  maxRetries: 2,
                  baseDelay: 500,
                  maxDelay: 2000,
                  backoffMultiplier: 2,
                },
                `Tool execution: ${json.action}`,
              );
              
              results.push(`🔧 **Tool executed: ${json.action}**\n\nResult: ${toolResult}`);
            } catch (toolError) {
              const errorMsg = formatUserError(toolError);
              logger.error("Tool execution failed", {
                tool: json.action,
                params: json.params,
                error: toolError instanceof Error ? toolError.message : "Unknown error",
              });
              results.push(`❌ **Tool execution failed: ${json.action}**\n\nError: ${errorMsg}`);
            }
          } else {
            logger.warn("Unknown tool requested", {
              tool: json.action,
              availableTools: Object.keys(tools),
            });
            results.push(`❌ **Unknown tool: ${json.action}**\n\nAvailable tools: ${Object.keys(tools).join(", ")}`);
          }
        }
        
        // Return the combined tool execution results
        return c.json({
          ...data,
          choices: [{
            ...data.choices![0],
            message: {
              ...data.choices![0].message,
              content: results.join('\n\n'),
            },
          }],
        });
      }
    }
    
    // Return the original response if no tool call detected
    return c.json(data);
  } catch (error) {
    logger.error("LM Studio non-streaming request failed", { error });
    return c.json(
      {
        error: formatUserError(error),
        choices: [
          {
            message: {
              content: `I'm sorry, I'm having trouble connecting to LM Studio. ${formatUserError(error)}`,
            },
          },
        ],
      },
      503,
    );
  }
});

// Chat endpoint with LM Studio overrides (non-streaming only)
app.post("/chat/overrides", zValidator("json", chatWithOverridesSchema), async (c) => {
  const { messages, stream, overrides } = c.req.valid("json");

  if (stream) {
    // For streaming with overrides, use the regular chat endpoint
    const encoder = new TextEncoder();
    const iterator = chatWithTools(messages, 5, overrides);

    return new Response(
      new ReadableStream({
        async pull(ctrl) {
          const { value, done } = await iterator.next();
          if (done) {
            ctrl.close();
            return;
          }
          if (value) {
            ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`));
          }
        },
      }),
      {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      },
    );
  }

  // Non-streaming with overrides
  try {
    const systemMessage = { role: "system", content: toolPrompt() };
    const mergedMessages = [systemMessage, ...messages];

    const resp = await lmStudioCircuitBreaker.execute(
      () =>
        withRetry(
          () =>
            safeFetch(`${config.lmStudioUrl}/v1/chat/completions`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(buildLMStudioRequest(mergedMessages, overrides, false)),
            }),
          lmStudioRetryOptions,
          "LM Studio chat completion with overrides (non-streaming)",
        ),
      "LM Studio",
    );

    const data = await resp.json() as {
      choices?: Array<{
        message?: { content?: string };
      }>;
    };
    
    // Parse the response content for tool calls
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      const jsonObjects = parseMultipleJSONObjects(content);
      if (jsonObjects.length > 0) {
        // Execute all tool calls and collect results
        const results: string[] = [];
        
        for (const json of jsonObjects) {
          const tool = tools[json.action];
          if (tool) {
            try {
              const toolResult = await withRetry(
                () => tool.run(json.params),
                {
                  maxRetries: 2,
                  baseDelay: 500,
                  maxDelay: 2000,
                  backoffMultiplier: 2,
                },
                `Tool execution: ${json.action}`,
              );
              
              results.push(`🔧 **Tool executed: ${json.action}**\n\nResult: ${toolResult}`);
            } catch (toolError) {
              const errorMsg = formatUserError(toolError);
              logger.error("Tool execution failed", {
                tool: json.action,
                params: json.params,
                error: toolError instanceof Error ? toolError.message : "Unknown error",
              });
              results.push(`❌ **Tool execution failed: ${json.action}**\n\nError: ${errorMsg}`);
            }
          } else {
            logger.warn("Unknown tool requested", {
              tool: json.action,
              availableTools: Object.keys(tools),
            });
            results.push(`❌ **Unknown tool: ${json.action}**\n\nAvailable tools: ${Object.keys(tools).join(", ")}`);
          }
        }
        
        // Return the combined tool execution results
        return c.json({
          ...data,
          choices: [{
            ...data.choices![0],
            message: {
              ...data.choices![0].message,
              content: results.join('\n\n'),
            },
          }],
        });
      }
    }
    
    // Return the original response if no tool call detected
    return c.json(data);
  } catch (error) {
    logger.error("LM Studio request with overrides failed", { error });
    return c.json(
      {
        error: formatUserError(error),
        choices: [
          {
            message: {
              content: `I'm sorry, I'm having trouble connecting to LM Studio. ${formatUserError(error)}`,
            },
          },
        ],
      },
      503,
    );
  }
});

// Manual tool call (for backward compatibility)
app.post("/call", zValidator("json", toolCallRequestSchema), async (c) => {
  const { action, params } = c.req.valid("json");
  const tool = tools[action];
  if (!tool) return c.json({ error: "Unknown tool" }, 400);

  const result = await tool.run(params);
  return c.json({ result });
});

// Legacy chat endpoint (without automatic tool execution)
app.post("/chat/legacy", zValidator("json", chatRequestSchema), async (c) => {
  const { messages, stream } = c.req.valid("json");

  const systemMessage = { role: "system", content: toolPrompt() };
  const mergedMessages = [systemMessage, ...messages];

  if (stream) {
    const encoder = new TextEncoder();
    const iterator = streamLMStudio(mergedMessages);

    return new Response(
      new ReadableStream({
        async pull(ctrl) {
          const { value, done } = await iterator.next();
          if (done) {
            ctrl.close();
            return;
          }
          if (value) {
            ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`));
          }
        },
      }),
      {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      },
    );
  }

  // Non-streaming fallback with error handling
  try {
    const resp = await lmStudioCircuitBreaker.execute(
      () =>
        withRetry(
          () =>
            safeFetch(`${config.lmStudioUrl}/v1/chat/completions`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(buildLMStudioRequest(mergedMessages, undefined, false)),
            }),
          lmStudioRetryOptions,
          "LM Studio chat completion (non-streaming)",
        ),
      "LM Studio",
    );

    const data = await resp.json() as {
      choices?: Array<{
        message?: { content?: string };
      }>;
    };
    
    // Parse the response content for tool calls
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      const jsonObjects = parseMultipleJSONObjects(content);
      if (jsonObjects.length > 0) {
        // Execute all tool calls and collect results
        const results: string[] = [];
        
        for (const json of jsonObjects) {
          const tool = tools[json.action];
          if (tool) {
            try {
              const toolResult = await withRetry(
                () => tool.run(json.params),
                {
                  maxRetries: 2,
                  baseDelay: 500,
                  maxDelay: 2000,
                  backoffMultiplier: 2,
                },
                `Tool execution: ${json.action}`,
              );
              
              results.push(`🔧 **Tool executed: ${json.action}**\n\nResult: ${toolResult}`);
            } catch (toolError) {
              const errorMsg = formatUserError(toolError);
              logger.error("Tool execution failed", {
                tool: json.action,
                params: json.params,
                error: toolError instanceof Error ? toolError.message : "Unknown error",
              });
              results.push(`❌ **Tool execution failed: ${json.action}**\n\nError: ${errorMsg}`);
            }
          } else {
            logger.warn("Unknown tool requested", {
              tool: json.action,
              availableTools: Object.keys(tools),
            });
            results.push(`❌ **Unknown tool: ${json.action}**\n\nAvailable tools: ${Object.keys(tools).join(", ")}`);
          }
        }
        
        // Return the combined tool execution results
        return c.json({
          ...data,
          choices: [{
            ...data.choices![0],
            message: {
              ...data.choices![0].message,
              content: results.join('\n\n'),
            },
          }],
        });
      }
    }
    
    // Return the original response if no tool call detected
    return c.json(data);
  } catch (error) {
    logger.error("LM Studio non-streaming request failed", { error });
    return c.json(
      {
        error: formatUserError(error),
        choices: [
          {
            message: {
              content: `I'm sorry, I'm having trouble connecting to LM Studio. ${formatUserError(error)}`,
            },
          },
        ],
      },
      503,
    );
  }
});

// Tool discovery
app.get("/tools", async (c) => {
  // Load tool metadata on-demand so the endpoint works even if background loading failed
  const dir = path.resolve("./tools");
  const list: Array<{ name: string; description?: string; schema?: unknown }> =
    [];
  try {
    const files = await fs.readdir(dir);
    for (const file of files) {
      if (!file.endsWith(".ts") && !file.endsWith(".js")) continue;
      const absolute = path.join(dir, file);
      try {
        // Use file:// URL for dynamic import to be more robust with absolute paths
        const mod = await import("file://" + absolute);
        const name =
          mod.name ??
          (mod.default && mod.default.name) ??
          path.basename(file, path.extname(file));
        list.push({
          name,
          description: mod.description ?? "",
          schema: mod.schema ?? null,
        });
      } catch (err) {
        // Log detailed error to help debugging why imports fail at runtime
        logger.error("Failed to import tool module", {
          file,
          absolute,
          error: String(err),
        });
      }
    }
  } catch (err) {
    logger.error("Failed to read tools directory", { error: String(err) });
    return c.json([], 200);
  }

  // Merge any tools that were loaded at startup (in-memory) to ensure consistency
  try {
    for (const t of Object.values(tools)) {
      if (!list.find((l) => l.name === t.name)) {
        list.push({
          name: t.name,
          description: t.description,
          schema: t.schema,
        });
      }
    }
  } catch (err) {
    logger.debug("No in-memory tools to merge", { error: String(err) });
  }

  return c.json(list);
});

// Helper function to ensure connection exists
async function ensureConnection(connectionId: string) {
  let connection = mcpServer.getConnection(connectionId);
  if (!connection) {
    connection = await mcpServer.initializeConnection(connectionId);
  }
  return connection;
}

// MCP (Model Context Protocol) endpoints
app.post("/mcp/initialize", async (c) => {
  try {
    const body = await c.req.json();
    const connectionId = body.connectionId || "default";

    const connection = await mcpServer.initializeConnection(connectionId);

    return c.json({
      jsonrpc: "2.0",
      id: body.id || "init",
      result: {
        protocolVersion: "2024-11-05",
        capabilities: connection.capabilities,
        serverInfo: {
          name: "LM Studio MCP Server",
          version: "1.0.0",
        },
      },
    });
  } catch (error) {
    logger.error("MCP initialization failed", { error });
    return c.json(mcpProtocol.handleError(error, "init"), 500);
  }
});

app.post("/mcp/tools/list", async (c) => {
  try {
    const body = await c.req.json();
    const connectionId = body.connectionId || "default";

    await ensureConnection(connectionId);
    const tools = await mcpServer.handleToolsList(connectionId);

    return c.json({
      jsonrpc: "2.0",
      id: body.id || "tools_list",
      result: { tools },
    });
  } catch (error) {
    logger.error("MCP tools list failed", { error });
    return c.json(mcpProtocol.handleError(error, "tools_list"), 500);
  }
});

app.post("/mcp/tools/call", async (c) => {
  try {
    const body = await c.req.json();
    const connectionId = body.connectionId || "default";
    const { name, arguments: args } = body.params;

    await ensureConnection(connectionId);
    const toolCall = { name, arguments: args };
    const result = await mcpServer.handleToolCall(
      connectionId,
      toolCall,
      async (toolName: string, params: Record<string, unknown>) => {
        const tool = tools[toolName];
        if (!tool) throw new Error(`Tool '${toolName}' not found`);
        return await tool.run(params);
      },
    );

    return c.json({
      jsonrpc: "2.0",
      id: body.id || "tools_call",
      result,
    });
  } catch (error) {
    logger.error("MCP tool call failed", { error });
    return c.json(mcpProtocol.handleError(error, "tools_call"), 500);
  }
});

app.post("/mcp/resources/list", async (c) => {
  try {
    const body = await c.req.json();
    const connectionId = body.connectionId || "default";

    await ensureConnection(connectionId);
    const resources = await mcpServer.handleResourcesList(connectionId);

    return c.json({
      jsonrpc: "2.0",
      id: body.id || "resources_list",
      result: { resources },
    });
  } catch (error) {
    logger.error("MCP resources list failed", { error });
    return c.json(mcpProtocol.handleError(error, "resources_list"), 500);
  }
});

app.post("/mcp/resources/read", async (c) => {
  try {
    const body = await c.req.json();
    const connectionId = body.connectionId || "default";
    const { uri } = body.params;

    await ensureConnection(connectionId);
    const result = await mcpServer.handleResourceRead(
      connectionId,
      uri,
      async (resourceUri: string) => {
        // Read file from sandbox
        const safePath = path.resolve(getSandboxRoot(), resourceUri);
        const content = await fs.readFile(safePath, "utf-8");
        return {
          mimeType: "text/plain",
          content,
        };
      },
    );

    return c.json({
      jsonrpc: "2.0",
      id: body.id || "resources_read",
      result,
    });
  } catch (error) {
    logger.error("MCP resource read failed", { error });
    return c.json(mcpProtocol.handleError(error, "resources_read"), 500);
  }
});

app.post("/mcp/prompts/list", async (c) => {
  try {
    const body = await c.req.json();
    const connectionId = body.connectionId || "default";

    await ensureConnection(connectionId);
    const prompts = await mcpServer.handlePromptsList(connectionId);

    return c.json({
      jsonrpc: "2.0",
      id: body.id || "prompts_list",
      result: { prompts },
    });
  } catch (error) {
    logger.error("MCP prompts list failed", { error });
    return c.json(mcpProtocol.handleError(error, "prompts_list"), 500);
  }
});

app.post("/mcp/prompts/get", async (c) => {
  try {
    const body = await c.req.json();
    const connectionId = body.connectionId || "default";
    const { name } = body.params;

    await ensureConnection(connectionId);
    const result = await mcpServer.handlePromptGet(connectionId, name);

    return c.json({
      jsonrpc: "2.0",
      id: body.id || "prompts_get",
      result,
    });
  } catch (error) {
    logger.error("MCP prompt get failed", { error });
    return c.json(mcpProtocol.handleError(error, "prompts_get"), 500);
  }
});

// Validate that the configured LM Studio model exists
async function validateModel(): Promise<void> {
  logger.info(`Validating LM Studio model: ${config.lmStudioModel}`);

  try {
    const response = await safeFetch(
      `${config.lmStudioUrl}/v1/models`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      },
      10000, // 10 second timeout
    );

    if (!response.ok) {
      throw new Error(
        `LM Studio API returned ${response.status}: ${response.statusText}`,
      );
    }

    const data = (await response.json()) as {
      data?: Array<{
        id: string;
        object: string;
        created: number;
        owned_by: string;
      }>;
    };
    const models = data.data || [];

    logger.info(`Found ${models.length} available models in LM Studio`);

    // Check if our configured model exists
    const modelExists = models.some(
      (model) => model.id === config.lmStudioModel,
    );

    if (!modelExists) {
      const availableModels = models.map((m) => m.id).join(", ");
      const errorMessage = `
❌ MODEL VALIDATION FAILED

The configured model '${config.lmStudioModel}' was not found in LM Studio.

Available models:
${availableModels}

HOW TO FIX:
1. Make sure LM Studio is running and accessible at ${config.lmStudioUrl}
2. Load the model '${config.lmStudioModel}' in LM Studio, or
3. Update the LM_STUDIO_MODEL environment variable to use one of the available models:
   export LM_STUDIO_MODEL="<one-of-the-available-models>"
4. Or update the model in your .env file:
   LM_STUDIO_MODEL=<one-of-the-available-models>

Current configuration:
- LM Studio URL: ${config.lmStudioUrl}
- Configured Model: ${config.lmStudioModel}
- Available Models: ${availableModels}
`;

      logger.error(errorMessage);
      console.error(errorMessage);
      process.exit(1);
    }

    logger.info(
      `✅ Model validation successful: '${config.lmStudioModel}' is available`,
    );
  } catch (error) {
    const errorMessage = `
❌ MODEL VALIDATION FAILED

Could not connect to LM Studio or validate the configured model.

Error: ${error instanceof Error ? error.message : "Unknown error"}

HOW TO FIX:
1. Make sure LM Studio is running and accessible at ${config.lmStudioUrl}
2. Check that LM Studio is not blocked by firewall or security software
3. Verify the LM_STUDIO_URL environment variable is correct:
   export LM_STUDIO_URL="${config.lmStudioUrl}"
4. Try accessing the LM Studio API directly in your browser:
   ${config.lmStudioUrl}/v1/models

Current configuration:
- LM Studio URL: ${config.lmStudioUrl}
- Configured Model: ${config.lmStudioModel}
`;

    logger.error(errorMessage);
    console.error(errorMessage);
    process.exit(1);
  }
}

// Initialize everything
async function startServer() {
  // Validate model before starting servers
  await validateModel();

  // Start HTTP server with port retry
  const { server: httpServer, port: httpPort } = await startServerWithPortRetry(
    (port: number) => serve({ fetch: app.fetch, port }),
    {
      startPort: config.port,
      serviceName: "HTTP server",
    },
  );

  // Start WebSocket server with port retry
  const { server: wsServer, port: wsPort } = await startServerWithPortRetry(
    (port: number) =>
      Bun.serve({
        port,
        fetch(req, server) {
          const url = new URL(req.url);
          if (url.pathname === "/ws") {
            if (server.upgrade(req)) {
              return; // Upgrade handled by Bun
            }
            return new Response("Expected WebSocket", { status: 400 });
          }
          return new Response("Not found", { status: 404 });
        },
        websocket: {
          open(ws) {
            const id = crypto.randomUUID(); // Generate a unique ID for the connection
            wsManager.addConnection(id, ws);
          },
          async message(ws, msg) {
            try {
              const messageString = msg.toString();
              const { messages } = chatRequestSchema.parse(
                JSON.parse(messageString),
              );

              for await (const chunk of chatWithTools(messages)) {
                if (ws.readyState === 1) {
                  ws.send(JSON.stringify(chunk));
                } else {
                  logger.warn("WebSocket connection closed during streaming");
                  break;
                }
              }
            } catch (err) {
              const error = formatUserError(err);
              logger.error("WebSocket message error", {
                error: err instanceof Error ? err.message : "Unknown error",
                stack: err instanceof Error ? err.stack : undefined,
              });
              if (ws.readyState === 1) {
                ws.send(JSON.stringify({ type: "error", error }));
              }
            }
          },
          close() {
            logger.info("WebSocket connection closed");
            // WebSocketManager handles connection cleanup
          },
        },
      }),
    {
      startPort: config.wsPort,
      serviceName: "WebSocket server",
    },
  );

  await ensureSandbox();
  await loadTools();

  // Register tools with MCP server
  mcpServer.registerTools(tools);

  // Update circuit breaker state periodically for health checks
  setInterval(() => {
    setCircuitBreakerState(lmStudioCircuitBreaker.getState());
  }, 5000); // Update every 5 seconds

  // Register sandbox files as MCP resources
  try {
    const sandboxFiles = await fs.readdir(getSandboxRoot());
    const resources = sandboxFiles.map((file) => ({
      uri: file,
      name: file,
      description: `File in sandbox: ${file}`,
      mimeType: "text/plain",
    }));
    mcpServer.registerResources(resources);
  } catch (error) {
    logger.warn("Failed to register sandbox resources", { error });
  }

  // Start HTTP server
  const ports = { httpPort, wsPort };

  logger.info(
    `Server running on http://localhost:${ports.httpPort} (SSE on /chat, WebSockets on ws://localhost:${ports.wsPort}/ws)`,
    ports,
  );

  // Open the OpenAPI UI in the default browser if configured to do so
  if (config.openapiAutoOpen) {
    await $`open http://localhost:${ports.httpPort}/docs/`;
    logger.info("OpenAPI UI opened in browser");
  } else {
    logger.info(
      `OpenAPI UI available at http://localhost:${ports.httpPort}/docs/ (set OPENAPI_AUTO_OPEN=true to auto-open)`,
    );
  }

  return {
    httpServer,
    wsServer,
    ports,
  };
}

// Load OpenAPI specification
const openapiSpec = load(await fs.readFile("openapi.yaml", "utf-8"));

// Add Swagger UI
app.get(
  "/docs/*",
  swaggerUI({
    url: "/openapi.json",
  }),
);

// Serve OpenAPI specification
app.get("/openapi.json", (c) => {
  return c.json(openapiSpec, 200, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  });
});

// Handle missing service worker file to prevent 404 errors
app.get("/sw.js", () => {
  return new Response("", { status: 404 });
});

// Handle favicon requests to prevent 404 errors
app.get("/favicon.ico", () => {
  return new Response("", { status: 404 });
});

// Handle Chrome DevTools extension requests
app.get("/.well-known/appspecific/com.chrome.devtools.json", () => {
  return new Response("", { status: 404 });
});

// Start the server
const { httpServer, wsServer } = await startServer();

// Handle graceful shutdown
const shutdown = () => {
  logger.info("Shutting down server...");
  wsManager.closeAll();
  httpServer.stop();
  wsServer.stop();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// End of file
