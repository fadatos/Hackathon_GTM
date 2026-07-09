import type { App } from "@slack/bolt";
import {
  extractMeetUrl,
  dispatchVocalLaunch,
  isValidDomain,
  normalizeDomain,
  parseOnboardInput,
} from "./meet-url.js";
import {
  handleSamSubcommand,
  requesterFromUserId,
  type SamContext,
} from "./sam-commands.js";

export const SAM_BTN_ONBOARD = "sam_btn_onboard";
export const SAM_BTN_STATUS = "sam_btn_status";
export const SAM_BTN_RESET = "sam_btn_reset";
export const SAM_BTN_MEETING = "sam_btn_meeting";
export const SAM_ONBOARD_MODAL = "sam_onboard_modal";
export const SAM_MEET_MODAL = "sam_meet_modal";
export const SAM_DOMAIN_INPUT = "sam_domain_input";
export const SAM_ONBOARD_MEET_INPUT = "sam_onboard_meet_input";
export const SAM_MEET_URL_INPUT = "sam_meet_url_input";

type ModalMeta = { channel: string; thread_ts?: string; user_id: string };

function parseMeta(raw: string): ModalMeta {
  try {
    return JSON.parse(raw) as ModalMeta;
  } catch {
    return { channel: "", user_id: "" };
  }
}

export function buildSamHomeMenuBlocks(companyName: string): Record<string, unknown>[] {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `Salut — c'est *Sam*, stagiaire GTM chez *${companyName}*.\n` +
          "Choisis une action — chaque bouton ouvre un petit formulaire :",
      },
    },
    {
      type: "actions",
      block_id: "sam_home_actions",
      elements: [
        {
          type: "button",
          action_id: SAM_BTN_ONBOARD,
          text: { type: "plain_text", text: "🚀 Onboarding", emoji: true },
          style: "primary",
          value: "onboard",
        },
        {
          type: "button",
          action_id: SAM_BTN_STATUS,
          text: { type: "plain_text", text: "📊 Statut", emoji: true },
          value: "status",
        },
        {
          type: "button",
          action_id: SAM_BTN_RESET,
          text: { type: "plain_text", text: "🔄 Reset", emoji: true },
          value: "reset",
        },
        {
          type: "button",
          action_id: SAM_BTN_MEETING,
          text: { type: "plain_text", text: "🎤 Google Meet", emoji: true },
          value: "meeting",
        },
      ],
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text:
            "_Fallback sans modale : réponds dans le thread `domaine: ton-site.com` ou `meet: https://meet.google.com/...`_",
        },
      ],
    },
  ];
}

export async function postSamHomeMenu(
  app: App,
  channel: string,
  companyName: string,
  threadTs?: string
): Promise<void> {
  await app.client.chat.postMessage({
    channel,
    thread_ts: threadTs,
    text: "Sam — menu actions",
    blocks: buildSamHomeMenuBlocks(companyName) as never,
  });
}

function channelFromAction(body: Record<string, unknown>): string | undefined {
  const channel = body.channel as { id?: string } | undefined;
  const message = body.message as { channel?: string } | undefined;
  return channel?.id ?? message?.channel;
}

function threadFromAction(body: Record<string, unknown>): string | undefined {
  const msg = body.message as { ts?: string; thread_ts?: string } | undefined;
  if (!msg?.ts) return undefined;
  return msg.thread_ts ?? msg.ts;
}

type SlackModalView = Record<string, unknown>;

async function openModalOrFallback(
  app: App,
  opts: {
    triggerId: string;
    view: SlackModalView;
    channel: string;
    threadTs?: string;
    userId: string;
    fallbackText: string;
  }
): Promise<boolean> {
  try {
    await app.client.views.open({
      trigger_id: opts.triggerId,
      view: opts.view as never,
    });
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[modal] open failed:", msg);
    await app.client.chat.postEphemeral({
      channel: opts.channel,
      user: opts.userId,
      thread_ts: opts.threadTs,
      text: opts.fallbackText,
    });
    return false;
  }
}

function onboardModalView(meta: ModalMeta, defaultDomain: string): SlackModalView {
  return {
    type: "modal",
    callback_id: SAM_ONBOARD_MODAL,
    private_metadata: JSON.stringify(meta),
    title: { type: "plain_text", text: "Onboarding GTM" },
    submit: { type: "plain_text", text: "Lancer" },
    close: { type: "plain_text", text: "Annuler" },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "Indique le *domaine* de l'entreprise à analyser.\n" +
            "Tu peux déjà coller ton lien Meet si tu es prêt pour l'interview vocale.",
        },
      },
      {
        type: "input",
        block_id: "domain_block",
        label: { type: "plain_text", text: "Domaine entreprise" },
        element: {
          type: "plain_text_input",
          action_id: SAM_DOMAIN_INPUT,
          initial_value: defaultDomain,
          placeholder: { type: "plain_text", text: "getsillage.com" },
        },
      },
      {
        type: "input",
        block_id: "onboard_meet_block",
        optional: true,
        label: { type: "plain_text", text: "Lien Google Meet (optionnel)" },
        element: {
          type: "plain_text_input",
          action_id: SAM_ONBOARD_MEET_INPUT,
          placeholder: {
            type: "plain_text",
            text: "https://meet.google.com/abc-defg-hij",
          },
        },
      },
    ],
  };
}

