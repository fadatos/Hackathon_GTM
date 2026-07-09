# NOTES API — Hackathon Agentic GTM (à remplir au kickoff)

## Sillage

| Champ | Valeur |
|-------|--------|
| Base URL | `https://api.getsillage.com/api/v1` |
| Auth | Bearer `SILLAGE_API_KEY` |
| MCP officiel hackathon | ☐ Oui URL: _____________ ☐ Non → wrapper local `mcp/sillage` port 3101 |
| Bulk accounts | `POST /accounts/bulk` (à confirmer) |
| Personas | `POST /personas` (à confirmer) |
| Signal agents | `POST /signal-agents` (à confirmer) |
| Leads / signaux | `GET /leads?icp=&max_age_days=7` (à confirmer) |
| Stats signaux | `GET /signals/stats?icp=` (à confirmer) |
| Rate limit | _____________ |
| Exemple payload lead | voir `demo/sillage-leads.json` |

## FullEnrich

| Champ | Valeur |
|-------|--------|
| Base URL | `https://app.fullenrich.com/api/v1` |
| Auth | Bearer `FULLENRICH_API_KEY` |
| Enrich endpoint | `POST /contact/enrich` (à confirmer) |
| MCP officiel | ☐ Oui URL: _____________ ☐ Non → wrapper local port 3102 |

## Anthropic Managed Agents

| Champ | Valeur |
|-------|--------|
| Beta header | `managed-agents-2026-04-01` |
| Model recommandé | _____________ |
| Agent ID | (après `npm run setup:agent`) |
| Environment ID | (après setup) |
| Vault ID | (après setup credentials) |

## Gamma (bonus)

| Champ | Valeur |
|-------|--------|
| API Key | _____________ |
| Endpoint | _____________ |
