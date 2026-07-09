#!/usr/bin/env tsx
/**
 * Poste dans #gtm le récap des commandes + flow Meet (après deploy).
 */
import "../env.js";
import { WebClient } from "@slack/web-api";

const token = process.env.SLACK_BOT_TOKEN;
const channel = process.env.SLACK_GTM_CHANNEL_ID;
if (!token || !channel) throw new Error("SLACK_BOT_TOKEN ou SLACK_GTM_CHANNEL_ID manquant");

const slack = new WebClient(token);

await slack.chat.postMessage({
  channel,
  text: "Sam V1 — commandes et lien Meet",
  blocks: [
    {
      type: "header",
      text: { type: "plain_text", text: "Sam est à jour — comment utiliser le Meet vocal", emoji: true },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "*1. Onboarding*\n" +
          "`/sam-onboard acme.com` → digest, puis *réponds dans le thread* avec ton lien Meet\n\n" +
          "*2. Meeting direct (sans onboarding)*\n" +
          "`/sam-meeting https://meet.google.com/xxx-xxxx-xxx`\n\n" +
          "*3. Interview AE*\n" +
          "`/sam-book-ae @personne https://meet.google.com/xxx-xxxx-xxx`\n\n" +
          "Sam génère le prompt et lance l'agent vocal TACL — *rejoins la room, agent dans 30s*.",
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "Prompt Claude v6 · bridge message Meet actif · admin : réinstaller l'app Slack si le lien en reply ne marche pas",
        },
      ],
    },
  ],
});

console.log("Annonce postée dans #gtm");
