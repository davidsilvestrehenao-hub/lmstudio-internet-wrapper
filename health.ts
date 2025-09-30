import type { Context } from "hono";
import { config } from "./config";
import { safeFetch, formatUserError } from "./utils/error-handler";
import { logger } from "./logger";

// Import circuit breaker from server (we'll need to export it)
let circuitBreakerState: {
  state: string;
  failures: number;
  lastFailureTime: number;
} = {
  state: "unknown",
  failures: 0,
  lastFailureTime: 0,
};


export function setCircuitBreakerState(state: {
  state: string;
  failures: number;
  lastFailureTime: number;
}) {
  circuitBreakerState = state;
}

export async function healthCheck(c: Context): Promise<Response> {
  try {
    // Check LM Studio connection
    const lmStudioHealth = await checkLMStudioHealth();

    // Check loaded tools
    const toolsHealth = await checkToolsHealth();

    // Check circuit breaker state

    const overallHealth = lmStudioHealth && toolsHealth;

    return c.json({
      status: overallHealth ? "healthy" : "unhealthy",
      version: process.env.npm_package_version || "unknown",
      timestamp: new Date().toISOString(),
      checks: {
        lmStudio: lmStudioHealth,
        tools: toolsHealth,
        circuitBreaker: circuitBreakerState,
      },
    });
  } catch (error) {
    logger.error("Health check failed", { error });
    return c.json(
      {
        status: "unhealthy",
        error: formatUserError(error),
        timestamp: new Date().toISOString(),
      },
      500,
    );
  }
}

async function checkLMStudioHealth(): Promise<boolean> {
  try {
    const response = await safeFetch(
      `${config.lmStudioUrl}/v1/models`,
      {
        method: "GET",
      },
      5000,
    ); // 5 second timeout for health check
    return response.ok;
  } catch (error) {
    logger.warn("LM Studio health check failed", { error });
    return false;
  }
}

async function checkToolsHealth(): Promise<boolean> {
  try {
    // Check if tools directory is accessible
    const fs = await import("fs/promises");
    await fs.access("./tools");
    return true;
  } catch (error) {
    logger.warn("Tools health check failed", { error });
    return false;
  }
}
