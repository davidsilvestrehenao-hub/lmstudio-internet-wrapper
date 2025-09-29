import { logger } from "../logger";

async function isPortAvailable(port: number): Promise<boolean> {
  try {
    const server = Bun.serve({
      port,
      fetch() {
        return new Response();
      },
    });
    server.stop();
    return true;
  } catch {
    return false;
  }
}

export async function findAvailablePort(
  startPort: number,
  options: {
    maxAttempts?: number;
    serviceName?: string;
  } = {},
): Promise<number> {
  const { maxAttempts = 10, serviceName = "service" } = options;

  for (let port = startPort; port < startPort + maxAttempts; port++) {
    if (await isPortAvailable(port)) {
      if (port !== startPort) {
        logger.info(
          `Port ${startPort} is in use, using port ${port} for ${serviceName}`,
        );
      }
      return port;
    }
  }

  throw new Error(
    `No available ports found after ${maxAttempts} attempts starting from ${startPort} for ${serviceName}`,
  );
}

export async function startServerWithPortRetry<T>(
  createServer: (port: number) => Promise<T> | T,
  options: {
    startPort: number;
    maxAttempts?: number;
    serviceName?: string;
  },
): Promise<{ server: T; port: number }> {
  const port = await findAvailablePort(options.startPort, options);
  const server = await createServer(port);
  return { server, port };
}