function meetModalView(meta: ModalMeta): SlackModalView {
  return {
    type: "modal",
    callback_id: SAM_MEET_MODAL,
    private_metadata: JSON.stringify(meta),
    title: { type: "plain_text", text: "Lancer Google Meet" },
    submit: { type: "plain_text", text: "Lancer l'agent vocal" },
    close: { type: "plain_text", text: "Annuler" },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "Colle ton lien *Google Meet*, *Teams* ou *Zoom*.\n" +
            "Sam génère le prompt et lance l'agent vocal TACL (~30s).",
        },
      },
      {
        type: "input",
        block_id: "meet_url_block",
        label: { type: "plain_text", text: "URL du meeting" },
        element: {
          type: "plain_text_input",
          action_id: SAM_MEET_URL_INPUT,
          placeholder: {
            type: "plain_text",
            text: "https://meet.google.com/abc-defg-hij",
          },
        },
      },
    ],
  };
}

async function runMenuAction(
  ctx: SamContext,
  sub: string,
  rest: string,
  channel: string,
  userId: string
): Promise<void> {
  const requester = await requesterFromUserId(ctx.app, userId);
  console.log(`[button] ${sub} channel=${channel} user=${userId}`);
  await handleSamSubcommand(ctx, channel, sub, rest, requester);
}

function isBareSamMention(text: string): boolean {
  const stripped = text
    .replace(/<@[A-Z0-9]+>/gi, "")
    .replace(/\s+/g, "")
    .trim();
  return stripped.length === 0;
}

async function handleSamPing(
  ctx: SamContext,
  opts: {
    channel: string;
    userId: string;
    text: string;
    threadTs?: string;
    source: string;
  }
): Promise<void> {
  const { app, companyName, companyDomain } = ctx;
  const { channel, userId, text, threadTs, source } = opts;

  if (/domaine:\s*\S+/i.test(text)) {
    const { domain, meetUrl: onboardMeet } = parseOnboardInput(text, companyDomain);
    const requester = await requesterFromUserId(app, userId);
    const rest = onboardMeet ? `${domain} ${onboardMeet}` : domain;
    await handleSamSubcommand(ctx, channel, "onboard", rest, requester);
    return;
  }

  const meetUrl = extractMeetUrl(text);
  if (meetUrl && !isBareSamMention(text)) {
    const requester = await requesterFromUserId(app, userId);
    const reqCtx = `slack_user_id="${requester.userId}" slack_user_name="${requester.userName}" `;
    await ctx.dispatchToAgent(
      dispatchVocalLaunch(
        reqCtx,
        channel,
        meetUrl,
        `L'utilisateur a contacté Sam avec un lien Meet (${source}).`
      ),
      channel
    );
    return;
  }

  console.log(`[${source}] menu @sam channel=${channel} user=${userId}`);
  await postSamHomeMenu(app, channel, companyName, threadTs);
}

