import type { App } from "@slack/bolt";
import { dispatchVocalLaunch, extractMeetUrl } from "./meet-url.js";
import type { SamContext } from "./sam-commands.js";

type MessageHandlerDeps = Pick<SamContext, "dispatchToAgent"> & {
  defaultChannelId: string;
};

async function handleMeetLinkMessage(
  app: App,
  deps: MessageHandlerDeps,
  opts: {
    channel: string;
    text: string;
    userId: string;
    source: string;
  }
): Promise<void> {
  const meetUrl = extractMeetUrl(opts.text);
  if (!meetUrl) return;

  const { dispatchToAgent, defaultChannelId } = deps;
  const inGtm = !defaultChannelId || opts.channel === defaultChannelId;

  let userName = opts.userId;
  try {
    const info = await app.client.users.info({ user: opts.userId });
    userName = info.user?.real_name ?? info.user?.name ?? opts.userId;
  } catch {
    /* ignore */
  }

  console.log(
    `[${opts.source}] meet link from ${userName} channel=${opts.channel} url=${meetUrl}`
  );

  const reqCtx = `slack_user_id="${opts.userId}" slack_user_name="${userName}" `;
  await dispatchToAgent(
    dispatchVocalLaunch(
      reqCtx,
      opts.channel,
      meetUrl,
      `L'utilisateur a fourni un lien Meet (${opts.source}).`
    ),
    opts.channel
  );
}

/**
 * Détecte un lien Meet dans :
 * - messages channel/thread (#gtm ou thread)
 * - @sam + lien Meet
 */
export function registerMeetLinkMessages(
  app: App,
  deps: MessageHandlerDeps
): void {
  const { defaultChannelId } = deps;

  app.message(async ({ message }) => {
    if (message.subtype) return;
    if (!("text" in message) || !message.text?.trim()) return;
    if ("bot_id" in message && message.bot_id) return;

    const channel = message.channel;
    const inGtm = !defaultChannelId || channel === defaultChannelId;
    const inThread = "thread_ts" in message && Boolean(message.thread_ts);
    if (!inGtm && !inThread) return;

    const userId = "user" in message ? message.user : "unknown";
    await handleMeetLinkMessage(app, deps, {
      channel,
      text: message.text,
      userId,
      source: inThread ? "thread-reply" : "channel-message",
    });
  });

  // @sam + lien Meet : géré par sam-home-menu.ts (menu boutons ou lancement vocal)
}
