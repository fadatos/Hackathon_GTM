/** Extrait une URL Meet/Teams/Zoom d'un texte Slack. */
const MEET_URL_RE =
  /https?:\/\/(?:meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}|teams\.microsoft\.com\/\S+|(?:[\w.-]+\.)?zoom\.us\/\S+)/i;

export function extractMeetUrl(text: string): string | null {
  const match = text.match(MEET_URL_RE);
  return match?.[0] ?? null;
}

export function stripMeetUrl(text: string): string {
  return text.replace(MEET_URL_RE, "").replace(/\s+/g, " ").trim();
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