export function registerSamHomeMenu(ctx: SamContext): void {
  const { app, companyName } = ctx;

  ctx.showHomeMenu = (channel, threadTs) =>
    postSamHomeMenu(app, channel, companyName, threadTs);

  app.event("app_mention", async ({ event }) => {
    if (!event.user || !event.channel) return;
    const text = "text" in event ? (event.text ?? "") : "";
    await handleSamPing(ctx, {
      channel: event.channel,
      userId: event.user,
      text,
      threadTs: event.thread_ts ?? event.ts,
      source: "app_mention",
    });
  });

  // DM avec @Sam ou message vide → même menu boutons
  app.event("message", async ({ event }) => {
    if (event.subtype) return;
    if (!("user" in event) || !event.user || !event.channel) return;
    if ("bot_id" in event && event.bot_id) return;
    if (event.channel_type !== "im") return;
    if (!("text" in event)) return;

    const text = event.text ?? "";
    await handleSamPing(ctx, {
      channel: event.channel,
      userId: event.user,
      text,
      source: "message.im",
    });
  });

  app.action(SAM_BTN_ONBOARD, async ({ ack, body }) => {
    await ack();
    const actionBody = body as unknown as Record<string, unknown>;
    const channel = channelFromAction(actionBody);
    const triggerId = actionBody.trigger_id as string | undefined;
    const userId = body.user.id;
    if (!channel || !triggerId) return;

    const meta: ModalMeta = {
      channel,
      thread_ts: threadFromAction(actionBody),
      user_id: userId,
    };

    await openModalOrFallback(app, {
      triggerId,
      view: onboardModalView(meta, companyDomain),
      channel,
      threadTs: meta.thread_ts,
      userId,
      fallbackText:
        "🚀 *Onboarding* — réponds dans ce thread :\n" +
        "`domaine: ton-domaine.com`\n" +
        "Optionnel : `meet: https://meet.google.com/...` sur la ligne suivante",
    });
  });

  app.action(SAM_BTN_STATUS, async ({ ack, body, respond }) => {
    await ack();
    const channel = channelFromAction(body as unknown as Record<string, unknown>);
    const userId = body.user.id;
    if (!channel) return;

    await respond({ replace_original: false, text: "📊 Je regarde le statut…" });
    await runMenuAction(ctx, "status", "", channel, userId);
  });

  app.action(SAM_BTN_RESET, async ({ ack, body, respond }) => {
    await ack();
    const channel = channelFromAction(body as unknown as Record<string, unknown>);
    const userId = body.user.id;
    if (!channel) return;

    await respond({ replace_original: false, text: "🔄 Reset en cours…" });
    await runMenuAction(ctx, "reset", "", channel, userId);
  });

  app.action(SAM_BTN_MEETING, async ({ ack, body }) => {
    await ack();
    const actionBody = body as unknown as Record<string, unknown>;
    const channel = channelFromAction(actionBody);
    const triggerId = actionBody.trigger_id as string | undefined;
    const userId = body.user.id;
    if (!channel || !triggerId) return;

    const meta: ModalMeta = {
      channel,
      thread_ts: threadFromAction(actionBody),
      user_id: userId,
    };

    await openModalOrFallback(app, {
      triggerId,
      view: meetModalView(meta),
      channel,
      threadTs: meta.thread_ts,
      userId,
      fallbackText:
        "🎤 *Google Meet* — réponds dans ce thread :\n" +
        "`meet: https://meet.google.com/abc-defg-hij`",
    });
  });

  app.view(SAM_ONBOARD_MODAL, async ({ ack, body, view, client }) => {
    const rawDomain =
      view.state.values.domain_block?.[SAM_DOMAIN_INPUT]?.value ?? "";
    const rawMeet =
      view.state.values.onboard_meet_block?.[SAM_ONBOARD_MEET_INPUT]?.value ?? "";

    const domain = normalizeDomain(rawDomain);
    const meetUrl = rawMeet.trim() ? extractMeetUrl(rawMeet) : null;

    const errors: Record<string, string> = {};
    if (!domain || !isValidDomain(domain)) {
      errors.domain_block = "Domaine invalide — ex: getsillage.com";
    }
    if (rawMeet.trim() && !meetUrl) {
      errors.onboard_meet_block =
        "URL Meet invalide — ex: https://meet.google.com/abc-defg-hij";
    }
    if (Object.keys(errors).length) {
      await ack({ response_action: "errors", errors });
      return;
    }

    await ack();

    const meta = parseMeta(view.private_metadata || "{}");
    const channel = meta.channel || body.user.id;
    const userId = body.user.id;
    const rest = meetUrl ? `${domain} ${meetUrl}` : domain;

    if (meta.thread_ts) {
      await client.chat.postMessage({
        channel,
        thread_ts: meta.thread_ts,
        text: meetUrl
          ? `🚀 Onboarding *${domain}* + agent vocal sur ${meetUrl}…`
          : `🚀 Onboarding *${domain}* lancé — digest en cours…`,
      });
    }

    console.log(`[modal] onboard channel=${channel} domain=${domain} meet=${meetUrl ?? "none"}`);
    await runMenuAction(ctx, "onboard", rest, channel, userId);
  });

  app.view(SAM_MEET_MODAL, async ({ ack, body, view, client }) => {
    const rawUrl =
      view.state.values.meet_url_block?.[SAM_MEET_URL_INPUT]?.value ?? "";
    const meetUrl = extractMeetUrl(rawUrl);

    if (!meetUrl) {
      await ack({
        response_action: "errors",
        errors: {
          meet_url_block:
            "URL Meet invalide — ex: https://meet.google.com/abc-defg-hij",
        },
      });
      return;
    }

    await ack();

    const meta = parseMeta(view.private_metadata || "{}");
    const channel = meta.channel || body.user.id;
    const userId = body.user.id;
    const requester = await requesterFromUserId(app, userId);
    const reqCtx = `slack_user_id="${requester.userId}" slack_user_name="${requester.userName}" `;

    console.log(`[modal] meeting channel=${channel} user=${userId} url=${meetUrl}`);

    if (meta.thread_ts) {
      await client.chat.postMessage({
        channel,
        thread_ts: meta.thread_ts,
        text: `🎤 Lancement agent vocal sur ${meetUrl}…`,
      });
    }

    await ctx.dispatchToAgent(
      dispatchVocalLaunch(
        reqCtx,
        channel,
        meetUrl,
        "L'utilisateur a lancé un Google Meet via le bouton @Sam."
      ),
      channel
    );
  });
}
