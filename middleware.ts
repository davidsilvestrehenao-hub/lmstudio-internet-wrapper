import type { Context, Next } from "hono";
import { cors } from "hono/cors";
import { getConnInfo } from "hono/bun";
import { logger } from "./logger";
import { config } from "./config";

// Request logging middleware
export async function requestLogger(c: Context, next: Next) {
  const start = Date.now();
  const { method, url } = c.req;

  logger.info(`Request started`, { method, url });

  await next();

  const ms = Date.now() - start;
  logger.info(`Request completed`, {
    method,
    url,
    durationMs: ms,
    status: c.res.status,
  });
}

// Rate limiting middleware
const rateLimits = new Map<string, { count: number; reset: number }>();

export async function rateLimit(
  c: Context,
  next: Next,
): Promise<Response | void> {
  const connInfo = getConnInfo(c);
  const ip = connInfo.remote.address || "unknown";
  const now = Date.now();

  // This cleanup is inefficient and should be replaced with a better strategy for production
  for (const [key, value] of rateLimits.entries()) {
    if (value.reset < now) {
      rateLimits.delete(key);
    }
  }

  const current = rateLimits.get(ip) || {
    count: 0,
    reset: now + config.rateLimit.windowMs,
  };

  if (current.count >= config.rateLimit.max) {
    return c.json(
      {
        error: "Too many requests",
        retryAfter: Math.ceil((current.reset - now) / 1000),
      },
      429,
    );
  }

  rateLimits.set(ip, {
    count: current.count + 1,
    reset: current.reset,
  });

  return next();
}

// Error handling middleware
export async function errorHandler(err: Error, c: Context): Promise<Response> {
  logger.error(`Unhandled error`, { error: err.message, stack: err.stack });

  if (c.req.header("accept")?.includes("application/json")) {
    return c.json(
      {
        error:
          config.environment === "production"
            ? "Internal server error"
            : err.message,
      },
      500,
    );
  }

  return c.text("Internal Server Error", 500);
}

// Request timeout middleware
export async function timeout(c: Context, next: Next) {
  let isResolved = false;

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      if (!isResolved) {
        reject(new Error(`Request timeout after ${config.requestTimeout}ms`));
      }
    }, config.requestTimeout);
  });

  try {
    await Promise.race([next(), timeoutPromise]);
    isResolved = true;
  } catch (error) {
    isResolved = true;
    throw error;
  }
}

// Cors middleware
// In a production environment, you should restrict the origin to your frontend's domain.
const corsMiddleware = cors({
  origin: "*",
  allowHeaders: ["*"],
  allowMethods: ["*"],
});

export { corsMiddleware as cors };
