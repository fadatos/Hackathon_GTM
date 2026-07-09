#!/usr/bin/env tsx
/**
 * Liste les slash commands enregistrées sur l'app Slack (nécessite SLACK_CONFIG_TOKEN).
 */
import "../env.js";

const configToken = process.env.SLACK_CONFIG_TOKEN;
const appId = process.env.SLACK_APP_ID ?? "A0BFR93DYKH";

if (!configToken) {
  console.error("SLACK_CONFIG_TOKEN requis");
  process.exit(1);
}

const res = await fetch(
  `https://slack.com/api/apps.manifest.export?app_id=${appId}`,
  { headers: { Authorization: `Bearer ${configToken}` } }
);
const data = await res.json();
console.log(JSON.stringify(data, null, 2));
