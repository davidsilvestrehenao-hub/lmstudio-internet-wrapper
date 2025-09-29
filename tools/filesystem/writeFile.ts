import fs from "fs/promises";
import { resolveInSandbox } from "../../sandbox";

export const name = "writeFile";
export const description = "Write text content to a sandboxed file path";
export const schema = {
  type: "object",
  properties: {
    path: { type: "string" },
    content: { type: "string" },
  },
  required: ["path", "content"],
};

export async function run(params: {
  path: string;
  content: string;
}): Promise<string> {
  try {
    const safePath = resolveInSandbox(params.path);
    await fs.writeFile(safePath, params.content, "utf-8");
    return `File written successfully: ${safePath}`;
  } catch (err: unknown) {
    return `Write error: ${err instanceof Error ? err.message : String(err)}`;
  }
}
