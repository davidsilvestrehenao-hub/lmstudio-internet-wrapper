import fs from "fs/promises";
import { resolveInSandbox } from "../../sandbox";

export const name = "deleteFile";
export const description = "Delete a sandboxed file";
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
    await fs.unlink(safePath);
    return `File deleted: ${safePath}`;
  } catch (err: unknown) {
    return `Delete error: ${err instanceof Error ? err.message : String(err)}`;
  }
}
