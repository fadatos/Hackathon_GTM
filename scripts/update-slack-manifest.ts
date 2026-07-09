#!/usr/bin/env tsx
/**
 * Met à jour le manifest Slack de l'app existante (slash commands dédiées).
 *
 * Nécessite SLACK_CONFIG_TOKEN (12h) depuis api.slack.com/apps → Configuration tokens
 * et SLACK_APP_ID (ex. A0BFR93DYKH, visible dans l'URL de l'app).
 *
 * Usage:
 *   SLACK_CONFIG_TOKEN=xoxe-... SLACK_APP_ID=A0BFR93DYKH npm run update:slack-manifest
 */
import "../env.js";
import fs from "node:fs/promises";
import path from "node:path";

const MANIFEST_PATH = path.join(process.cwd(), "slack-app", "manifest.json");

async function main(): Promise<void> {
  const configToken = process.env.SLACK_CONFIG_TOKEN;
  const appId = process.env.SLACK_APP_ID ?? "A0BFR93DYKH";

  if (!configToken) {
    console.error(`
SLACK_CONFIG_TOKEN manquant.

1. https://api.slack.com/apps → "Your App Configuration Tokens" → Generate Token
2. Relance:
   SLACK_CONFIG_TOKEN=xoxe-... npm run update:slack-manifest

Ou colle manuellement slack-app/manifest.yaml dans:
   https://api.slack.com/apps/${appId}/app-manifest
`);
    process.exit(1);
  }

  const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, "utf-8"));

  const res = await fetch("https://slack.com/api/apps.manifest.update", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${configToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ app_id: appId, manifest }),
  });

  const data = (await res.json()) as { ok: boolean; error?: string; warnings?: string[] };

  if (!data.ok) {
    console.error("apps.manifest.update failed:", data.error, data);
    process.exit(1);
  }

  if (data.warnings?.length) {
    console.warn("Warnings:", data.warnings.join(", "));
  }

  console.log(`Manifest mis à jour pour ${appId}`);
  console.log("Nouvelles commandes : /sam-onboard, /sam-intro, /sam-status, ...");
  console.log("Redémarre le bridge si besoin : npm run dev:bridge");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
