import fs from "fs/promises";
import { resolveInSandbox } from "../../sandbox";

export const name = "createDirectory";
export const description = "Create a directory in the sandbox";
export const schema = {
  type: "object",
  properties: {
    path: { type: "string" },
    recursive: { type: "boolean", default: false },
  },
  required: ["path"],
};

export async function run(params: {
  path: string;
  recursive?: boolean;
}): Promise<string> {
  try {
    const safePath = resolveInSandbox(params.path);
    await fs.mkdir(safePath, { recursive: params.recursive || false });
    return `Directory created: ${params.path}`;
  } catch (error) {
    throw new Error(
      `Failed to create directory: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
