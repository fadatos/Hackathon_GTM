#!/usr/bin/env tsx
/**
 * E2E test : tour agent complet avec post Slack réel (équivalent /sam intro).
 */
import "../env.js";
import { WebClient } from "@slack/web-api";
import { runAgentTurn } from "../bridge/session-client.js";

async function main(): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_GTM_CHANNEL_ID;
  if (!token) throw new Error("SLACK_BOT_TOKEN manquant");
  if (!channel) throw new Error("SLACK_GTM_CHANNEL_ID manquant");

  const slack = new WebClient(token);
  const auth = await slack.auth.test();
  console.log(`Bot connecté: @${auth.user} (team ${auth.team})`);

  await runAgentTurn(
    `Test E2E : l'utilisateur a tapé /sam intro dans le channel ${channel}. ` +
      `Présente-toi comme Sam via slack_post avec channel_id="${channel}".`,
    {
      slack,
      defaultChannelId: channel,
      onAgentMessage: (t) => console.log("[agent]", t.slice(0, 100)),
      onToolUse: (name) => console.log("[tool]", name),
    }
  );

  console.log("OK — message Sam posté dans #gtm");
}

main().catch((err) => {
  console.error("test-slack-intro failed:", err.message);
  process.exit(1);
});
