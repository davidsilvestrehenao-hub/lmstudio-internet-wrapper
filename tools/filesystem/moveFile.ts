import fs from "fs/promises";
import { resolveInSandbox } from "../../sandbox";

export const name = "moveFile";
export const description = "Move or rename a file/directory in the sandbox";
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
    await fs.rename(safeSource, safeDestination);
    return `Moved ${params.source} to ${params.destination}`;
  } catch (error) {
    throw new Error(
      `Failed to move file: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
