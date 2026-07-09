import type { App } from "@slack/bolt";
import {
  dispatchVocalLaunch,
  extractMeetUrl,
  parseOnboardInput,
} from "./meet-url.js";
import {
  handleSamSubcommand,
  requesterFromUserId,
  type SamContext,
} from "./sam-commands.js";

type MessageHandlerDeps = SamContext & {
  defaultChannelId: string;
};

async function handleStructuredThreadReply(
  deps: MessageHandlerDeps,
  opts: {
    channel: string;
    text: string;
    userId: string;
  }
): Promise<boolean> {
  const hasDomainLabel = /domaine:\s*\S+/i.test(opts.text);
  const hasMeetLabel = /meet:\s*\S+/i.test(opts.text);

  if (!hasDomainLabel && !hasMeetLabel) return false;

  const { app, companyDomain } = deps;

  if (hasDomainLabel) {
    const { domain, meetUrl } = parseOnboardInput(opts.text, companyDomain);
    const requester = await requesterFromUserId(app, opts.userId);
    const rest = meetUrl ? `${domain} ${meetUrl}` : domain;
    console.log(
      `[thread] onboard domain=${domain} meet=${meetUrl ?? "none"} user=${opts.userId}`
    );
    await handleSamSubcommand(deps, opts.channel, "onboard", rest, requester);
    return true;
  }

  if (hasMeetLabel) {
    const meetUrl = extractMeetUrl(opts.text);
    if (!meetUrl) return false;

    let userName = opts.userId;
    try {
      const info = await app.client.users.info({ user: opts.userId });
      userName = info.user?.real_name ?? info.user?.name ?? opts.userId;
    } catch {
      /* ignore */
    }

    const reqCtx = `slack_user_id="${opts.userId}" slack_user_name="${userName}" `;
    console.log(`[thread] meet label url=${meetUrl} user=${opts.userId}`);
    await deps.dispatchToAgent(
      dispatchVocalLaunch(
        reqCtx,
        opts.channel,
        meetUrl,
        "L'utilisateur a fourni un lien Meet (format meet: dans le thread)."
      ),
      opts.channel
    );
    return true;
  }

  return false;
}

async function handleMeetLinkMessage(
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

  // Évite double-trigger si le message est un onboard structuré
  if (/domaine:\s*\S+/i.test(opts.text)) return;

  const { dispatchToAgent, app } = deps;

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
 * Détecte dans les threads :
 * - `domaine: xxx` (+ optionnel meet)
 * - `meet: https://...`
 * - lien Meet nu
 */
export function registerMeetLinkMessages(
  app: App,
  deps: MessageHandlerDeps
): void {
  const { defaultChannelId } = deps;
  const fullDeps = deps;

  app.message(async ({ message }) => {
    if (message.subtype) return;
    if (!("text" in message) || !message.text?.trim()) return;
    if ("bot_id" in message && message.bot_id) return;

    const channel = message.channel;
    const inGtm = !defaultChannelId || channel === defaultChannelId;
    const inThread = "thread_ts" in message && Boolean(message.thread_ts);
    if (!inGtm && !inThread) return;

    const userId = "user" in message ? message.user : "unknown";
    const text = message.text;

    if (await handleStructuredThreadReply(fullDeps, { channel, text, userId })) {
      return;
    }

    await handleMeetLinkMessage(fullDeps, {
      channel,
      text,
      userId,
      source: inThread ? "thread-reply" : "channel-message",
    });
  });
}
