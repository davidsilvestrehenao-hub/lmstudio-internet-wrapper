// Using Bun's built-in fetch

export const name = "fetch";
export const description = "Fetch raw content from a given URL";
export const schema = {
  type: "object",
  properties: {
    url: { type: "string" },
  },
  required: ["url"],
};

export async function run(params: { url: string }): Promise<string> {
  const res = await fetch(params.url);
  return await res.text();
}
