import fs from "fs/promises";
import { resolveInSandbox } from "../../sandbox";

export const name = "files";
export const description = "Read text content from a sandboxed file path";
export const schema = {
  type: "object",
  properties: {
    path: { type: "string" },
  },
  required: ["path"],
};

export async function run(params: { path: string }): Promise<string> {
  try {
    const safePath = resolveInSandbox(params.path);
    return await fs.readFile(safePath, "utf-8");
  } catch (err: unknown) {
    return `File error: ${err instanceof Error ? err.message : String(err)}`;
  }
}
