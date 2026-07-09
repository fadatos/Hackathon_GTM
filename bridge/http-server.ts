import express, { type Express, type Request, type Response } from "express";
import {
  formatMeetDebriefMarkdown,
  upsertMemoryAtPath,
} from "../agent/memory-client.js";
import { runAgentTurn } from "./session-client.js";
import type { WebClient } from "@slack/web-api";
import type { MeetInsightsPayload } from "./custom-tools.js";

export type MeetWebhookDeps = {
  slack: WebClient;
  defaultChannelId: string;
  memoryStoreId?: string;
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function createHttpApp(deps: MeetWebhookDeps): Express {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "sam-gtm-bridge" });
  });

  app.post("/webhooks/meet", async (req: Request, res: Response) => {
    const secret = process.env.MEET_WEBHOOK_SECRET;
    const auth = req.headers.authorization;
    if (secret && auth !== `Bearer ${secret}`) {
      res.status(401).json({ ok: false, error: "unauthorized" });
      return;
    }

    const payload = req.body as MeetInsightsPayload;
    const name = payload.ae_name ?? "interlocuteur";
    const date = new Date().toISOString().slice(0, 10);
    const markdown = formatMeetDebriefMarkdown(payload);

    try {
      if (deps.memoryStoreId) {
        const interviewPath = `/interviews/${date}-${slugify(name)}.md`;
        await upsertMemoryAtPath(deps.memoryStoreId, interviewPath, markdown);
        await upsertMemoryAtPath(deps.memoryStoreId, "/interviews/latest.md", markdown);
      }

      const channel = deps.defaultChannelId;
      if (channel) {
        await deps.slack.chat.postMessage({
          channel,
          text: `Debrief Meet **${name}** reçu. Sam synthétise…`,
        });

        await runAgentTurn(
          `Debrief Meet ${name} disponible. Lis /mnt/memory/sam/interviews/latest.md ` +
            `(ou interviews/latest dans le memory store). Réconcilie les hypothèses ICP/GTM, ` +
            `mets à jour la mémoire, et poste une synthèse Slack avec learnings et next steps. ` +
            `channel_id="${channel}".`,
          {
            slack: deps.slack,
            defaultChannelId: channel,
            onAgentMessage: (t) => console.log("[meet-webhook agent]", t.slice(0, 100)),
            onToolUse: (n) => console.log("[meet-webhook tool]", n),
          }
        );
      }

      res.json({ ok: true, stored: Boolean(deps.memoryStoreId) });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[webhooks/meet]", msg);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  return app;
}
