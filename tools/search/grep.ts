import fs from "fs/promises";
import { resolveInSandbox } from "../../sandbox";

export const name = "grep";
export const description = "Search for text patterns in files";
export const schema = {
  type: "object",
  properties: {
    pattern: { type: "string" },
    path: { type: "string" },
    caseSensitive: { type: "boolean", default: false },
    wholeWord: { type: "boolean", default: false },
  },
  required: ["pattern", "path"],
};

export async function run(params: {
  pattern: string;
  path: string;
  caseSensitive?: boolean;
  wholeWord?: boolean;
}): Promise<string> {
  try {
    const safePath = resolveInSandbox(params.path);
    const stats = await fs.stat(safePath);

    if (stats.isDirectory()) {
      throw new Error("Path must be a file, not a directory");
    }

    const content = await fs.readFile(safePath, "utf-8");
    const lines = content.split("\n");

    const flags = params.caseSensitive ? "g" : "gi";
    const wordBoundary = params.wholeWord ? "\\b" : "";
    const regex = new RegExp(
      `${wordBoundary}${params.pattern}${wordBoundary}`,
      flags,
    );

    const matches: Array<{ line: number; content: string; match: string }> = [];

    lines.forEach((line, index) => {
      const lineMatches = line.match(regex);
      if (lineMatches) {
        matches.push({
          line: index + 1,
          content: line.trim(),
          match: lineMatches[0],
        });
      }
    });

    const result = {
      pattern: params.pattern,
      file: params.path,
      totalMatches: matches.length,
      matches: matches,
    };

    return JSON.stringify(result, null, 2);
  } catch (error) {
    throw new Error(
      `Failed to search in file: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
