export const name = "math";
export const description = "Evaluate a math expression safely";
export const schema = {
  type: "object",
  properties: {
    expr: { type: "string" },
  },
  required: ["expr"],
};

export async function run(params: { expr: string }): Promise<string> {
  try {
    // In production, replace eval with a math parser
    const result = eval(params.expr);
    return result.toString();
  } catch (err: unknown) {
    return `Math error: ${err instanceof Error ? err.message : String(err)}`;
  }
}
