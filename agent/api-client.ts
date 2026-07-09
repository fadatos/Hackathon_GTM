const BETA_HEADER = "managed-agents-2026-04-01";
const API_VERSION = "2023-06-01";
const BASE_URL = "https://api.anthropic.com/v1";

export type Json = Record<string, unknown>;

function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY manquant dans .env");
  return key;
}

export async function anthropicFetch<T = Json>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "x-api-key": getApiKey(),
      "anthropic-version": API_VERSION,
      "anthropic-beta": BETA_HEADER,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Anthropic API ${res.status} ${path}: ${text}`);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export async function* streamSessionEvents(sessionId: string): AsyncGenerator<Json> {
  const res = await fetch(`${BASE_URL}/sessions/${sessionId}/events/stream`, {
    headers: {
      "x-api-key": getApiKey(),
      "anthropic-version": API_VERSION,
      "anthropic-beta": BETA_HEADER,
      accept: "text/event-stream",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stream ${res.status}: ${text}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("Pas de body dans le stream SSE");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        yield JSON.parse(payload) as Json;
      } catch {
        // ignorer lignes non-JSON
      }
    }
  }
}
