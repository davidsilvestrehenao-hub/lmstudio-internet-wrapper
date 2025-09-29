import AdmZip from "adm-zip";
import { resolveInSandbox } from "../../sandbox";

export const name = "unzipFile";
export const description = "Extract a .zip archive into the sandbox";
export const schema = {
  type: "object",
  properties: {
    archive: { type: "string" },
    outputDir: { type: "string" },
  },
  required: ["archive", "outputDir"],
};

export async function run(params: {
  archive: string;
  outputDir: string;
}): Promise<string> {
  try {
    const safeArchive = resolveInSandbox(params.archive);
    const safeOutput = resolveInSandbox(params.outputDir);

    const zip = new AdmZip(safeArchive);
    zip.extractAllTo(safeOutput, true);

    return `Archive extracted to: ${safeOutput}`;
  } catch (err: unknown) {
    return `Unzip error: ${err instanceof Error ? err.message : String(err)}`;
  }
}
