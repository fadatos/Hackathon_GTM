#!/usr/bin/env tsx
/**
 * Crée la Slack App via apps.manifest.create
 * Nécessite SLACK_CONFIG_TOKEN (token de config app, 12h) depuis api.slack.com/apps
 *
 * Usage:
 *   SLACK_CONFIG_TOKEN=xoxe-... tsx scripts/create-slack-app.ts
 */
import "../env.js";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, "slack-app", "manifest.json");
const ENV_PATH = path.join(ROOT, ".env");

async function upsertEnv(updates: Record<string, string>): Promise<void> {
  let content = "";
  try {
    content = await fs.readFile(ENV_PATH, "utf-8");
  } catch {
    content = "";
  }
  for (const [key, value] of Object.entries(updates)) {
    const re = new RegExp(`^${key}=.*$`, "m");
    const line = `${key}=${value}`;
    if (re.test(content)) content = content.replace(re, line);
    else content += (content.endsWith("\n") || content === "" ? "" : "\n") + line + "\n";
  }
  await fs.writeFile(ENV_PATH, content);
}

async function main(): Promise<void> {
  const configToken = process.env.SLACK_CONFIG_TOKEN;
  if (!configToken) {
    console.error(`
SLACK_CONFIG_TOKEN manquant.

1. Va sur https://api.slack.com/apps
2. Section "Your App Configuration Tokens" → Generate Token
3. Relance: SLACK_CONFIG_TOKEN=xoxe-... npm run create:slack-app
`);
    process.exit(1);
  }

  const manifestText = await fs.readFile(MANIFEST_PATH, "utf-8");
  const manifest = JSON.parse(manifestText) as Record<string, unknown>;

  const res = await fetch("https://slack.com/api/apps.manifest.create", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${configToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ manifest }),
  });

  const data = (await res.json()) as {
    ok: boolean;
    app_id?: string;
    credentials?: {
      client_id?: string;
      client_secret?: string;
      verification_token?: string;
    };
    oauth_authorize_url?: string;
    error?: string;
  };

  if (!data.ok) {
    console.error("apps.manifest.create failed:", data.error, data);
    process.exit(1);
  }

  console.log("App créée:", data.app_id);
  console.log("OAuth URL (installer dans workspace):", data.oauth_authorize_url);

  if (data.credentials?.verification_token) {
    await upsertEnv({ SLACK_SIGNING_SECRET: data.credentials.verification_token });
    console.log("SLACK_SIGNING_SECRET écrit dans .env");
  }

  console.log(`
Prochaines étapes MANUELLES (5 min):
1. Ouvre https://api.slack.com/apps/${data.app_id}
2. Socket Mode → ON → génère App-Level Token (connections:write) → SLACK_APP_TOKEN
3. OAuth & Permissions → Install to Workspace → SLACK_BOT_TOKEN
4. Basic Information → Signing Secret → SLACK_SIGNING_SECRET (si pas auto)
5. Crée #gtm, invite le bot, copie SLACK_GTM_CHANNEL_ID
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
