#!/usr/bin/env tsx
/**
 * Recrée une session Managed Agent sur la dernière version de l'agent
 * (nécessaire quand de nouveaux custom tools sont ajoutés — la session fige l'agent v1).
 */
import "../env.js";
import fs from "node:fs/promises";
import path from "node:path";
import { anthropicFetch } from "../agent/api-client.js";

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, ".env");
const SESSION_FILE = path.join(ROOT, "bridge", "session.json");

const agentId = process.env.AGENT_ID;
const environmentId = process.env.ENVIRONMENT_ID;
const memoryStoreId = process.env.MEMORY_STORE_ID;
const oldSessionId = process.env.SESSION_ID;

if (!agentId || !environmentId || !memoryStoreId) {
  throw new Error("AGENT_ID, ENVIRONMENT_ID, MEMORY_STORE_ID requis dans .env");
}

const agent = await anthropicFetch<{ version: number }>(`/agents/${agentId}`);
console.log(`Agent ${agentId} v${agent.version}`);

const session = await anthropicFetch<{ id: string }>("/sessions", {
  method: "POST",
  body: {
    agent: agentId,
    environment_id: environmentId,
    title: "Sam hackathon session",
    resources: [
      {
        type: "memory_store",
        memory_store_id: memoryStoreId,
        access: "read_write",
        instructions:
          "Mémoire GTM persistante de Sam. Lis onboarding/status.md au début de chaque tour.",
      },
    ],
  },
});

console.log(`Nouvelle session: ${session.id}`);
if (oldSessionId) console.log(`Ancienne session: ${oldSessionId} (abandonnée)`);

let envContent = await fs.readFile(ENV_PATH, "utf-8");
const line = `SESSION_ID=${session.id}`;
if (/^SESSION_ID=.*$/m.test(envContent)) {
  envContent = envContent.replace(/^SESSION_ID=.*$/m, line);
} else {
  envContent += `\n${line}`;
}
await fs.writeFile(ENV_PATH, envContent.trim() + "\n");

await fs.writeFile(
  SESSION_FILE,
  JSON.stringify(
    {
      sessionId: session.id,
      agentId,
      environmentId,
      memoryStoreId,
      previousSessionId: oldSessionId,
      updatedAt: new Date().toISOString(),
    },
    null,
    2
  )
);

// Vérifier tools sur la nouvelle session
const check = await anthropicFetch<{ agent?: { version?: number; tools?: Array<{ name?: string }> } }>(
  `/sessions/${session.id}`
);
const tools = (check.agent?.tools ?? []).map((t) => t.name).filter(Boolean);
console.log(`Session agent v${check.agent?.version ?? "?"} tools:`, tools.join(", "));
