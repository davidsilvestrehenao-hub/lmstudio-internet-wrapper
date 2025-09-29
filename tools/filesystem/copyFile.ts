import fs from "fs/promises";
import { resolveInSandbox } from "../../sandbox";

export const name = "copyFile";
export const description = "Copy a file or directory in the sandbox";
export const schema = {
  type: "object",
  properties: {
    source: { type: "string" },
    destination: { type: "string" },
  },
  required: ["source", "destination"],
};

export async function run(params: {
  source: string;
  destination: string;
}): Promise<string> {
  try {
    const safeSource = resolveInSandbox(params.source);
    const safeDestination = resolveInSandbox(params.destination);

    // Check if source is a directory
    const stat = await fs.stat(safeSource);
    if (stat.isDirectory()) {
      // For directories, we need to copy recursively
      await fs.cp(safeSource, safeDestination, { recursive: true });
    } else {
      // For files, use copyFile
      await fs.copyFile(safeSource, safeDestination);
    }

    return `Copied ${params.source} to ${params.destination}`;
  } catch (error) {
    throw new Error(
      `Failed to copy file: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
