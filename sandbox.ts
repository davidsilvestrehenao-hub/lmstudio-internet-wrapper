import path from "path";
import fs from "fs/promises";
import { config } from "./config";

// Get the configurable sandbox directory
const SANDBOX_ROOT = path.isAbsolute(config.sandboxDir)
  ? config.sandboxDir
  : path.resolve(process.cwd(), config.sandboxDir);

export async function ensureSandbox() {
  try {
    await fs.mkdir(SANDBOX_ROOT, { recursive: true });
  } catch {
    // ignore errors
  }
}

export function resolveInSandbox(p: string): string {
  const target = path.resolve(SANDBOX_ROOT, p);
  if (!target.startsWith(SANDBOX_ROOT)) {
    throw new Error("Path escapes sandbox");
  }
  return target;
}

export function getSandboxRoot(): string {
  return SANDBOX_ROOT;
}
