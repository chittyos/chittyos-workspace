---
name: terminology-research-required
enabled: true
event: file
action: warn
conditions:
  - field: file_path
    operator: regex_match
    pattern: (migrations/|src/pipelines/|wrangler\.toml|src/services/svc-)
  - field: new_text
    operator: regex_match
    pattern: (name|pipeline|service|stage|phase|workflow|process).*[:=]
---

## Terminology Research Required

You're creating or modifying a file that may introduce **new terminology**.

### Before naming anything, you MUST:

1. **Research industry standards** for this domain
   - Legal/eDiscovery: Check EDRM (edrm.net)
   - Database: Check SQL standards
   - API: Check OpenAPI conventions
   - Security: Check NIST/OWASP terminology

2. **Check ChittyCanon** for existing certified terms
   ```bash
   curl https://canon.chitty.cc/api/terms?domain=legal
   ```

3. **If no certified term exists**, propose to ChittyCanon:
   ```bash
   chitty submit term -n <term_name> -d "<definition>" --domain <domain> -g "<gap_this_fills>"
   ```

### Recent Lesson Learned
You renamed "consideration" → "collection" and "intake" → "preservation" after discovering EDRM is the industry standard for legal evidence processing.

**Don't make up terminology. Research first.**

### EDRM Reference (Legal/Evidence)
Collection → Culling → Preservation → Processing → Review → Analysis → Production
