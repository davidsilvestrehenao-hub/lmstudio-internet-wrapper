import fs from "fs/promises";
import { resolveInSandbox } from "../../sandbox";

export const name = "getFileInfo";
export const description =
  "Get file or directory information (size, modified date, permissions)";
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
    const stats = await fs.stat(safePath);

    const info = {
      path: params.path,
      type: stats.isDirectory() ? "directory" : "file",
      size: stats.size,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      isSymbolicLink: stats.isSymbolicLink(),
      mode: stats.mode,
      uid: stats.uid,
      gid: stats.gid,
      atime: stats.atime.toISOString(),
      mtime: stats.mtime.toISOString(),
      ctime: stats.ctime.toISOString(),
      birthtime: stats.birthtime.toISOString(),
    };

    return JSON.stringify(info, null, 2);
  } catch (error) {
    throw new Error(
      `Failed to get file info: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
