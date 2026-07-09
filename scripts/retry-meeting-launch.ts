#!/usr/bin/env tsx
/** Relance launch_meet_interview pour un Meet URL via le bridge (test E2E). */
import "../env.js";
import { WebClient } from "@slack/web-api";
import { runAgentTurn } from "../bridge/session-client.js";
import { dispatchVocalLaunch } from "../bridge/meet-url.js";

const meetUrl = process.argv[2] ?? "https://meet.google.com/avf-pmqd-hhc";
const channel = process.env.SLACK_GTM_CHANNEL_ID!;
const slack = new WebClient(process.env.SLACK_BOT_TOKEN!);

const msg = dispatchVocalLaunch(
  'slack_user_name="Alexis" ',
  channel,
  meetUrl,
  "RETRY: L'utilisateur relance /sam meeting. Appelle OBLIGATOIREMENT launch_meet_interview — ne dis pas que l'API est indisponible."
);

console.log("Dispatch:", meetUrl);

await runAgentTurn(msg, {
  slack,
  defaultChannelId: channel,
  onAgentMessage: (t) => console.log("[agent]", t.slice(0, 120)),
  onToolUse: (n) => console.log("[tool]", n),
});

console.log("Done");
