# Sam GTM Intern — Hackathon Agentic GTM

> *Your AI intern that sources on intent, not on luck.*

Sam est un stagiaire GTM IA : le **cerveau** tourne sur l’API **Anthropic Managed Agents** (cloud), la **surface** est **Slack** (`/sam`), le **code** vit dans ce repo.

## Architecture (3 couches)

```
┌─────────────────────────────────────────────────────────────┐
│  Repo GitHub (ce repo)                                      │
│  agent/sam-system.md  ·  bridge/  ·  scripts/               │
└──────────────────────────┬──────────────────────────────────┘
                           │ setup:agent (API)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Anthropic Cloud                                            │
│  Agent + Environment + Session (Managed Agents API)         │
└──────────────────────────┬──────────────────────────────────┘
                           │ SSE + custom tools
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Bridge Node (npm run dev:bridge) — Socket Mode Slack       │
│  Exécute slack_post / slack_post_blocks côté workspace      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
                    Slack #gtm  (/sam intro)
```

| Couche | Où | Rôle |
|--------|-----|------|
| **Source** | `agent/sam-system.md` | Prompt master unique (identité + onboarding + Gradium) |
| **Cerveau** | API Anthropic (`AGENT_ID`, `SESSION_ID`) | Raisonnement + sandbox cloud |
| **Bridge** | `bridge/index.ts` (local ou Render) | Écoute `/sam`, boucle custom tools |

Le prompt **n’est pas** saisi dans claude.ai : il est poussé via `npm run setup:agent`.

## Prérequis

- Node.js 20+
- Clé API Anthropic (accès Managed Agents beta)
- Slack App **Sam GTM Intern** (Socket Mode) — voir [docs/SLACK-APP-SETUP.md](docs/SLACK-APP-SETUP.md)

## Setup rapide

```bash
git clone https://github.com/fadatos/Hackathon_GTM.git
cd Hackathon_GTM
npm install
cp .env.example .env
# Remplir ANTHROPIC_API_KEY + tokens Slack dans .env

npm run setup:agent    # une fois — crée Agent + Session
npm run dev:bridge     # garder ouvert pendant la démo
```

Dans Slack `#gtm` :

```
/sam intro
/sam onboard [domain]
/sam status
/sam book-hos
/sam book-ae @personne
/sam prep-interview @personne
/sam launch-meet https://meet.google.com/xxx-xxxx-xxx
/sam reset
```

**Important** : sans `dev:bridge` actif, `/sam` apparaît dans Slack mais ne répond pas (Socket Mode).

### Onboarding V1 — `/sam-onboard`

1. **A1** — Découverte entreprise (web + MCP Notion/HubSpot)
2. **A2** — Digest Slack + **demande de coller un lien Meet**
3. L'utilisateur colle son URL → **`/sam-launch-meet <url>`** ou message avec le lien
4. **A4** — `prompt` ≤4096 car. + `launch_meet_interview` → TACL (`{ meet_url, prompt }`)
5. **A5** — Confirmation Slack (*agent dans 30 secondes*)

Pas de Google Calendar / Gmail — le lien Meet est **toujours fourni par l'humain**.

Voir [`agent/sam-system.md`](agent/sam-system.md).

## Variables d’environnement

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Clé API Anthropic |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-5` (modèles Managed Agents) |
| `AGENT_ID` | Rempli par `setup:agent` |
| `ENVIRONMENT_ID` | Rempli par `setup:agent` |
| `SESSION_ID` | Rempli par `setup:agent` |
| `MEMORY_STORE_ID` | Rempli par `setup:agent` |
| `COMPANY_NAME` / `COMPANY_DOMAIN` | Injectés dans le system prompt |
| `HOS_EMAIL` | Email Head of Sales pour booking |
| `GRADIUM_API_URL` | Webhook TACL voice-interview (`meet_url` + `prompt` uniquement) |
| `GRADIUM_API_KEY` | Optionnel — Bearer token TACL |
| `UPDATE_AGENT=1` | Rafraîchir le system prompt sur agent existant |
| `SLACK_BOT_TOKEN` | `xoxb-...` |
| `SLACK_APP_TOKEN` | `xapp-...` (scope `connections:write`) |
| `SLACK_SIGNING_SECRET` | App credentials |
| `SLACK_GTM_CHANNEL_ID` | ID du canal `#gtm` |

Ne jamais committer `.env`.

## Scripts

| Commande | Usage |
|----------|--------|
| `npm run setup:agent` | Crée / réutilise Agent + Environment + Session |
| `npm run dev:bridge` | Démarre le bridge Slack (Socket Mode) |
| `npm run test:slack-intro` | Test E2E agent → post Slack réel |
| `npm run demo:run` | Boucle agent sans Slack (dry-run tools) |
| `npm run smoke-test` | Custom tools Slack (mock) |

## Modifier le system prompt

1. Éditer [agent/sam-system.md](agent/sam-system.md)
2. Vider `AGENT_ID` dans `.env` et relancer `npm run setup:agent`  
   *(ou implémenter un PATCH agent — à venir)*

## Déploiement bridge (always-on)

Pour que `/sam` fonctionne sans laptop allumé, déployer le bridge sur Render / Railway. Voir [docs/DEPLOY.md](docs/DEPLOY.md).

## Structure

```
agent/           # prompt, client API Anthropic, setup
bridge/          # Bolt Socket Mode, session loop, custom tools Slack
slack-app/       # manifest Slack
scripts/         # tests et démo
docs/            # guides setup / deploy
```

## Hackathon — prochaines phases

- [ ] MCP Sillage (accounts → signaux → priorisation)
- [ ] Webhook Meet Gradium
- [ ] FullEnrich
- [ ] Golden path démo Station F

## Licence

Projet hackathon LEVER Studio / Agentic GTM.
