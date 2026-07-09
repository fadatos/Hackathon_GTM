import type { App } from "@slack/bolt";
import { extractMeetUrl, dispatchVocalLaunch } from "./meet-url.js";
import {
  handleSamSubcommand,
  requesterFromUserId,
  type SamContext,
} from "./sam-commands.js";

export const SAM_BTN_ONBOARD = "sam_btn_onboard";
export const SAM_BTN_STATUS = "sam_btn_status";
export const SAM_BTN_RESET = "sam_btn_reset";
export const SAM_BTN_MEETING = "sam_btn_meeting";
export const SAM_MEET_MODAL = "sam_meet_modal";
export const SAM_MEET_URL_INPUT = "sam_meet_url_input";

export function buildSamHomeMenuBlocks(companyName: string): Record<string, unknown>[] {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `Salut — c'est *Sam*, stagiaire GTM chez *${companyName}*.\n` +
          "Choisis une action ci-dessous (pas besoin de slash command) :",
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
          text: "_Tu peux aussi coller un lien Meet directement dans ce thread._",
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

export function registerSamHomeMenu(ctx: SamContext): void {
  const { app, companyName } = ctx;

  app.event("app_mention", async ({ event }) => {
    if (!event.user || !event.channel) return;
    const text = "text" in event ? (event.text ?? "") : "";
    const meetUrl = extractMeetUrl(text);

    if (meetUrl) {
      const requester = await requesterFromUserId(app, event.user);
      const reqCtx = `slack_user_id="${requester.userId}" slack_user_name="${requester.userName}" `;
      await ctx.dispatchToAgent(
        dispatchVocalLaunch(
          reqCtx,
          event.channel,
          meetUrl,
          "L'utilisateur a @mentionné Sam avec un lien Meet."
        ),
        event.channel
      );
      return;
    }

    const threadTs = event.thread_ts ?? event.ts;
    await postSamHomeMenu(app, event.channel, companyName, threadTs);
  });

  app.action(SAM_BTN_ONBOARD, async ({ ack, body, respond }) => {
    await ack();
    const channel = channelFromAction(body as unknown as Record<string, unknown>);
    const userId = body.user.id;
    if (!channel) return;

    await respond({
      replace_original: false,
      text: "🚀 Onboarding lancé…",
    });

    await runMenuAction(ctx, "onboard", "", channel, userId);
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

  app.action(SAM_BTN_MEETING, async ({ ack, body, client }) => {
    await ack();
    const actionBody = body as unknown as Record<string, unknown>;
    const channel = channelFromAction(actionBody);
    const triggerId = actionBody.trigger_id as string | undefined;
    if (!channel || !triggerId) return;

    const threadTs = threadFromAction(actionBody);

    await client.views.open({
      trigger_id: triggerId,
      view: {
        type: "modal",
        callback_id: SAM_MEET_MODAL,
        private_metadata: JSON.stringify({ channel, thread_ts: threadTs }),
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
      },
    });
  });

  app.view(SAM_MEET_MODAL, async ({ ack, body, view, client }) => {
    const rawUrl =
      view.state.values.meet_url_block?.[SAM_MEET_URL_INPUT]?.value ?? "";
    const meetUrl = extractMeetUrl(rawUrl);

    if (!meetUrl) {
      await ack({
        response_action: "errors",
        errors: {
          meet_url_block: "URL Meet invalide — ex: https://meet.google.com/abc-defg-hij",
        },
      });
      return;
    }

    await ack();

    let meta: { channel?: string; thread_ts?: string } = {};
    try {
      meta = JSON.parse(view.private_metadata || "{}");
    } catch {
      /* ignore */
    }

    const channel = meta.channel ?? body.user.id;
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
