#!/usr/bin/env tsx
/**
 * Simule un debrief post-call AE sans appeler l'API Anthropic.
 * Affiche : payload webhook, mémoire, prompt agent, output Slack attendu.
 */
import "../env.js";
import fs from "node:fs/promises";
import path from "node:path";
import { formatMeetDebriefMarkdown } from "../agent/memory-client.js";

const companyName = process.env.COMPANY_NAME ?? "Acme SaaS";
const channel = process.env.SLACK_GTM_CHANNEL_ID ?? "C0BG8JFAL5P";

const MOCK_PAYLOAD = {
  ae_name: "Julie Martin",
  ae_slack_id: "U0AEJULIE01",
  meet_transcript_summary:
    "Julie confirme que le mid-market SaaS (50-200 employés, Series B+) est le sweet spot avec un cycle moyen de 6 semaines. " +
    "Elle valide fortement le signal hiring SDR comme intent #1. RevOps Manager est un second persona prometteur mais cycle plus long. " +
    "Enterprise à éviter ce trimestre (cycles 9+ mois, procurement lourd). Objection récurrente : déjà Lemlist/Outreach en place — " +
    "il faut vendre l'automatisation intelligente + intégration CRM native.",
  icp_signals: [
    "Mid-market SaaS 50-200 employés — cycle ~6 semaines, win rate 34%",
    "Hiring intent SDR/BDR — 3× plus réceptifs selon Julie",
    "RevOps Manager Series B+ — budget outillage, cycle 8-10 semaines",
    "Enterprise 500+ — à éviter Q3 (procurement, cycle 9+ mois)",
  ],
  objections: [
    "Budget Q3 serré — deals repoussés en septembre",
    "Stack existante (Lemlist, Outreach) — besoin différenciation claire",
    "« On a déjà un SDR, pourquoi automatiser ? » — objection fréquente",
  ],
  quotes: [
    "Nos meilleurs deals viennent du mid-market SaaS, pas de l'enterprise — c'est là qu'on gagne.",
    "Les prospects qui recrutent des SDRs sont 3× plus réceptifs. C'est notre meilleur signal.",
    "RevOps, oui, mais c'est plus long — ils veulent voir 3 références avant de bouger.",
    "Si Sam source demain, je commencerais par les VP Sales SaaS 80-150 employés en France.",
  ],
  confidence: 0.89,
  recording_url: "https://meet.google.com/abc-defg-hij/recording/mock",
};

const HYPOTHESES_AVANT = {
  icp: `# Hypothèses ICP — ${companyName}

## H1 — Mid-market SaaS Series B+
- Croyance : VP Sales / Head of Sales sur comptes 50-200 employés = sweet spot
- Preuves pour : [web] pricing page cible scale-ups | [hubspot] 62% deals gagnés <200 employés
- Preuves contre : [web] case studies incluent 2 logos enterprise
- À valider en interview : cycle réel, win rate, disqualifiers
- Confiance : moyenne

## H2 — Hiring intent SDR/BDR = signal fort
- Croyance : recrutement SDR = fenêtre d'achat 30-60 jours
- Preuves pour : [web] blog "scale your SDR team" | [notion:playbook] mention signal hiring
- Preuves contre : pas encore validé terrain
- À valider en interview : fiabilité vs bruit, sources utilisées par les AE
- Confiance : faible

## H3 — Enterprise à éviter ce trimestre
- Croyance : cycles trop longs, pas priorité Q3
- Preuves pour : [hubspot] 0 deal enterprise closé Q2
- Preuves contre : 1 deal enterprise en pipe (stale 90j)
- À valider en interview : décision stratégique ou temporaire ?
- Confiance : faible`,
  gtm: `# Hypothèses GTM — ${companyName}

## G1 — Motion sales-led, outbound assisté
- Croyance : AE + SDR classique, notre outil augmente la vélocité outbound
- Confiance : moyenne

## G2 — Pricing mid-market (5-15k ARR) = friction faible
- Croyance : deals closent sans procurement lourd sous 15k
- Confiance : moyenne`,
};

