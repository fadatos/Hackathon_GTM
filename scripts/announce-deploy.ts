#!/usr/bin/env tsx
/**
 * Annonce déploiement Sam dans #gtm (message bridge, pas tour agent).
 */
import "../env.js";
import { WebClient } from "@slack/web-api";

async function main(): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_GTM_CHANNEL_ID;
  const agentId = process.env.AGENT_ID ?? "—";
  const memoryId = process.env.MEMORY_STORE_ID ?? "—";
  const company = process.env.COMPANY_NAME ?? "Acme SaaS";
  const domain = process.env.COMPANY_DOMAIN ?? "example.com";

  if (!token || !channel) throw new Error("SLACK_BOT_TOKEN ou SLACK_GTM_CHANNEL_ID manquant");

  const slack = new WebClient(token);
  const repo = "https://github.com/fadatos/Hackathon_GTM";

  await slack.chat.postMessage({
    channel,
    text: "Sam GTM Intern — déployé sur Anthropic + GitHub",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "🚀 Sam GTM Intern — live", emoji: true },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `*Stagiaire GTM IA* pour *${company}* (\`${domain}\`).\n` +
            `Prompt master unique poussé sur *Anthropic Managed Agents* (agent \`${agentId}\`, v2).\n` +
            `Mémoire persistante : \`${memoryId}\`.`,
        },
      },
      { type: "divider" },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "*Phase 1 — Onboarding*\n" +
            "• Découverte entreprise (web + MCP)\n" +
            "• Hypothèses ICP/GTM\n" +
            "• Calls HoS → AE → debrief Gradium\n" +
            "• Synthèse Slack + Memory Store",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "*Commandes*\n" +
            "`/sam intro` · `/sam onboard [domain]` · `/sam status`\n" +
            "`/sam book-hos` · `/sam book-ae @person` · `/sam prep-interview`\n" +
            "`/sam launch-meet <url>` · `/sam reset`",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Code* : <${repo}|fadatos/Hackathon_GTM>`,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "Prochaine étape : `/sam onboard` avec le vrai domaine entreprise.",
          },
        ],
      },
    ],
  });

  console.log("Annonce postée dans #gtm");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
