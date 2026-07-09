import type { WebClient } from "@slack/web-api";

export type CustomToolInput = Record<string, unknown>;

export type CustomToolResult = {
  ok: boolean;
  message?: string;
  ts?: string;
  error?: string;
};

export async function executeCustomTool(
  name: string,
  input: CustomToolInput,
  slack: WebClient,
  defaultChannelId: string
): Promise<CustomToolResult> {
  const channel = (input.channel_id as string) || defaultChannelId;

  if (!channel) {
    return { ok: false, error: "channel_id manquant" };
  }

  try {
    if (name === "slack_post") {
      const text = input.text as string;
      if (!text) return { ok: false, error: "text manquant" };
      const res = await slack.chat.postMessage({ channel, text });
      return { ok: true, message: "Message posté", ts: res.ts as string };
    }

    if (name === "slack_post_blocks") {
      const text = input.text as string;
      const blocks = input.blocks as unknown[];
      if (!text || !blocks?.length) {
        return { ok: false, error: "text et blocks requis" };
      }
      const res = await slack.chat.postMessage({
        channel,
        text,
        blocks: blocks as never,
      });
      return { ok: true, message: "Message blocks posté", ts: res.ts as string };
    }

    return { ok: false, error: `Tool inconnu: ${name}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
