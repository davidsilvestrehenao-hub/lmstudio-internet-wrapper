import fs from "fs/promises";
import { resolveInSandbox } from "../../sandbox";

export const name = "listFiles";
export const description = "List files in a sandboxed directory";
export const schema = {
  type: "object",
  properties: {
    path: { type: "string" },
  },
  required: ["path"],
};

export async function run(params: { path: string }): Promise<string> {
  try {
    const safeDir = resolveInSandbox(params.path);
    const entries = await fs.readdir(safeDir, { withFileTypes: true });
    const result = entries.map((e) => ({
      name: e.name,
      type: e.isDirectory() ? "directory" : "file",
    }));
    return JSON.stringify(result, null, 2);
  } catch (err: unknown) {
    return `List error: ${err instanceof Error ? err.message : String(err)}`;
  }
}
