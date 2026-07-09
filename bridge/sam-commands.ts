import type { App } from "@slack/bolt";
import type { SlashCommand } from "@slack/bolt";
import type { runAgentTurn } from "./session-client.js";
import {
  dispatchVocalLaunch,
  extractMeetUrl,
  meetUsageBlock,
  stripMeetUrl,
} from "./meet-url.js";

export type SlackRequester = {
  userId: string;
  userName: string;
  userEmail?: string;
};

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
    "`/sam-onboard [domain]` — digest onboarding + demande lien Meet\n" +
    "`/sam-meeting <meet_url>` — lancer agent vocal (sans onboarding)\n" +
    "`/sam-book-ae @person <meet_url>` — interview AE + agent vocal\n" +
    "`/sam-intro` — présentation\n" +
    "`/sam-status` — état onboarding\n" +
    "`/sam-book-hos` — prep call Head of Sales\n" +
    "`/sam-prep-interview @person` — préparer une interview\n" +
    "`/sam-launch-meet <url>` — alias meeting vocal\n" +
    "`/sam-reset` — nouvelle session (mémoire conservée)\n" +
    "\nLegacy : `/sam onboard`, `/sam meeting <url>`, etc."
  );
}

function logSlash(cmd: string, channel: string, text: string, userId?: string): void {
  console.log(`[slash] ${cmd} channel=${channel} user=${userId ?? "?"} text="${text}"`);
}

async function resolveUserEmail(
  app: App,
  userId: string
): Promise<string | undefined> {
  try {
    const info = await app.client.users.info({ user: userId });
    return info.user?.profile?.email ?? undefined;
  } catch {
    return undefined;
  }
}

function requesterContext(req: SlackRequester): string {
  const parts = [
    `slack_user_id="${req.userId}"`,
    `slack_user_name="${req.userName}"`,
  ];
  if (req.userEmail) parts.push(`slack_user_email="${req.userEmail}"`);
  return parts.join(" ");
}

async function postMeetUsage(
  app: App,
  channel: string,
  command: string,
  extraArgs = ""
): Promise<void> {
  await app.client.chat.postMessage({
    channel,
    text: `Usage : ${command} — lien Meet requis`,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: meetUsageBlock(command, extraArgs) },
      },
    ],
  });
}

