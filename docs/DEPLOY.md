# Déployer le bridge Sam (always-on)

Le bridge **doit tourner en permanence** pour que `/sam` réponde (Socket Mode). Options recommandées : **Render** ou **Railway**.

## Render (recommandé)

1. Créer un **Web Service** depuis ce repo
2. Build : `npm install`
3. Start : `npm run dev:bridge`
4. Ajouter les variables d’environnement (copier depuis `.env`, **sans** committer) :

```
ANTHROPIC_API_KEY
ANTHROPIC_MODEL=claude-sonnet-4-5
AGENT_ID
ENVIRONMENT_ID
SESSION_ID
SLACK_BOT_TOKEN
SLACK_APP_TOKEN
SLACK_SIGNING_SECRET
SLACK_GTM_CHANNEL_ID
PORT=3000
```

5. Plan **Starter** suffit (process long-running, pas de trafic HTTP entrant requis)

Un `render.yaml` est fourni à la racine pour déploiement infra-as-code.

## Railway

1. `railway init` depuis le repo
2. Mêmes variables d’environnement
3. Start command : `npm run dev:bridge`

## Vérification

Logs attendus au démarrage :

```
Session: sesn_...
Slack bot: @sam (LEVER Studio)
Sam bridge actif — Socket Mode (port 3000)
```

Puis dans Slack : `/sam intro`

## Notes

- `setup:agent` reste une opération **locale** (ou CI one-shot) : elle crée les IDs Anthropic à copier dans les secrets du déployeur.
- Si la session est bloquée (tool en attente), vider `SESSION_ID` dans `.env` et relancer `setup:agent`.
