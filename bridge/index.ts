import "../env.js";
import { App } from "@slack/bolt";
import { createHttpApp } from "./http-server.js";
import { runAgentTurn } from "./session-client.js";
import { helpText, registerSamCommands } from "./sam-commands.js";
import { registerMeetLinkMessages } from "./meet-messages.js";
import { registerSamHomeMenu } from "./sam-home-menu.js";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} manquant dans .env`);
  return v;
}

const defaultChannelId = process.env.SLACK_GTM_CHANNEL_ID ?? "";
const companyName = process.env.COMPANY_NAME ?? "Sillage";
const companyDomain = process.env.COMPANY_DOMAIN ?? "getsillage.com";
const hosEmail = process.env.HOS_EMAIL ?? "";

const app = new App({
  token: requireEnv("SLACK_BOT_TOKEN"),
  appToken: requireEnv("SLACK_APP_TOKEN"),
  socketMode: true,
});

async function dispatchToAgent(
  userMessage: string,
  channelId: string,
  thinkingMessage = "Sam réfléchit..."
): Promise<void> {
  if (thinkingMessage) {
    await app.client.chat.postMessage({ channel: channelId, text: thinkingMessage });
  }

  await runAgentTurn(userMessage, {
    slack: app.client,
    defaultChannelId: channelId || defaultChannelId,
    onAgentMessage: (text) => console.log("[agent]", text.slice(0, 120)),
    onToolUse: (name) => console.log("[tool]", name),
  });
}

const samCtx = {
  app,
  companyName,
  companyDomain,
  hosEmail,
  dispatchToAgent,
};

registerSamHomeMenu(samCtx);
registerSamCommands(samCtx);

registerMeetLinkMessages(app, {
  ...samCtx,
  defaultChannelId,
});

app.action("launch_sourcing", async ({ ack, body }) => {
  await ack();
  const channel = body.channel?.id;
  if (!channel) return;
  await dispatchToAgent(
    `L'AE a cliqué "Lancer sourcing" dans ${channel}. Rappelle que Phase 1 onboarding doit être complète avant sourcing. channel_id="${channel}".`,
    channel
  );
});

app.action("approve_messages", async ({ ack, body }) => {
  await ack();
  const channel = body.channel?.id;
  if (!channel) return;
  await dispatchToAgent(
    `L'AE a validé la trame de messages dans ${channel}. Phase 2 pas encore active — résume prochaines étapes onboarding si besoin. channel_id="${channel}".`,
    channel
  );
});

app.action("approve_campaign", async ({ ack, body }) => {
  await ack();
  const channel = body.channel?.id;
  if (!channel) return;
  await dispatchToAgent(
    `L'AE a approuvé une campagne dans ${channel}. Phase 3 pas encore active. channel_id="${channel}".`,
    channel
  );
});

async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? 3000);

  const sessionId = process.env.SESSION_ID;
  if (!sessionId) {
    console.warn("⚠ SESSION_ID manquant — lancez npm run setup:agent");
  } else {
    console.log(`Session: ${sessionId}`);
  }

  if (process.env.MEMORY_STORE_ID) {
    console.log(`Memory Store: ${process.env.MEMORY_STORE_ID}`);
  }

  const auth = await app.client.auth.test();
  console.log(`Slack bot: @${auth.user} (${auth.team})`);

  const httpApp = createHttpApp({
    slack: app.client,
    defaultChannelId,
    memoryStoreId: process.env.MEMORY_STORE_ID,
  });
  httpApp.listen(port, () => {
    console.log(`HTTP webhook: http://localhost:${port}/webhooks/meet`);
    console.log(`Health: http://localhost:${port}/health`);
  });

  await app.start();
  console.log("Sam bridge actif — Socket Mode");
  console.log(helpText().replace(/\n/g, " | "));
}

main().catch((err) => {
  console.error("Bridge fatal:", err);
  process.exit(1);
});