export async function handleSamSubcommand(
  ctx: SamContext,
  channel: string,
  sub: string,
  rest: string,
  requester?: SlackRequester
): Promise<void> {
  const { app, companyName, companyDomain, hosEmail, dispatchToAgent } = ctx;
  const reqCtx = requester ? `${requesterContext(requester)} ` : "";

  if (sub === "intro" || sub === "") {
    await dispatchToAgent(
      `${reqCtx}L'utilisateur a tapé /sam intro dans le channel ${channel}. ` +
        `Présente-toi comme Sam, stagiaire GTM jour 1 chez ${companyName}. ` +
        `Résume où tu en es dans l'onboarding (lis onboarding/status.md). ` +
        `Propose la prochaine étape (souvent /sam-onboard). channel_id="${channel}".`,
      channel
    );
    return;
  }

  if (sub === "onboard") {
    const domain = rest || companyDomain;
    const demandeur = requester?.userName ?? "le demandeur";
    await dispatchToAgent(
      `${reqCtx}L'utilisateur lance /sam-onboard pour le domaine "${domain}" (entreprise ${companyName}). ` +
        `Exécute A1+A2 : recherche web+MCP, hypothèses draft, slack_post_blocks digest. ` +
        `En fin de digest, demande de répondre dans le thread avec \`/sam-meeting <url>\` ou @sam + le lien Meet. ` +
        `Si une URL Meet valide est déjà dans le message utilisateur, enchaîne A4 (prompt ≤4096) + launch_meet_interview + A5 confirmation 30s. ` +
        `Sinon : onboarding/status.md → awaiting_meet_url. channel_id="${channel}".`,
      channel
    );
    return;
  }

  if (sub === "meeting" || sub === "launch-meet") {
    const meetUrl = extractMeetUrl(rest);
    if (!meetUrl) {
      await postMeetUsage(
        app,
        channel,
        sub === "meeting" ? "/sam-meeting" : "/sam-launch-meet"
      );
      return;
    }
    const person = stripMeetUrl(rest);
    const ctxLabel =
      sub === "meeting"
        ? person
          ? `L'utilisateur lance /sam-meeting pour ${person} (sans onboarding).`
          : "L'utilisateur lance /sam-meeting (sans onboarding, pas de recherche entreprise)."
        : "L'utilisateur lance /sam-launch-meet.";
    await dispatchToAgent(
      dispatchVocalLaunch(reqCtx, channel, meetUrl, ctxLabel),
      channel
    );
    return;
  }

  if (sub === "status") {
    await dispatchToAgent(
      `${reqCtx}L'utilisateur demande le statut onboarding (/sam status) dans ${channel}. ` +
        `Lis onboarding/status.md et résume : étape, HoS fait ou non, AE calls, hypothèses, prochaine action. channel_id="${channel}".`,
      channel
    );
    return;
  }

  if (sub === "book-hos") {
    await dispatchToAgent(
      `${reqCtx}L'utilisateur demande de préparer un call HoS (/sam book-hos). ` +
        `Email HoS si connu: ${hosEmail || "(demander via Slack)"}. ` +
        `Prépare la prep interview (Étape D) et demande le lien Meet à coller. channel_id="${channel}".`,
      channel
    );
    return;
  }

  if (sub === "book-ae") {
    const meetUrl = extractMeetUrl(rest);
    if (!meetUrl) {
      await postMeetUsage(app, channel, "/sam-book-ae", "@person");
      return;
    }
    const person = stripMeetUrl(rest) || "(AE non précisé)";
    const vocal = dispatchVocalLaunch(
      reqCtx,
      channel,
      meetUrl,
      `Interview AE ${person}. Vérifie HoS fait dans onboarding/status.md — refuse si non. Prep Étape D puis agent vocal.`
    );
    await dispatchToAgent(vocal, channel);
    return;
  }

  if (sub === "prep-interview") {
    const person = rest || "(non précisé)";
    await dispatchToAgent(
      `${reqCtx}L'utilisateur demande la prep interview (/sam prep-interview) pour : ${person}. ` +
        `Exécute l'Étape D : contexte, hypothèses H1-H3, 8-12 questions ouvertes, plan post-call. ` +
        `Rappelle : \`/sam-book-ae @person <meet_url>\` pour lancer l'agent vocal. ` +
        `slack_post_blocks dans ${channel}. channel_id="${channel}".`,
      channel
    );
    return;
  }

  if (sub === "reset") {
    await dispatchToAgent(
      `${reqCtx}L'utilisateur a demandé /sam reset. Confirme qu'une nouvelle session démarre mais que le Memory Store ` +
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
  { command: "/sam-meeting", sub: "meeting" },
  { command: "/sam-intro", sub: "intro" },
  { command: "/sam-status", sub: "status" },
  { command: "/sam-book-hos", sub: "book-hos" },
  { command: "/sam-book-ae", sub: "book-ae" },
  { command: "/sam-prep-interview", sub: "prep-interview" },
  { command: "/sam-launch-meet", sub: "launch-meet" },
  { command: "/sam-reset", sub: "reset" },
];

async function requesterFromCommand(
  app: App,
  cmd: SlashCommand
): Promise<SlackRequester> {
  const userId = cmd.user_id;
  const userName = cmd.user_name ?? userId;
  const userEmail = await resolveUserEmail(app, userId);
  return { userId, userName, userEmail };
}

export function registerSamCommands(ctx: SamContext): void {
  const { app } = ctx;

  for (const { command, sub } of DEDICATED_COMMANDS) {
    app.command(command, async ({ command: cmd, ack }) => {
      await ack();
      const text = (cmd.text ?? "").trim();
      logSlash(command, cmd.channel_id, text, cmd.user_id);
      try {
        const requester = await requesterFromCommand(app, cmd);
        await handleSamSubcommand(ctx, cmd.channel_id, sub, text, requester);
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
    logSlash("/sam", command.channel_id, raw, command.user_id);
    const parts = raw.split(/\s+/);
    const sub = (parts[0] ?? "").toLowerCase();
    const rest = parts.slice(1).join(" ").trim();

    try {
      const requester = await requesterFromCommand(app, command);
      await handleSamSubcommand(ctx, command.channel_id, sub, rest, requester);
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
