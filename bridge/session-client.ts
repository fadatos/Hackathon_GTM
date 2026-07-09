import fs from "node:fs/promises";
import path from "node:path";
import type { WebClient } from "@slack/web-api";
import { anthropicFetch, streamSessionEvents, type Json } from "../agent/api-client.js";
import { executeCustomTool } from "./custom-tools.js";

const SESSION_FILE = path.join(process.cwd(), "bridge", "session.json");

export type PendingTool = {
  id: string;
  name: string;
  input: Record<string, unknown>;
};

export type RunContext = {
  slack?: WebClient;
  defaultChannelId: string;
  onAgentMessage?: (text: string) => void;
  onToolUse?: (name: string) => void;
};

async function loadSessionId(): Promise<string> {
  const fromEnv = process.env.SESSION_ID;
  if (fromEnv) return fromEnv;

  try {
    const raw = await fs.readFile(SESSION_FILE, "utf-8");
    const data = JSON.parse(raw) as { sessionId: string };
    return data.sessionId;
  } catch {
    throw new Error("SESSION_ID manquant — lancez npm run setup:agent");
  }
}

export async function ensureSession(): Promise<string> {
  return loadSessionId();
}

export async function sendUserMessage(sessionId: string, text: string): Promise<void> {
  await anthropicFetch(`/sessions/${sessionId}/events`, {
    method: "POST",
    body: {
      events: [
        {
          type: "user.message",
          content: [{ type: "text", text }],
        },
      ],
    },
  });
}

export async function sendCustomToolResult(
  sessionId: string,
  toolUseId: string,
  result: unknown
): Promise<void> {
  await anthropicFetch(`/sessions/${sessionId}/events`, {
    method: "POST",
    body: {
      events: [
        {
          type: "user.custom_tool_result",
          custom_tool_use_id: toolUseId,
          content: [{ type: "text", text: JSON.stringify(result) }],
        },
      ],
    },
  });
}

function extractTextFromAgentMessage(event: Json): string {
  const content = event.content as Array<{ type: string; text?: string }> | undefined;
  if (!content) return "";
  return content
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text!)
    .join("");
}

/**
 * Envoie un message utilisateur puis traite le stream jusqu'à idle.
 * Boucle tant que des custom tools sont en attente de résultat.
 */
export async function runAgentTurn(
  userMessage: string,
  ctx: RunContext
): Promise<void> {
  const sessionId = await ensureSession();
  await sendUserMessage(sessionId, userMessage);

  let continueLoop = true;

  while (continueLoop) {
    const pending: PendingTool[] = [];
    let sawIdle = false;

    for await (const event of streamSessionEvents(sessionId)) {
      const type = event.type as string;

      if (type === "agent.message") {
        const text = extractTextFromAgentMessage(event);
        if (text) ctx.onAgentMessage?.(text);
      }

      if (type === "agent.custom_tool_use") {
        pending.push({
          id: event.id as string,
          name: event.name as string,
          input: (event.input as Record<string, unknown>) ?? {},
        });
        ctx.onToolUse?.(event.name as string);
      }

      if (type === "session.error") {
        console.error("[session.error]", JSON.stringify(event));
      }

      if (type === "session.status_idle") {
        sawIdle = true;
        break;
      }
    }

    if (!sawIdle) {
      throw new Error("Stream terminé sans session.status_idle");
    }

    if (pending.length === 0) {
      continueLoop = false;
      break;
    }

    for (const tool of pending) {
      let result: unknown;
      if (ctx.slack) {
        result = await executeCustomTool(
          tool.name,
          tool.input,
          ctx.slack,
          ctx.defaultChannelId
        );
      } else {
        result = {
          ok: true,
          dryRun: true,
          tool: tool.name,
          input: tool.input,
        };
      }
      await sendCustomToolResult(sessionId, tool.id, result);
    }
  }
}