const HYPOTHESES_APRES = {
  icp: `# Hypothèses ICP — ${companyName}

## H1 — Mid-market SaaS Series B+ ✅ VALIDÉE
- Croyance : VP Sales / Head of Sales, 50-200 employés (idéal 80-150 FR)
- Preuves pour : [web] | [hubspot] | [call:Julie Martin] win rate 34%, cycle 6 sem
- Preuves contre : —
- Confiance : **forte**

## H2 — Hiring intent SDR/BDR ✅ VALIDÉE
- Croyance : recrutement SDR = intent #1, 3× réceptivité
- Preuves pour : [call:Julie Martin] « notre meilleur signal »
- Confiance : **forte**

## H3 — Enterprise à éviter Q3 ✅ VALIDÉE
- Croyance : pas d'effort enterprise ce trimestre (procurement, 9+ mois)
- Preuves pour : [call:Julie Martin] « pas de l'enterprise — c'est là qu'on gagne ailleurs »
- Confiance : **forte**

## H4 — RevOps Manager Series B+ 🆕 À REVISITER
- Croyance : persona prometteur mais cycle 8-10 sem, besoin 3 références
- Preuves pour : [call:Julie Martin]
- Confiance : moyenne`,
  gtm: `# Hypothèses GTM — ${companyName}

## G1 — Motion sales-led ✅ CONFIRMÉE
- [call:Julie Martin] stack SDR + outbound, notre valeur = vélocité + intégration CRM

## G2 — Pricing mid-market ✅ CONFIRMÉE
- Deals <15k ARR sans procurement — validé terrain

## G3 — Objection #1 : stack existante 🆕
- Lemlist/Outreach déjà en place — angle différenciation = automatisation intelligente + CRM native`,
};

function agentPrompt(aeName: string): string {
  return (
    `Debrief Meet ${aeName} disponible. Lis interviews/latest.md dans le memory store. ` +
    `Réconcilie les hypothèses ICP/GTM, mets à jour la mémoire, et poste une synthèse Slack ` +
    `avec learnings et next steps. channel_id="${channel}".`
  );
}

function slackOutput(aeName: string): string {
  return `*🎙️ Debrief call AE — ${aeName}*

*Learnings clés*
• *Mid-market SaaS 80-150 employés (FR)* = sweet spot confirmé — cycle ~6 sem, win rate 34% [call:Julie Martin]
• *Hiring intent SDR/BDR* = signal #1 — prospects 3× plus réceptifs quand ils recrutent [call:Julie Martin]
• *Enterprise à éviter Q3* — cycles 9+ mois, pas d'effort ce trimestre [call:Julie Martin]
• *RevOps Manager* = persona secondaire prometteur mais cycle plus long (8-10 sem, besoin références)
• *Objection terrain* : stack Lemlist/Outreach déjà en place → vendre différenciation (automatisation intelligente + CRM native)

*Hypothèses mises à jour*
• H1 Mid-market SaaS → ✅ *validée* (confiance forte)
• H2 Hiring intent SDR → ✅ *validée* (confiance forte)
• H3 Enterprise Q3 → ✅ *validée* — éviter
• H4 RevOps Manager → 🆕 *à revisiter* (confiance moyenne)

*Prochaines étapes*
1. Mettre à jour \`onboarding/status.md\` → \`ae_julie_done\`, 1/1 AE call terminé
2. Enrichir \`org/people.md\` avec le profil Julie (mid-market FR, spécialité SaaS)
3. Préparer brief sourcing Phase 2 : VP Sales SaaS 80-150 employés + signal hiring SDR
4. *À valider avec HoS* : prioriser France uniquement ou DACH aussi ?

---
_Sam — stagiaire GTM · ${companyName}_`;
}

async function main(): Promise<void> {
  const debriefMd = formatMeetDebriefMarkdown(MOCK_PAYLOAD);
  const aeName = MOCK_PAYLOAD.ae_name ?? "AE";

  const sections = [
    "═".repeat(72),
    "SIMULATION DEBRIEF AE — MOCK DATA",
    "═".repeat(72),
    "",
    "── 1. WEBHOOK PAYLOAD (POST /webhooks/meet) ──",
    JSON.stringify(MOCK_PAYLOAD, null, 2),
    "",
    "── 2. MEMORY: interviews/latest.md ──",
    debriefMd,
    "",
    "── 3. MEMORY AVANT: hypotheses/icp.md ──",
    HYPOTHESES_AVANT.icp,
    "",
    "── 4. MEMORY APRÈS: hypotheses/icp.md (réconcilié) ──",
    HYPOTHESES_APRES.icp,
    "",
    "── 5. MEMORY APRÈS: hypotheses/gtm.md ──",
    HYPOTHESES_APRES.gtm,
    "",
    "── 6. MEMORY APRÈS: onboarding/status.md ──",
    `# Statut onboarding

- étape: ae_debrief_done
- phase: 1
- hos_done: true
- ae_calls_done: 1 (Julie Martin)
- dernière_maj: ${new Date().toISOString().slice(0, 10)}
- prochaine_action: Valider synthèse avec HoS → phase1_complete si critères OK`,
    "",
    "── 7. PROMPT ENVOYÉ À L'AGENT (runAgentTurn) ──",
    agentPrompt(aeName),
    "",
    "── 8. OUTPUT SLACK ATTENDU (slack_post / slack_post_blocks) ──",
    slackOutput(aeName),
    "",
    "═".repeat(72),
  ];

  const output = sections.join("\n");
  console.log(output);

  const outPath = path.join(process.cwd(), "demo", "ae-debrief-simulation-output.md");
  await fs.writeFile(outPath, output);
  console.log(`\n→ Sauvegardé : ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
