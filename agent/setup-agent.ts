#!/usr/bin/env tsx
/**
 * Crée Agent + Environment + Session Managed Agents et écrit les IDs dans .env
 */
import "../env.js";
import fs from "node:fs/promises";
import path from "node:path";
import { anthropicFetch } from "./api-client.js";

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, ".env");
const SYSTEM_PATH = path.join(ROOT, "agent", "sam-system.md");

const SLACK_CUSTOM_TOOLS = [
  {
    type: "agent_toolset_20260401",
  },
  {
    type: "custom",
    name: "slack_post",
    description:
      "Poste un message texte dans le channel Slack GTM. Utilise TOUJOURS cet outil pour répondre à l'utilisateur Slack — ne réponds jamais uniquement dans le sandbox sans poster sur Slack.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Message markdown Slack" },
        channel_id: {
          type: "string",
          description: "ID du channel Slack (fourni dans le message utilisateur)",
        },
      },
      required: ["text"],
    },
  },
  {
    type: "custom",
    name: "slack_post_blocks",
    description:
      "Poste un message Slack riche avec blocks Block Kit (sections, boutons). Utilise pour ICP, leads, validations. Le champ blocks est un tableau JSON Block Kit.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Texte fallback pour notifications" },
        channel_id: { type: "string", description: "ID channel Slack" },
        blocks: {
          type: "array",
          description: "Tableau de blocks Slack Block Kit",
          items: { type: "object" },
        },
      },
      required: ["text", "blocks"],
    },
  },
];

async function readSystemPrompt(): Promise<string> {
  try {
    return await fs.readFile(SYSTEM_PATH, "utf-8");
  } catch {
    return "Tu es Sam, stagiaire GTM. Réponds via slack_post ou slack_post_blocks.";
  }
}

async function upsertEnv(updates: Record<string, string>): Promise<void> {
  let content = "";
  try {
    content = await fs.readFile(ENV_PATH, "utf-8");
  } catch {
    content = await fs.readFile(path.join(ROOT, ".env.example"), "utf-8");
  }

  for (const [key, value] of Object.entries(updates)) {
    const re = new RegExp(`^${key}=.*$`, "m");
    const line = `${key}=${value}`;
    if (re.test(content)) {
      content = content.replace(re, line);
    } else {
      content += `\n${line}`;
    }
  }

  await fs.writeFile(ENV_PATH, content.trim() + "\n");
}

async function main(): Promise<void> {
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";
  const system = await readSystemPrompt();

  let agentId = process.env.AGENT_ID;
  let environmentId = process.env.ENVIRONMENT_ID;
  let sessionId = process.env.SESSION_ID;

  if (!agentId) {
    console.log("Création de l'agent Sam...");
    const agent = await anthropicFetch<{ id: string; version: number }>("/agents", {
      method: "POST",
      body: {
        name: "Sam GTM Intern",
        model,
        system,
        tools: SLACK_CUSTOM_TOOLS,
      },
    });
    agentId = agent.id;
    console.log(`  Agent ID: ${agentId} (v${agent.version})`);
  } else {
    console.log(`Agent existant: ${agentId}`);
  }

  if (!environmentId) {
    console.log("Création de l'environment cloud...");
    const env = await anthropicFetch<{ id: string }>("/environments", {
      method: "POST",
      body: {
        name: "sam-hackathon",
        config: { type: "cloud", networking: { type: "unrestricted" } },
      },
    });
    environmentId = env.id;
    console.log(`  Environment ID: ${environmentId}`);
  } else {
    console.log(`Environment existant: ${environmentId}`);
  }

  if (!sessionId) {
    console.log("Création de la session...");
    const session = await anthropicFetch<{ id: string }>("/sessions", {
      method: "POST",
      body: {
        agent: agentId,
        environment_id: environmentId,
        title: "Sam hackathon session",
      },
    });
    sessionId = session.id;
    console.log(`  Session ID: ${sessionId}`);
  } else {
    console.log(`Session existante: ${sessionId}`);
  }

  await upsertEnv({
    AGENT_ID: agentId,
    ENVIRONMENT_ID: environmentId,
    SESSION_ID: sessionId,
    ANTHROPIC_MODEL: model,
  });

  const sessionFile = path.join(ROOT, "bridge", "session.json");
  await fs.mkdir(path.dirname(sessionFile), { recursive: true });
  await fs.writeFile(
    sessionFile,
    JSON.stringify({ sessionId, agentId, environmentId, updatedAt: new Date().toISOString() }, null, 2)
  );

  console.log("\nSetup terminé. IDs sauvegardés dans .env et bridge/session.json");
}

main().catch((err) => {
  console.error("setup-agent failed:", err.message);
  process.exit(1);
});
