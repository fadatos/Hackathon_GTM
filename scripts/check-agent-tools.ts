#!/usr/bin/env tsx
import "../env.js";
import { anthropicFetch } from "../agent/api-client.js";

const agentId = process.env.AGENT_ID!;
const sessionId = process.env.SESSION_ID!;

const agent = await anthropicFetch<{ version: number; tools?: Array<{ name?: string; type?: string }> }>(
  `/agents/${agentId}`
);
const tools = (agent.tools ?? []).map((t) => t.name ?? t.type);
console.log(`Agent v${agent.version}:`, tools.join(", "));

const sess = await anthropicFetch<{ agent?: string | { id: string; version?: number } }>(
  `/sessions/${sessionId}`
);
console.log("Session agent ref:", JSON.stringify(sess.agent));
