import fs from "fs/promises";
import path from "path";
import { resolveInSandbox } from "../../sandbox";

export const name = "findFiles";
export const description = "Find files by name pattern in the sandbox";
export const schema = {
  type: "object",
  properties: {
    pattern: { type: "string" },
    directory: { type: "string", default: "." },
    includeDirectories: { type: "boolean", default: false },
    maxDepth: { type: "number", default: 10 },
  },
  required: ["pattern"],
};

async function searchDirectory(
  dir: string,
  currentDepth: number,
  params: { maxDepth?: number; includeDirectories?: boolean },
  regex: RegExp,
  safeDir: string,
  results: Array<{ path: string; type: string; size?: number }>,
): Promise<void> {
  if (currentDepth > (params.maxDepth || 10)) {
    return;
  }

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(safeDir, fullPath);

      if (entry.isDirectory()) {
        if (params.includeDirectories && regex.test(entry.name)) {
          const stats = await fs.stat(fullPath);
          results.push({
            path: relativePath,
            type: "directory",
            size: stats.size,
          });
        }
        await searchDirectory(
          fullPath,
          currentDepth + 1,
          params,
          regex,
          safeDir,
          results,
        );
      } else if (entry.isFile()) {
        if (regex.test(entry.name)) {
          const stats = await fs.stat(fullPath);
          results.push({
            path: relativePath,
            type: "file",
            size: stats.size,
          });
        }
      }
    }
  } catch (error) {
    // Skip directories we can't read
  }
}

export async function run(params: {
  pattern: string;
  directory?: string;
  includeDirectories?: boolean;
  maxDepth?: number;
}): Promise<string> {
  try {
    const searchDir = params.directory || ".";
    const safeDir = resolveInSandbox(searchDir);
    const results: Array<{ path: string; type: string; size?: number }> = [];

    const regex = new RegExp(params.pattern, "i");

    await searchDirectory(safeDir, 0, params, regex, safeDir, results);

    const result = {
      pattern: params.pattern,
      directory: searchDir,
      totalFound: results.length,
      files: results,
    };

    return JSON.stringify(result, null, 2);
  } catch (error) {
    throw new Error(
      `Failed to find files: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
