/** Extrait une URL Meet/Teams/Zoom d'un texte Slack (avec ou sans https://). */
const MEET_URL_RE =
  /(?:https?:\/\/)?(?:meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}|teams\.microsoft\.com\/\S+|(?:[\w.-]+\.)?zoom\.us\/\S+)/i;

export function normalizeMeetUrl(raw: string): string {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

export function extractMeetUrl(text: string): string | null {
  const match = text.match(MEET_URL_RE);
  if (!match?.[0]) return null;
  return normalizeMeetUrl(match[0]);
}

export function stripMeetUrl(text: string): string {
  return text.replace(MEET_URL_RE, "").replace(/\s+/g, " ").trim();
}

const DOMAIN_RE = /^(?:domaine:\s*)?([a-z0-9][-a-z0-9.]*\.[a-z]{2,})\s*$/i;

export function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .replace(/^domaine:\s*/i, "")
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

export function isValidDomain(domain: string): boolean {
  return /^[a-z0-9][-a-z0-9.]*\.[a-z]{2,}$/i.test(domain);
}

/** Parse domaine + meet optionnel depuis texte libre (modal, thread, slash). */
export function parseOnboardInput(
  rest: string,
  defaultDomain: string
): { domain: string; meetUrl: string | null } {
  const meetUrl = extractMeetUrl(rest);
  let remainder = stripMeetUrl(rest).trim();

  const labelledDomain = remainder.match(/domaine:\s*(\S+)/i);
  if (labelledDomain?.[1]) {
    return { domain: normalizeDomain(labelledDomain[1]), meetUrl };
  }

  const inlineDomain = remainder.match(
    /([a-z0-9][-a-z0-9.]*\.[a-z]{2,})/i
  );
  if (inlineDomain?.[1]) {
    return { domain: normalizeDomain(inlineDomain[1]), meetUrl };
  }

  if (remainder && DOMAIN_RE.test(remainder)) {
    return { domain: normalizeDomain(remainder), meetUrl };
  }

  return { domain: defaultDomain, meetUrl };
}

export function extractDomainFromText(text: string): string | null {
  const labelled = text.match(/domaine:\s*(\S+)/i);
  if (labelled?.[1]) return normalizeDomain(labelled[1]);
  const stripped = stripMeetUrl(text);
  const match = stripped.match(/([a-z0-9][-a-z0-9.]*\.[a-z]{2,})/i);
  return match?.[1] ? normalizeDomain(match[1]) : null;
}

export function meetUsageBlock(command: string, extraArgs = ""): string {
  const usage = extraArgs
    ? `\`${command} ${extraArgs} <meet_url>\``
    : `\`${command} <meet_url>\``;
  return (
    `*Usage — ${command}*\n` +
    "```\n" +
    `${usage}\n` +
    "\n" +
    "DESCRIPTION\n" +
    "  Lance l'agent vocal TACL sur un Google Meet / Teams / Zoom.\n" +
    "  Le lien Meet est obligatoire — Sam ne réserve pas de salle.\n" +
    "\n" +
    "ARGUMENTS\n" +
    (extraArgs ? `  ${extraArgs.trim()}\n  ` : "  ") +
    "<meet_url>    URL publique du meeting (requis)\n" +
    "\n" +
    "EXAMPLES\n" +
    (extraArgs.includes("@person")
      ? `  ${command} @julie https://meet.google.com/abc-defg-hij\n`
      : `  ${command} https://meet.google.com/abc-defg-hij\n`) +
    "  /sam-meeting https://teams.microsoft.com/l/meetup-join/...\n" +
    "```\n" +
    "_Sans URL Meet, la commande ne peut pas être exécutée._"
  );
}

export function dispatchVocalLaunch(
  reqCtx: string,
  channel: string,
  meetUrl: string,
  context: string
): string {
  return (
    `${reqCtx}${context} Lien Meet : ${meetUrl}. ` +
    `Génère le prompt vocal ≤4096 car. (lis hypotheses/icp.md et onboarding/status.md). ` +
    `Appelle launch_meet_interview(meet_url="${meetUrl}", prompt). ` +
    `Confirme dans Slack : rejoins la room, l'agent vocal arrive dans 30 secondes. channel_id="${channel}".`
  );
}
