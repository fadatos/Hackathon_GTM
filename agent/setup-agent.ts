#!/usr/bin/env tsx
/**
 * Crée Agent + Environment + Memory Store + Session Managed Agents
 */
import "../env.js";
import fs from "node:fs/promises";
import path from "node:path";
import { anthropicFetch } from "./api-client.js";
import {
  createMemoryStore,
  seedOnboardingMemory,
  upsertMemoryAtPath,
} from "./memory-client.js";

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, ".env");
const AGENT_DIR = path.join(ROOT, "agent");

const LAUNCH_MEET_TOOL = {
  type: "custom",
  name: "launch_meet_interview",
  description:
    "Lance l'agent vocal TACL dans un Google Meet / Teams / Zoom. " +
    "Envoie uniquement meet_url + prompt (≤4096 car.) au webhook. " +
    "Le meet_url doit être fourni par l'utilisateur dans Slack — ne jamais inventer.",
  input_schema: {
    type: "object",
    properties: {
      meet_url: {
        type: "string",
        description: "URL publique du meeting (collée par l'utilisateur dans Slack)",
      },
      prompt: {
        type: "string",
        description: "Prompt vocal pour l'agent, max 4096 caractères",
      },
    },
    required: ["meet_url", "prompt"],
  },
};

const SLACK_CUSTOM_TOOLS = [
  { type: "agent_toolset_20260401" },
  {
    type: "custom",
    name: "slack_post",
    description:
      "Poste un message texte dans le channel Slack GTM. Utilise TOUJOURS cet outil pour répondre à l'utilisateur Slack.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Message markdown Slack" },
        channel_id: { type: "string", description: "ID du channel Slack" },
      },
      required: ["text"],
    },
  },
  {
    type: "custom",
    name: "slack_post_blocks",
    description:
      "Poste un message Slack riche avec blocks Block Kit (sections, boutons).",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Texte fallback" },
        channel_id: { type: "string", description: "ID channel Slack" },
        blocks: { type: "array", items: { type: "object" } },
      },
      required: ["text", "blocks"],
    },
  },
  LAUNCH_MEET_TOOL,
];

function buildMcpServers(): Array<{ type: "url"; name: string; url: string }> {
  const servers: Array<{ type: "url"; name: string; url: string }> = [];
  const entries: Array<[string, string | undefined]> = [
    ["notion", process.env.NOTION_MCP_URL],
    ["hubspot", process.env.HUBSPOT_MCP_URL],
    ["slack_internal", process.env.SLACK_MCP_URL],
  ];
  for (const [name, url] of entries) {
    if (url?.trim()) servers.push({ type: "url", name, url: url.trim() });
  }
  return servers;
}

async function readSystemPrompt(): Promise<string> {
  const companyName = process.env.COMPANY_NAME ?? "Acme SaaS";
  const companyDomain = process.env.COMPANY_DOMAIN ?? "example.com";

  const raw = await fs.readFile(path.join(AGENT_DIR, "sam-system.md"), "utf-8");
  return raw
    .replaceAll("{COMPANY_NAME}", companyName)
    .replaceAll("{COMPANY_DOMAIN}", companyDomain);
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
    if (re.test(content)) content = content.replace(re, line);
    else content += `\n${line}`;
  }

  await fs.writeFile(ENV_PATH, content.trim() + "\n");
}

async function ensureMemoryStore(): Promise<string> {
  let storeId = process.env.MEMORY_STORE_ID;
  if (storeId) {
    console.log(`Memory Store existant: ${storeId}`);
    return storeId;
  }

  console.log("Création du Memory Store Sam...");
  storeId = await createMemoryStore(
    "sam-gtm-memory",
    "Mémoire persistante Sam : onboarding, hypothèses ICP/GTM, debriefs Meet, org commerciale."
  );
  console.log(`  Memory Store ID: ${storeId}`);

  let companySeed = "";
  try {
    companySeed = await fs.readFile(path.join(ROOT, "memory", "company.md"), "utf-8");
  } catch {
    /* optional */
  }

  await seedOnboardingMemory(storeId, companySeed);

  try {
    const gradiumTemplate = await fs.readFile(
      path.join(AGENT_DIR, "templates", "gradium-brief.md"),
      "utf-8"
    );
    await upsertMemoryAtPath(storeId, "/templates/gradium-brief.md", gradiumTemplate);
  } catch {
    console.warn("  Template Gradium non seedé");
  }

  await upsertEnv({ MEMORY_STORE_ID: storeId });
  return storeId;
}

function sessionResources(memoryStoreId: string) {
  return [
    {
      type: "memory_store",
      memory_store_id: memoryStoreId,
      access: "read_write",
      instructions:
        "Mémoire GTM persistante de Sam. Lis onboarding/status.md au début de chaque tour. " +
        "Mets à jour hypotheses/, interviews/, org/ après chaque insight.",
    },
  ];
}

async function main(): Promise<void> {
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";
  const system = await readSystemPrompt();
  const mcpServers = buildMcpServers();
  const memoryStoreId = await ensureMemoryStore();

  let agentId = process.env.AGENT_ID;
  let environmentId = process.env.ENVIRONMENT_ID;
  let sessionId = process.env.SESSION_ID;

  const agentBody: Record<string, unknown> = {
    name: "Sam GTM Intern",
    model,
    system,
    tools: SLACK_CUSTOM_TOOLS,
  };
  if (mcpServers.length) agentBody.mcp_servers = mcpServers;

  if (!agentId) {
    console.log("Création de l'agent Sam...");
    const agent = await anthropicFetch<{ id: string; version: number }>("/agents", {
      method: "POST",
      body: agentBody,
    });
    agentId = agent.id;
    console.log(`  Agent ID: ${agentId} (v${agent.version})`);
  } else if (process.env.UPDATE_AGENT === "1") {
    console.log(`Mise à jour agent ${agentId}...`);
    const current = await anthropicFetch<{ version: number }>(`/agents/${agentId}`);
    const updated = await anthropicFetch<{ id: string; version: number }>(`/agents/${agentId}`, {
      method: "POST",
      body: { ...agentBody, version: current.version },
    });
    console.log(`  Agent mis à jour (v${updated.version}, system + tools)`);
  } else {
    console.log(`Agent existant: ${agentId} (UPDATE_AGENT=1 pour rafraîchir le prompt)`);
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
        resources: sessionResources(memoryStoreId),
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
    MEMORY_STORE_ID: memoryStoreId,
    ANTHROPIC_MODEL: model,
  });

  const sessionFile = path.join(ROOT, "bridge", "session.json");
  await fs.mkdir(path.dirname(sessionFile), { recursive: true });
  await fs.writeFile(
    sessionFile,
    JSON.stringify(
      { sessionId, agentId, environmentId, memoryStoreId, updatedAt: new Date().toISOString() },
      null,
      2
    )
  );

  console.log("\nSetup terminé. IDs sauvegardés dans .env et bridge/session.json");
  if (!mcpServers.length) {
    console.log("  (Aucun MCP configuré — ajouter NOTION_MCP_URL, HUBSPOT_MCP_URL, etc.)");
  }
}

main().catch((err) => {
  console.error("setup-agent failed:", err.message);
  process.exit(1);
});
