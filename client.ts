type LMStudioResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export type ChatChunk = { type: "chunk"; data: string };
export type ChatDone = { type: "done" };
export type ChatError = { type: "error"; error: string };
export type ChatEvent = ChatChunk | ChatDone | ChatError;

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type Options = {
  transport?: "sse" | "ws";
  stream?: boolean;
};

export class ChatClient {
  constructor(private baseUrl: string = "http://localhost:3000") {}

  // Unified streaming chat
  async chat(
    messages: ChatMessage[],
    onEvent: (event: ChatEvent) => void,
    options: Options = {},
  ) {
    const { transport = "sse", stream = true } = options;

    if (transport === "sse") {
      return this.chatSSE(messages, onEvent, stream);
    } else {
      return this.chatWS(messages, onEvent);
    }
  }

  private async chatSSE(
    messages: ChatMessage[],
    onEvent: (event: ChatEvent) => void,
    stream: boolean,
  ) {
    const resp = await fetch(`${this.baseUrl}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, stream }),
    });

    if (!stream) {
      const data = (await resp.json()) as LMStudioResponse;
      onEvent({
        type: "chunk",
        data: data.choices?.[0]?.message?.content || "",
      });
      onEvent({ type: "done" });
      return;
    }

    const reader = resp.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      for (const line of text.split("\n")) {
        if (line.startsWith("data: ")) {
          try {
            const event = JSON.parse(line.slice(6).trim());
            onEvent(event);
          } catch {
            // ignore malformed chunks
          }
        }
      }
    }
  }

  private chatWS(messages: ChatMessage[], onEvent: (event: ChatEvent) => void) {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`${this.baseUrl.replace("http", "ws")}/ws`);

      ws.onopen = () => {
        ws.send(JSON.stringify({ messages }));
      };

      ws.onmessage = (msg) => {
        try {
          const event = JSON.parse(msg.data.toString());
          onEvent(event);
          if (event.type === "done") {
            ws.close();
            resolve();
          }
        } catch (err) {
          reject(err);
        }
      };

      ws.onerror = (err) => {
        reject(err);
      };
    });
  }

  // Tool discovery
  async listTools() {
    const resp = await fetch(`${this.baseUrl}/tools`);
    return resp.json();
  }

  // Tool call
  async callTool(name: string, params: Record<string, unknown>) {
    const resp = await fetch(`${this.baseUrl}/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: name, params }),
    });
    return resp.json();
  }
}
