---
name: naming-compliance-check
enabled: true
event: stop
pattern: .*
---

## Pre-Completion Naming Audit

Before stopping, verify terminology compliance:

- [ ] **New names use industry standards** (not invented terms)
- [ ] **EDRM terms** for evidence/legal: Collection, Preservation, Processing, Review, Analysis, Production
- [ ] **OAuth terms** for auth: token, grant, scope, client, authorization
- [ ] **Code comments include standard reference URL**
- [ ] **ChittyCanon checked** for existing terms

If you introduced new terminology without researching standards, **GO BACK** and fix it now.

Reference: CLAUDE.md "Terminology Research Protocol"
