#!/usr/bin/env tsx
/**
 * Test du loop Managed Agent sans Slack (dry-run des custom tools).
 */
import "../env.js";
import { runAgentTurn } from "../bridge/session-client.js";

async function main(): Promise<void> {
  const channel = process.env.SLACK_GTM_CHANNEL_ID ?? "C_DEMO_CHANNEL";

  console.log("=== Demo run (sans Slack) ===\n");
  console.log(`Session: ${process.env.SESSION_ID ?? "(voir bridge/session.json)"}\n`);

  await runAgentTurn(
    `Test demo-run : l'utilisateur simule /sam intro dans le channel ${channel}. ` +
      `Présente-toi brièvement via slack_post avec channel_id="${channel}".`,
    {
      defaultChannelId: channel,
      onAgentMessage: (t) => console.log("[agent.message]", t),
      onToolUse: (name) => console.log("[custom_tool]", name),
    }
  );

  console.log("\n=== Demo run terminé ===");
}

main().catch((err) => {
  console.error("demo-run failed:", err.message);
  process.exit(1);
});
