---
name: canon-certification-gate
enabled: true
event: file
action: block
conditions:
  - field: file_path
    operator: regex_match
    pattern: (wrangler\.toml|package\.json|src/.*\.ts|migrations/.*\.sql)$
  - field: new_text
    operator: regex_match
    pattern: (name|pipeline|stream|sink|binding|table|type|interface|class|function|const)\s*[=:]\s*["'`]?[a-z]+_[a-z]+
---

## BLOCKED: Uncertified Terminology Detected

New naming pattern detected. ChittyCanon certification required.

**To verify this term is certified, the USER must run:**

```bash
./scripts/canon-verify.sh <term_name>
```

**Example:**
```bash
./scripts/canon-verify.sh evidence_collection
```

**If certified:** User tells Claude "term is certified, proceed"
**If not certified:** Propose to ChittyCanon first:
```bash
curl -X POST "https://canon.chitty.cc/api/terms/propose" \
  -H "Content-Type: application/json" \
  -d '{"name": "<term>", "definition": "...", "domain": [...], "category": "core_type", "proposer": "...", "service": "..."}'
```

**This block cannot be bypassed by Claude.** Only user verification unlocks it.
