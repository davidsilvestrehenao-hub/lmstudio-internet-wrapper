import { logger } from "../logger";

export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export class RetryError extends Error {
  constructor(
    message: string,
    public originalError: Error,
    public attempt: number,
    public maxRetries: number,
  ) {
    super(message);
    this.name = "RetryError";
  }
}

export class ConnectionError extends Error {
  constructor(
    message: string,
    public service: string,
    public originalError?: Error,
  ) {
    super(message);
    this.name = "ConnectionError";
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export class ToolExecutionError extends Error {
  constructor(
    message: string,
    public toolName: string,
    public originalError?: Error,
  ) {
    super(message);
    this.name = "ToolExecutionError";
  }
}

// Retry mechanism with exponential backoff
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  },
  context?: string,
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= options.maxRetries + 1; attempt++) {
    try {
      const result = await operation();
      if (attempt > 1) {
        logger.info(`Operation succeeded on attempt ${attempt}`, { context });
      }
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt > options.maxRetries) {
        logger.error(`Operation failed after ${attempt} attempts`, {
          context,
          error: lastError.message,
          attempts: attempt,
        });
        throw new RetryError(
          `Operation failed after ${attempt} attempts: ${lastError.message}`,
          lastError,
          attempt - 1,
          options.maxRetries,
        );
      }

      const delay = Math.min(
        options.baseDelay * Math.pow(options.backoffMultiplier, attempt - 1),
        options.maxDelay,
      );

      logger.warn(`Operation failed, retrying in ${delay}ms`, {
        context,
        attempt,
        maxRetries: options.maxRetries,
        error: lastError.message,
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

// Circuit breaker pattern
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000, // 1 minute
    private resetTimeout: number = 30000, // 30 seconds
  ) {}

  async execute<T>(operation: () => Promise<T>, context?: string): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = "HALF_OPEN";
        logger.info("Circuit breaker entering HALF_OPEN state", { context });
      } else {
        throw new Error(
          `Circuit breaker is OPEN. Service unavailable. Next attempt in ${Math.ceil(
            (this.timeout - (Date.now() - this.lastFailureTime)) / 1000,
          )} seconds`,
        );
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = "CLOSED";
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = "OPEN";
      logger.error("Circuit breaker opened due to failures", {
        failures: this.failures,
        threshold: this.threshold,
      });
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

// Error formatter for user-friendly messages
export function formatUserError(error: unknown): string {
  if (error instanceof RetryError) {
    return `Service temporarily unavailable. Please try again in a few moments. (Attempted ${error.attempt}/${error.maxRetries})`;
  }

  if (error instanceof ConnectionError) {
    return `Unable to connect to ${error.service}. Please check if the service is running.`;
  }

  if (error instanceof ValidationError) {
    return `Invalid input: ${error.message}${error.field ? ` (field: ${error.field})` : ""}`;
  }

  if (error instanceof ToolExecutionError) {
    return `Tool "${error.toolName}" failed: ${error.message}`;
  }

  if (error instanceof Error) {
    // Don't expose internal error details in production
    if (process.env.NODE_ENV === "production") {
      return "An unexpected error occurred. Please try again.";
    }
    return error.message;
  }

  return "An unknown error occurred. Please try again.";
}

// Safe JSON parsing with better error messages
export function safeJsonParse<T>(json: string, context?: string): T {
  try {
    return JSON.parse(json);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown parsing error";
    throw new ValidationError(
      `Invalid JSON format${context ? ` in ${context}` : ""}: ${message}`,
    );
  }
}

// Safe fetch with timeout and better error handling
export async function safeFetch(
  url: string,
  options: RequestInit = {},
  timeoutMs = 30000,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new ConnectionError(
        `HTTP ${response.status}: ${response.statusText}`,
        url,
      );
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new ConnectionError(`Request timeout after ${timeoutMs}ms`, url);
      }
      if (error.message.includes("fetch")) {
        throw new ConnectionError(`Network error: ${error.message}`, url);
      }
    }

    throw error;
  }
}
