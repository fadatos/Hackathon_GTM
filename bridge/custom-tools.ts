import type { WebClient } from "@slack/web-api";

export type MeetInsightsPayload = {
  ae_name?: string;
  ae_slack_id?: string;
  meet_transcript_summary?: string;
  icp_signals?: string[];
  objections?: string[];
  quotes?: string[];
  confidence?: number;
  recording_url?: string;
};

export type LaunchMeetInput = {
  meet_url: string;
  prompt: string;
  /** @deprecated alias — mapped to prompt */
  brief?: string;
  interviewee_name?: string;
  interviewee_role?: string;
};

const PROMPT_MAX = 4096;

function resolvePrompt(input: LaunchMeetInput): string {
  return (input.prompt ?? input.brief ?? "").trim();
}

export async function launchMeetInterview(input: LaunchMeetInput): Promise<{
  ok: boolean;
  error?: string;
  gradium_response?: unknown;
  dry_run?: boolean;
}> {
  const { meet_url } = input;
  const prompt = resolvePrompt(input);

  if (!meet_url?.trim()) return { ok: false, error: "meet_url manquant" };
  if (!prompt) return { ok: false, error: "prompt manquant" };
  if (prompt.length > PROMPT_MAX) {
    return {
      ok: false,
      error: `prompt trop long (${prompt.length} > ${PROMPT_MAX} caractères)`,
    };
  }

  const apiUrl = process.env.GRADIUM_API_URL;

  if (!apiUrl) {
    console.log("[launch_meet_interview] dry-run", {
      meet_url,
      prompt_len: prompt.length,
    });
    return {
      ok: true,
      dry_run: true,
      gradium_response: {
        message: "GRADIUM_API_URL non configuré — simulation OK",
        meet_url,
      },
    };
  }

  const apiKey = process.env.GRADIUM_API_KEY;

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ meet_url, prompt }),
  });

  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* raw text */
  }

  if (!res.ok) {
    return { ok: false, error: `TACL ${res.status}: ${text}`, gradium_response: body };
  }

  return { ok: true, gradium_response: body };
}

export type CustomToolInput = Record<string, unknown>;

export type CustomToolResult = {
  ok: boolean;
  message?: string;
  ts?: string;
  error?: string;
  dry_run?: boolean;
  gradium_response?: unknown;
};

export async function executeCustomTool(
  name: string,
  input: CustomToolInput,
  slack: WebClient,
  defaultChannelId: string
): Promise<CustomToolResult> {
  const channel = (input.channel_id as string) || defaultChannelId;

  try {
    if (name === "slack_post") {
      if (!channel) return { ok: false, error: "channel_id manquant" };
      const text = input.text as string;
      if (!text) return { ok: false, error: "text manquant" };
      const res = await slack.chat.postMessage({ channel, text });
      return { ok: true, message: "Message posté", ts: res.ts as string };
    }

    if (name === "slack_post_blocks") {
      if (!channel) return { ok: false, error: "channel_id manquant" };
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

    if (name === "launch_meet_interview") {
      const result = await launchMeetInterview({
        meet_url: input.meet_url as string,
        prompt: (input.prompt ?? input.brief) as string,
        interviewee_name: input.interviewee_name as string | undefined,
        interviewee_role: input.interviewee_role as string | undefined,
      });
      return {
        ok: result.ok,
        error: result.error,
        dry_run: result.dry_run,
        gradium_response: result.gradium_response,
        message: result.ok ? "Agent vocal lancé sur le Meet (TACL)" : undefined,
      };
    }

    return { ok: false, error: `Tool inconnu: ${name}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
