import { spawn } from "node:child_process";

export const name = "executeCommand";
export const description = "Execute a shell command (sandboxed for security)";
export const schema = {
  type: "object",
  properties: {
    command: { type: "string" },
    args: {
      type: "array",
      items: { type: "string" },
      default: [],
    },
    timeout: { type: "number", default: 30000 },
    workingDirectory: { type: "string", default: "." },
  },
  required: ["command"],
};

export async function run(params: {
  command: string;
  args?: string[];
  timeout?: number;
  workingDirectory?: string;
}): Promise<string> {
  try {
    // Security: Only allow safe commands
    const allowedCommands = [
      "ls",
      "pwd",
      "whoami",
      "date",
      "echo",
      "cat",
      "head",
      "tail",
      "wc",
      "sort",
      "uniq",
      "grep",
      "find",
      "which",
      "type",
      "env",
      "ps",
      "df",
      "du",
      "free",
      "uptime",
      "uname",
      "id",
      "groups",
    ];

    if (!allowedCommands.includes(params.command)) {
      throw new Error(
        `Command '${params.command}' is not allowed for security reasons`,
      );
    }

    const timeoutMs = params.timeout || 30000;
    const workingDir = params.workingDirectory || ".";

    return new Promise((resolve, reject) => {
      const process = spawn(params.command, params.args || [], {
        cwd: workingDir,
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
      });

      let stdout = "";
      let stderr = "";

      process.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      process.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      const timeout = setTimeout(() => {
        process.kill();
        reject(new Error(`Command timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      process.on("close", (code) => {
        clearTimeout(timeout);

        const result = {
          command: params.command,
          args: params.args || [],
          workingDirectory: workingDir,
          exitCode: code,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          success: code === 0,
        };

        if (code === 0) {
          resolve(JSON.stringify(result, null, 2));
        } else {
          reject(
            new Error(
              `Command failed with exit code ${code}: ${stderr || stdout}`,
            ),
          );
        }
      });

      process.on("error", (error) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to execute command: ${error.message}`));
      });
    });
  } catch (error) {
    throw new Error(
      `Command execution failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
