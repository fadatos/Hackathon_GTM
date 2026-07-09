#!/usr/bin/env tsx
/**
 * Envoie un payload voice-interview vers TACL (n8n webhook prod).
 * Contrat strict : { meet_url, prompt } uniquement.
 *
 * Usage:
 *   npm run send:voice-interview          # lancement Meet
 *   npm run send:voice-interview debrief  # mock debrief (hors contrat TACL launch)
 */
import "../env.js";
import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_URL = "https://api-prod.tacl-group.com/webhook/voice-interview";

function launchPayload(): { meet_url: string; prompt: string } {
  const company = process.env.COMPANY_NAME ?? "Acme SaaS";
  const meetUrl = process.env.MEET_LINK_AE1 ?? "https://meet.google.com/xxx-xxxx-xxx";
  return {
    meet_url: meetUrl,
    prompt: `ROLE: Assistant interview Sam (stagiaire GTM). Aide le demandeur a reflechir sur le GTM.

CONTEXTE ${company}:
- Plateforme automatisation outbound B2B pour scale-ups
- Cible declaree: VP Sales SaaS 50-200 employes
- Concurrents: Lemlist, Outreach, Apollo

HYPOTHESES:
- H1: Mid-market SaaS Series B+ = sweet spot (cycle court)
- H2: Signal hiring SDR = intent fort
- H3: Enterprise a eviter ce trimestre (cycle long)

QUESTIONS:
1. Quels segments closent le plus vite pour vous?
2. Qu'est-ce qui disqualifie un compte en 30 secondes?
3. Hiring intent: signal fiable ou bruit?
4. Objection #1 sur le terrain ce mois-ci?
5. Si Sam source demain, quel profil en premier?

APRES: valider H1-H3, citations verbatim, objections, next steps Sam.

TON: curieux, respectueux.`,
  };
}

async function debriefPayload(): Promise<unknown> {
  const mockPath = path.join(process.cwd(), "demo", "meet-insights-mock.json");
  const raw = JSON.parse(await fs.readFile(mockPath, "utf-8"));
  return { type: "debrief", ...raw };
}

async function main(): Promise<void> {
  const mode = process.argv[2] ?? "launch";
  const url = process.env.GRADIUM_API_URL ?? DEFAULT_URL;
  const apiKey = process.env.GRADIUM_API_KEY;

  const payload = mode === "debrief" ? await debriefPayload() : launchPayload();

  console.log(`POST ${url}`);
  console.log("Payload:", JSON.stringify(payload, null, 2));

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  console.log(`\nHTTP ${res.status}`);
  console.log(text);

  if (!res.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
