#!/usr/bin/env tsx
/** Message de contournement si /sam-meeting pas encore sur le workspace Slack. */
import "../env.js";
import { WebClient } from "@slack/web-api";

const token = process.env.SLACK_BOT_TOKEN;
const channel = process.env.SLACK_GTM_CHANNEL_ID;
if (!token || !channel) throw new Error("SLACK_BOT_TOKEN ou SLACK_GTM_CHANNEL_ID manquant");

const slack = new WebClient(token);

await slack.chat.postMessage({
  channel,
  text: "Contournement /sam-meeting",
  blocks: [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "⚠️ *`/sam-meeting` n'est pas encore enregistré sur l'app Slack* (manifest pas poussé).\n\n" +
          "En attendant, dans le thread :\n" +
          "`/sam meeting https://meet.google.com/avf-pmqd-hhc`\n\n" +
          "Important : mets bien `https://` devant le lien Meet.",
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "Pour activer `/sam-meeting` : https://api.slack.com/apps/A0BFR93DYKH/app-manifest → coller `slack-app/manifest.yaml` → Save → *Reinstall to Workspace*",
        },
      ],
    },
  ],
});

console.log("Workaround posté dans #gtm");
