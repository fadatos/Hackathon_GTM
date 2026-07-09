# Configuration Slack App — Sam GTM

> **Statut (9 juil. 2026)** : app créée sur workspace **LEVER Studio**
> - App ID : `A0BFR93DYKH`
> - Bot : `@Sam` (`U0BFR9R6NQ7`)
> - Tokens renseignés dans `.env` (bot, app-level, signing secret)
> - **Reste** : créer `#gtm`, inviter `@Sam`, copier l'ID canal dans `SLACK_GTM_CHANNEL_ID`

## 1. Créer l'app

1. Aller sur https://api.slack.com/apps → **Create New App** → From scratch
2. Nom : `Sam GTM Intern`
3. Workspace : votre workspace hackathon

## 2. Socket Mode

1. **Settings → Socket Mode** → Enable Socket Mode
2. Générer un **App-Level Token** avec scope `connections:write`
3. Copier dans `.env` : `SLACK_APP_TOKEN=xapp-...`

## 3. Bot Token Scopes

**OAuth & Permissions → Scopes → Bot Token Scopes** :

- `chat:write`
- `commands`
- `files:write`
- `app_mentions:read`

Puis **Install to Workspace** → copier `SLACK_BOT_TOKEN=xoxb-...`

## 4. Signing Secret

**Basic Information → App Credentials** → `SLACK_SIGNING_SECRET`

## 5. Slash Command

**Features → Slash Commands → Create New Command** :

| Champ | Valeur |
|-------|--------|
| Command | `/sam` |
| Request URL | (vide en Socket Mode) |
| Short description | Parler à Sam, stagiaire GTM |
| Usage hint | `intro` \| `status` \| `reset` |

## 6. Interactivity

**Features → Interactivity** → ON (requis pour les boutons Block Kit)

## 7. Channel demo

1. Créer `#gtm` dans Slack
2. Inviter le bot : `/invite @Sam GTM Intern`
3. Copier l'ID du channel (clic droit → View channel details → ID en bas)
4. `.env` : `SLACK_GTM_CHANNEL_ID=C...`

## 8. Lancer

```bash
cp .env.example .env
# Remplir ANTHROPIC_API_KEY + tokens Slack

npm run setup:agent   # une fois
npm run dev:bridge    # démarrer le bridge

# Dans Slack #gtm
/sam intro
```

## Variables .env requises pour le bridge

```
ANTHROPIC_API_KEY=
SESSION_ID=          # rempli par setup:agent
SLACK_BOT_TOKEN=
SLACK_APP_TOKEN=
SLACK_SIGNING_SECRET=
SLACK_GTM_CHANNEL_ID=
```
