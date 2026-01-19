---
name: require-terminology-research
enabled: true
event: file
conditions:
  - field: file_path
    operator: regex_match
    pattern: (wrangler\.toml|package\.json|.*\.ts|.*\.sql)$
  - field: new_text
    operator: regex_match
    pattern: (pipeline|stream|sink|service|endpoint|route|queue|worker|handler|event|stage)\s*[=:]\s*["']?\w+
---

## Terminology Research Protocol (MANDATORY)

**STOP** - Before naming this component, you MUST:

1. **Research industry standards** for this domain:
   - Legal/Evidence: **EDRM** (https://edrm.net/resources/frameworks-and-standards/edrm-model/)
   - Archives: **OAIS**
   - Auth: **OAuth 2.0 / OIDC**
   - APIs: **OpenAPI** conventions

2. **Check ChittyCanon** for existing terms:
   ```bash
   curl -s "https://canon.chitty.cc/api/terms" | jq '.terms[].name'
   ```

3. **Use established terms** - Do NOT invent new terminology

4. **Document the standard** in code comments with reference URL

**Bad**: `consideration`, `intake` (made up)
**Good**: `collection`, `preservation` (EDRM standard)

See: CLAUDE.md "Terminology Research Protocol" section
ChittyCanon term_id: `5ec80579-5cac-4c3a-ab24-9fad54769838`
