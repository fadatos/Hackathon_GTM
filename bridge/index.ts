import "../env.js";
import { App } from "@slack/bolt";
import { runAgentTurn } from "./session-client.js";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} manquant dans .env`);
  return v;
}

const defaultChannelId = process.env.SLACK_GTM_CHANNEL_ID ?? "";

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

app.command("/sam", async ({ command, ack }) => {
  await ack();
  const sub = (command.text ?? "").trim().toLowerCase();
  const channel = command.channel_id;

  try {
    if (sub === "intro" || sub === "") {
      await dispatchToAgent(
        `L'utilisateur a tapé /sam intro dans le channel Slack ${channel}. ` +
          `Présente-toi comme Sam, nouveau stagiaire GTM. Explique brièvement ce que tu as appris ` +
          `en onboarding et propose un 1:1 Meet à l'AE. Utilise slack_post ou slack_post_blocks avec channel_id="${channel}".`,
        channel
      );
      return;
    }

    if (sub === "status") {
      await dispatchToAgent(
        `L'utilisateur demande le statut (/sam status) dans le channel ${channel}. ` +
          `Résume où tu en es dans ton onboarding GTM. channel_id="${channel}".`,
        channel
      );
      return;
    }

    if (sub === "reset") {
      await dispatchToAgent(
        `L'utilisateur a demandé un reset (/sam reset). Confirme que tu repars sur une nouvelle semaine GTM. channel_id="${channel}".`,
        channel
      );
      return;
    }

    await app.client.chat.postMessage({
      channel,
      text: "Commandes : `/sam intro` | `/sam status` | `/sam reset`",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("/sam error:", msg);
    await app.client.chat.postMessage({
      channel,
      text: `Erreur Sam : ${msg}`,
    });
  }
});

// Boutons Block Kit (pour étapes ultérieures)
app.action("launch_sourcing", async ({ ack, body }) => {
  await ack();
  const channel = body.channel?.id;
  if (!channel) return;
  await dispatchToAgent(
    `L'AE a cliqué "Lancer sourcing" dans le channel ${channel}. ` +
      `Confirme que tu vas sourcer via Sillage (signaux actifs uniquement). channel_id="${channel}".`,
    channel
  );
});

app.action("approve_messages", async ({ ack, body }) => {
  await ack();
  const channel = body.channel?.id;
  if (!channel) return;
  await dispatchToAgent(
    `L'AE a validé la trame de messages. Prépare le brief campagne. channel_id="${channel}".`,
    channel
  );
});

app.action("approve_campaign", async ({ ack, body }) => {
  await ack();
  const channel = body.channel?.id;
  if (!channel) return;
  await dispatchToAgent(
    `L'AE a approuvé la campagne. Confirme le déploiement de la séquence. channel_id="${channel}".`,
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

  try {
    const auth = await app.client.auth.test();
    console.log(`Slack bot: @${auth.user} (${auth.team})`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Slack auth.test échoué: ${msg}`);
  }

  await app.start(port);
  console.log(`Sam bridge actif — Socket Mode (port ${port})`);
  console.log("Slack: /sam intro | /sam status | /sam reset");
}

main().catch((err) => {
  console.error("Bridge fatal:", err);
  process.exit(1);
});
