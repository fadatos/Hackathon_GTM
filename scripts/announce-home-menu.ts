#!/usr/bin/env tsx
/** Annonce menu boutons @sam dans #gtm */
import "../env.js";
import { WebClient } from "@slack/web-api";
import { buildSamHomeMenuBlocks } from "../bridge/sam-home-menu.js";

const slack = new WebClient(process.env.SLACK_BOT_TOKEN!);
const channel = process.env.SLACK_GTM_CHANNEL_ID!;
const company = process.env.COMPANY_NAME ?? "Sillage";

await slack.chat.postMessage({
  channel,
  text: "Sam — menu @sam avec boutons",
  blocks: [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "✨ *Nouveau : @sam affiche un menu boutons*\n\n" +
          "Tape `@Sam` dans un channel ou thread — plus besoin de slash commands pour les actions courantes.\n\n" +
          "⚠️ Si le bouton *Google Meet* ne s'ouvre pas : mets à jour le manifest Slack (`views:write`) puis *Reinstall to Workspace*.",
      },
    },
    ...buildSamHomeMenuBlocks(company),
  ],
});

console.log("Annonce menu postée");
