import fs from "fs/promises";
import path from "path";
import AdmZip from "adm-zip";
import { resolveInSandbox } from "../../sandbox";

export const name = "zipFiles";
export const description =
  "Compress multiple sandboxed files into a .zip archive";
export const schema = {
  type: "object",
  properties: {
    files: { type: "array", items: { type: "string" } },
    output: { type: "string" },
  },
  required: ["files", "output"],
};

export async function run(params: {
  files: string[];
  output: string;
}): Promise<string> {
  try {
    const zip = new AdmZip();

    for (const f of params.files) {
      const safePath = resolveInSandbox(f);
      const stat = await fs.stat(safePath);
      if (stat.isDirectory()) {
        zip.addLocalFolder(safePath, path.basename(f));
      } else {
        zip.addLocalFile(safePath);
      }
    }

    const outPath = resolveInSandbox(params.output);
    zip.writeZip(outPath);

    return `Archive created: ${outPath}`;
  } catch (err: unknown) {
    return `Zip error: ${err instanceof Error ? err.message : String(err)}`;
  }
}
