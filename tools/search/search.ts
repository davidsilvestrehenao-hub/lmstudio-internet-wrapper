// Using Bun's built-in fetch

export const name = "search";
export const description = "Search the web using configurable search engines";
export const schema = {
  type: "object",
  properties: {
    query: { type: "string" },
    engine: {
      type: "string",
      enum: ["duckduckgo"],
      default: "duckduckgo",
    },
  },
  required: ["query"],
};

type SearchEngine = "duckduckgo";

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  const res = await fetch(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`,
  );
  const data = (await res.json()) as {
    AbstractText?: string;
    Heading?: string;
    AbstractURL?: string;
    RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
    Results?: Array<{ Text?: string; FirstURL?: string; URL?: string }>;
  };

  const results: SearchResult[] = [];

  // Add instant answer if available
  if (data.AbstractText) {
    results.push({
      title: data.Heading || "Instant Answer",
      url: data.AbstractURL || "",
      snippet: data.AbstractText,
      source: "DuckDuckGo",
    });
  }

  // Add related topics
  if (data.RelatedTopics) {
    data.RelatedTopics.forEach(
      (topic: { FirstURL?: string; Text?: string }) => {
        if (topic.FirstURL && topic.Text) {
          results.push({
            title: topic.Text.replace(/<[^>]*>/g, "")
              .split(" ")
              .slice(0, 10)
              .join(" "),
            url: topic.FirstURL,
            snippet: topic.Text.replace(/<[^>]*>/g, ""),
            source: "DuckDuckGo",
          });
        }
      },
    );
  }

  // Add regular results
  if (data.Results) {
    data.Results.forEach(
      (result: { Text?: string; FirstURL?: string; URL?: string }) => {
        results.push({
          title: result.Text || "No title",
          url: result.FirstURL || result.URL || "",
          snippet: result.Text || "",
          source: "DuckDuckGo",
        });
      },
    );
  }

  // If no results found, provide helpful feedback
  if (results.length === 0) {
    results.push({
      title: "No results found",
      url: "",
      snippet: `DuckDuckGo didn't return results for "${query}". This is common for:
- Recent news queries (DuckDuckGo API doesn't provide real-time news)
- Very specific or niche topics
- Queries that need real-time data

Try:
- More general search terms
- Broader topic keywords
- Using the fetch tool to get data from specific news websites`,
      source: "DuckDuckGo",
    });
  }

  return results.slice(0, 10); // Limit to 10 results
}




export async function run(params: {
  query: string;
  engine?: SearchEngine;
}): Promise<string> {
  try {
    const engine = params.engine || "duckduckgo";
    let results: SearchResult[] = [];

    switch (engine) {
      case "duckduckgo":
        results = await searchDuckDuckGo(params.query);
        break;
      default:
        throw new Error(`Unsupported search engine: ${engine}`);
    }

    return JSON.stringify(
      {
        query: params.query,
        engine: engine,
        results: results,
        count: results.length,
      },
      null,
      2,
    );
  } catch (err: unknown) {
    return `Search error: ${err instanceof Error ? err.message : String(err)}`;
  }
}
