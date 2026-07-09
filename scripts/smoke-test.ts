#!/usr/bin/env tsx
/**
 * Smoke test local — sans API Anthropic ni Slack réels.
 */
import { executeCustomTool } from "../bridge/custom-tools.js";

const posts: Array<{ channel: string; text: string; blocks?: unknown[] }> = [];

const mockSlack = {
  chat: {
    postMessage: async (args: { channel: string; text: string; blocks?: unknown[] }) => {
      posts.push(args);
      return { ok: true, ts: "1234.5678" };
    },
  },
} as never;

async function main(): Promise<void> {
  console.log("=== Smoke test ===\n");

  const r1 = await executeCustomTool(
    "slack_post",
    { text: "Hello from Sam", channel_id: "C_TEST" },
    mockSlack,
    "C_DEFAULT"
  );
  console.log("slack_post:", r1.ok ? "OK" : r1.error);

  const r2 = await executeCustomTool(
    "slack_post_blocks",
    {
      text: "ICP proposal",
      channel_id: "C_TEST",
      blocks: [{ type: "section", text: { type: "mrkdwn", text: "*ICP #1*" } }],
    },
    mockSlack,
    "C_DEFAULT"
  );
  console.log("slack_post_blocks:", r2.ok ? "OK" : r2.error);

  if (posts.length !== 2) {
    throw new Error(`Attendu 2 posts, reçu ${posts.length}`);
  }

  console.log("\nSmoke test OK");
}

main().catch((err) => {
  console.error("Smoke test failed:", err);
  process.exit(1);
});
