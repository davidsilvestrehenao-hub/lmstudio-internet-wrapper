// Using Bun's built-in fetch

export const name = "search";
export const description = "Search the web using configurable search engines";
export const schema = {
  type: "object",
  properties: {
    query: { type: "string" },
    engine: {
      type: "string",
      enum: ["duckduckgo", "google", "bing", "brave"],
      default: "duckduckgo",
    },
  },
  required: ["query"],
};

type SearchEngine = "duckduckgo" | "google" | "bing" | "brave";

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

  return results.slice(0, 10); // Limit to 10 results
}

async function searchGoogle(query: string): Promise<SearchResult[]> {
  // Note: This is a simplified example. Real Google Search API requires API key
  const res = await fetch(
    `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.GOOGLE_CX}&q=${encodeURIComponent(query)}`,
  );

  if (!res.ok) {
    throw new Error(
      "Google Search API requires GOOGLE_API_KEY and GOOGLE_CX environment variables",
    );
  }

  const data = (await res.json()) as {
    items?: Array<{
      title?: string;
      link?: string;
      snippet?: string;
    }>;
  };

  return (
    data.items?.map((item) => ({
      title: item.title || "No title",
      url: item.link || "",
      snippet: item.snippet || "",
      source: "Google",
    })) || []
  );
}

async function searchBing(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.BING_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Bing Search API requires BING_API_KEY environment variable",
    );
  }

  const res = await fetch(
    `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}`,
    {
      headers: {
        "Ocp-Apim-Subscription-Key": apiKey,
      },
    },
  );

  const data = (await res.json()) as {
    webPages?: {
      value?: Array<{
        name?: string;
        url?: string;
        snippet?: string;
      }>;
    };
  };

  return (
    data.webPages?.value?.map((item) => ({
      title: item.name || "No title",
      url: item.url || "",
      snippet: item.snippet || "",
      source: "Bing",
    })) || []
  );
}

async function searchBrave(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Brave Search API requires BRAVE_API_KEY environment variable",
    );
  }

  const res = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`,
    {
      headers: {
        "X-Subscription-Token": apiKey,
      },
    },
  );

  const data = (await res.json()) as {
    web?: {
      results?: Array<{
        title?: string;
        url?: string;
        description?: string;
      }>;
    };
  };

  return (
    data.web?.results?.map((item) => ({
      title: item.title || "No title",
      url: item.url || "",
      snippet: item.description || "",
      source: "Brave",
    })) || []
  );
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
      case "google":
        results = await searchGoogle(params.query);
        break;
      case "bing":
        results = await searchBing(params.query);
        break;
      case "brave":
        results = await searchBrave(params.query);
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
