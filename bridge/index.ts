import "../env.js";
import { App } from "@slack/bolt";
import { createHttpApp } from "./http-server.js";
import { runAgentTurn } from "./session-client.js";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} manquant dans .env`);
  return v;
}

const defaultChannelId = process.env.SLACK_GTM_CHANNEL_ID ?? "";
const companyName = process.env.COMPANY_NAME ?? "Acme SaaS";
const companyDomain = process.env.COMPANY_DOMAIN ?? "example.com";
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

function helpText(): string {
  return (
    "Commandes :\n" +
    "`/sam intro` — présentation\n" +
    "`/sam onboard [domain]` — découverte entreprise\n" +
    "`/sam status` — état onboarding\n" +
    "`/sam book-hos` — book call Head of Sales\n" +
    "`/sam book-ae @person` — book call AE\n" +
    "`/sam prep-interview @person` — préparer une interview\n" +
    "`/sam launch-meet <url>` — lancer Gradium sur un Meet\n" +
    "`/sam reset` — nouvelle session (mémoire conservée)"
  );
}

app.command("/sam", async ({ command, ack }) => {
  await ack();
  const raw = (command.text ?? "").trim();
  const channel = command.channel_id;
  const parts = raw.split(/\s+/);
  const sub = (parts[0] ?? "").toLowerCase();
  const rest = parts.slice(1).join(" ").trim();

  try {
    if (sub === "intro" || sub === "") {
      await dispatchToAgent(
        `L'utilisateur a tapé /sam intro dans le channel ${channel}. ` +
          `Présente-toi comme Sam, stagiaire GTM jour 1 chez ${companyName}. ` +
          `Résume où tu en es dans l'onboarding (lis onboarding/status.md). ` +
          `Propose la prochaine étape (souvent /sam onboard ou book HoS). channel_id="${channel}".`,
        channel
      );
      return;
    }

    if (sub === "onboard") {
      const domain = rest || companyDomain;
      await dispatchToAgent(
        `L'utilisateur lance l'onboarding (/sam onboard) pour le domaine "${domain}" (entreprise ${companyName}). ` +
          `Exécute l'Étape A : deep search web + MCP Notion/HubSpot/Slack si disponibles. ` +
          `Documente dans company/research.md et company/internal.md. ` +
          `Formule 3 hypothèses ICP préliminaires. Poste la synthèse Slack (blocks). channel_id="${channel}".`,
        channel
      );
      return;
    }

    if (sub === "status") {
      await dispatchToAgent(
        `L'utilisateur demande le statut onboarding (/sam status) dans ${channel}. ` +
          `Lis onboarding/status.md et résume : étape, HoS fait ou non, AE calls, hypothèses, prochaine action. channel_id="${channel}".`,
        channel
      );
      return;
    }

    if (sub === "book-hos") {
      await dispatchToAgent(
        `L'utilisateur demande de booker le Head of Sales (/sam book-hos). ` +
          `Email HoS si connu: ${hosEmail || "(demander via Slack)"}. ` +
          `Utilise MCP Google Workspace pour proposer un créneau 30 min. ` +
          `Puis prépare le brief Gradium et annonce les prochaines étapes. channel_id="${channel}".`,
        channel
      );
      return;
    }

    if (sub === "book-ae") {
      const person = rest || "(non précisé — demander qui)";
      await dispatchToAgent(
        `L'utilisateur demande de booker un AE (/sam book-ae) : ${person}. ` +
          `Vérifie dans onboarding/status.md que le call HoS est fait. Si non, refuse poliment et rappelle la règle HoS d'abord. ` +
          `Sinon book via Google Workspace MCP et prépare l'interview. channel_id="${channel}".`,
        channel
      );
      return;
    }

    if (sub === "prep-interview") {
      const person = rest || "(non précisé)";
      await dispatchToAgent(
        `L'utilisateur demande la prep interview (/sam prep-interview) pour : ${person}. ` +
          `Exécute l'Étape D : contexte, hypothèses H1-H3, 8-12 questions ouvertes, plan post-call. ` +
          `slack_post_blocks dans ${channel}. Sauvegarde dans interviews/. channel_id="${channel}".`,
        channel
      );
      return;
    }

    if (sub === "launch-meet") {
      const meetUrl = rest;
      if (!meetUrl) {
        await app.client.chat.postMessage({
          channel,
          text: "Usage : `/sam launch-meet https://meet.google.com/xxx-xxxx-xxx`",
        });
        return;
      }
      await dispatchToAgent(
        `L'utilisateur demande de lancer Gradium (/sam launch-meet) sur : ${meetUrl}. ` +
          `Génère le brief ≤4096 car. (template gradium-brief), puis appelle launch_meet_interview. ` +
          `Confirme dans Slack. channel_id="${channel}".`,
        channel
      );
      return;
    }

    if (sub === "reset") {
      await dispatchToAgent(
        `L'utilisateur a demandé /sam reset. Confirme qu'une nouvelle session démarre mais que le Memory Store ` +
          `(hypothèses, debriefs) est conservé. Résume l'état onboarding actuel. channel_id="${channel}".`,
        channel,
        ""
      );
      return;
    }

    await app.client.chat.postMessage({ channel, text: helpText() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("/sam error:", msg);
    await app.client.chat.postMessage({ channel, text: `Erreur Sam : ${msg}` });
  }
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
