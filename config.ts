import { z } from "zod";
import { homedir } from "os";

const configSchema = z.object({
  port: z.number().default(3000),
  wsPort: z.number().default(3001),
  lmStudioUrl: z.string().url().default("http://localhost:1234"),
  lmStudioModel: z.string().default("qwen/qwen3-coder-30b"), // Configurable LM Studio model
  environment: z.enum(["development", "production"]).default("development"),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  requestTimeout: z.number().default(30000), // 30 seconds
  maxRetries: z.number().default(3),
  openapiAutoOpen: z.boolean().default(false), // Don't auto-open OpenAPI UI by default
  sandboxDir: z.string().default("./sandbox"), // Configurable sandbox directory
  rateLimit: z.object({
    windowMs: z.number().default(60000), // 1 minute
    max: z.number().default(100), // limit each IP to 100 requests per windowMs
  }),
});

export type Config = z.infer<typeof configSchema>;

const parseEnvConfig = () => {
  // Helper function to expand ~ to home directory
  const expandPath = (path: string): string => {
    if (path === "~" || path.startsWith("~/")) {
      return path.replace("~", homedir());
    }
    return path;
  };

  const config = {
    port: Number(process.env.PORT) || 3000,
    wsPort: Number(process.env.WS_PORT) || 3001,
    lmStudioUrl: process.env.LM_STUDIO_URL || "http://localhost:1234",
    lmStudioModel: process.env.LM_STUDIO_MODEL || "qwen/qwen3-coder-30b",
    environment: process.env.NODE_ENV || "development",
    logLevel: process.env.LOG_LEVEL || "info",
    requestTimeout: Number(process.env.REQUEST_TIMEOUT) || 30000,
    maxRetries: Number(process.env.MAX_RETRIES) || 3,
    openapiAutoOpen: process.env.OPENAPI_AUTO_OPEN === "true",
    sandboxDir: expandPath(process.env.SANDBOX_DIR || "./sandbox"),
    rateLimit: {
      windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
      max: Number(process.env.RATE_LIMIT_MAX) || 100,
    },
  };

  return configSchema.parse(config);
};

export const config = parseEnvConfig();
