import { anthropicFetch } from "./api-client.js";

export type MemoryRecord = {
  id: string;
  path: string;
  content?: string;
  content_sha256?: string;
};

export async function createMemoryStore(name: string, description: string): Promise<string> {
  const store = await anthropicFetch<{ id: string }>("/memory_stores", {
    method: "POST",
    body: { name, description },
  });
  return store.id;
}

export async function upsertMemoryAtPath(
  storeId: string,
  memoryPath: string,
  content: string
): Promise<void> {
  try {
    await anthropicFetch(`/memory_stores/${storeId}/memories`, {
      method: "POST",
      body: { path: memoryPath, content },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("memory_path_conflict") && !msg.includes("409")) {
      throw err;
    }
    const listed = await anthropicFetch<{ data: MemoryRecord[] }>(
      `/memory_stores/${storeId}/memories?path_prefix=${encodeURIComponent(memoryPath)}&view=full`
    );
    const existing = listed.data?.find((m) => m.path === memoryPath);
    if (!existing?.id) throw err;
    await anthropicFetch(`/memory_stores/${storeId}/memories/${existing.id}`, {
      method: "PATCH",
      body: { content },
    });
  }
}

export async function seedOnboardingMemory(storeId: string, companySeed: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await upsertMemoryAtPath(
    storeId,
    "/onboarding/status.md",
    `# Statut onboarding\n\n- étape: discover_company\n- phase: 1\n- hos_done: false\n- ae_calls_done: 0\n- dernière_maj: ${today}\n- prochaine_action: Lancer /sam onboard ou recherche domaine\n`
  );
  await upsertMemoryAtPath(
    storeId,
    "/company/seed.md",
    companySeed || "# Seed entreprise\n\n(Aucun seed fourni — compléter via /sam onboard)\n"
  );
  await upsertMemoryAtPath(
    storeId,
    "/hypotheses/icp.md",
    "# Hypothèses ICP\n\n(Aucune — compléter après découverte entreprise)\n"
  );
  await upsertMemoryAtPath(
    storeId,
    "/hypotheses/gtm.md",
    "# Hypothèses GTM\n\n(Aucune — compléter après découverte entreprise)\n"
  );
  await upsertMemoryAtPath(
    storeId,
    "/org/people.md",
    "# Organisation commerciale\n\n- HoS: (à renseigner après call)\n- AE: (liste après call HoS)\n"
  );
  await upsertMemoryAtPath(
    storeId,
    "/interviews/latest.md",
    "# Dernier debrief\n\n(Aucun call terminé)\n"
  );
}

export function formatMeetDebriefMarkdown(payload: {
  ae_name?: string;
  meet_transcript_summary?: string;
  icp_signals?: string[];
  objections?: string[];
  quotes?: string[];
  confidence?: number;
  recording_url?: string;
}): string {
  const name = payload.ae_name ?? "Interlocuteur";
  const lines = [
    `# Debrief Meet — ${name}`,
    "",
    `Date: ${new Date().toISOString()}`,
    "",
    "## Résumé",
    payload.meet_transcript_summary ?? "(pas de résumé)",
    "",
    "## Signaux ICP",
    ...(payload.icp_signals?.map((s) => `- ${s}`) ?? ["- (aucun)"]),
    "",
    "## Objections",
    ...(payload.objections?.map((o) => `- ${o}`) ?? ["- (aucune)"]),
    "",
    "## Citations",
    ...(payload.quotes?.map((q) => `> ${q}`) ?? ["> (aucune)"]),
    "",
    `Confiance extraction: ${payload.confidence ?? "n/a"}`,
  ];
  if (payload.recording_url) {
    lines.push("", `Enregistrement: ${payload.recording_url}`);
  }
  return lines.join("\n");
}
