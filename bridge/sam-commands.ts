import type { App } from "@slack/bolt";
import type { runAgentTurn } from "./session-client.js";

type SlackClient = Parameters<typeof runAgentTurn>[1]["slack"];

export type SamContext = {
  app: App;
  companyName: string;
  companyDomain: string;
  hosEmail: string;
  dispatchToAgent: (
    userMessage: string,
    channelId: string,
    thinkingMessage?: string
  ) => Promise<void>;
};

export function helpText(): string {
  return (
    "Commandes :\n" +
    "`/sam-onboard [domain]` — découverte entreprise *(recommandé)*\n" +
    "`/sam-intro` — présentation\n" +
    "`/sam-status` — état onboarding\n" +
    "`/sam-book-hos` — book call Head of Sales\n" +
    "`/sam-book-ae @person` — book call AE\n" +
    "`/sam-prep-interview @person` — préparer une interview\n" +
    "`/sam-launch-meet <url>` — lancer Gradium sur un Meet\n" +
    "`/sam-reset` — nouvelle session (mémoire conservée)\n" +
    "\nLegacy : `/sam onboard`, `/sam intro`, etc."
  );
}

function logSlash(cmd: string, channel: string, text: string): void {
  console.log(`[slash] ${cmd} channel=${channel} text="${text}"`);
}

export async function handleSamSubcommand(
  ctx: SamContext,
  channel: string,
  sub: string,
  rest: string
): Promise<void> {
  const { app, companyName, companyDomain, hosEmail, dispatchToAgent } = ctx;

  if (sub === "intro" || sub === "") {
    await dispatchToAgent(
      `L'utilisateur a tapé /sam intro dans le channel ${channel}. ` +
        `Présente-toi comme Sam, stagiaire GTM jour 1 chez ${companyName}. ` +
        `Résume où tu en es dans l'onboarding (lis onboarding/status.md). ` +
        `Propose la prochaine étape (souvent /sam-onboard ou book HoS). channel_id="${channel}".`,
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
        text: "Usage : `/sam-launch-meet https://meet.google.com/xxx-xxxx-xxx`",
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
}

const DEDICATED_COMMANDS: Array<{ command: string; sub: string }> = [
  { command: "/sam-onboard", sub: "onboard" },
  { command: "/sam-intro", sub: "intro" },
  { command: "/sam-status", sub: "status" },
  { command: "/sam-book-hos", sub: "book-hos" },
  { command: "/sam-book-ae", sub: "book-ae" },
  { command: "/sam-prep-interview", sub: "prep-interview" },
  { command: "/sam-launch-meet", sub: "launch-meet" },
  { command: "/sam-reset", sub: "reset" },
];

export function registerSamCommands(ctx: SamContext): void {
  const { app } = ctx;

  for (const { command, sub } of DEDICATED_COMMANDS) {
    app.command(command, async ({ command: cmd, ack }) => {
      await ack();
      const text = (cmd.text ?? "").trim();
      logSlash(command, cmd.channel_id, text);
      try {
        await handleSamSubcommand(ctx, cmd.channel_id, sub, text);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`${command} error:`, msg);
        await app.client.chat.postMessage({
          channel: cmd.channel_id,
          text: `Erreur Sam : ${msg}`,
        });
      }
    });
  }

  app.command("/sam", async ({ command, ack }) => {
    await ack();
    const raw = (command.text ?? "").trim();
    logSlash("/sam", command.channel_id, raw);
    const parts = raw.split(/\s+/);
    const sub = (parts[0] ?? "").toLowerCase();
    const rest = parts.slice(1).join(" ").trim();

    try {
      await handleSamSubcommand(ctx, command.channel_id, sub, rest);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("/sam error:", msg);
      await app.client.chat.postMessage({
        channel: command.channel_id,
        text: `Erreur Sam : ${msg}`,
      });
    }
  });
}
