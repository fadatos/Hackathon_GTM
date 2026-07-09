#!/usr/bin/env tsx
/**
 * Simule le webhook Gradium post-Meet (sans appel API réel).
 */
import "../env.js";
import fs from "node:fs/promises";
import path from "node:path";

const port = process.env.PORT ?? 3000;
const secret = process.env.MEET_WEBHOOK_SECRET ?? "hackathon-secret";

async function main(): Promise<void> {
  const mockPath = path.join(process.cwd(), "demo", "meet-insights-mock.json");
  const payload = JSON.parse(await fs.readFile(mockPath, "utf-8"));

  const res = await fetch(`http://localhost:${port}/webhooks/meet`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  console.log(res.status, text);
  if (!res.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
