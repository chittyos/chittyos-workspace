---
name: require-pr-workflow
enabled: true
event: file
action: block
conditions:
  - field: file_path
    operator: regex_match
    pattern: ^(src/|migrations/|wrangler\.toml)
---

## BLOCKED: PR Workflow Required

You're modifying production code. All changes must go through PRs.

**Required workflow:**

1. Create/checkout feature branch (not main)
2. Make changes
3. `git add` and `git commit`
4. `git push` to remote
5. Create PR via `gh pr create`
6. Wait for CI checks
7. Request review if needed

**Before writing this file, confirm:**
- [ ] You're on a feature branch (not main)
- [ ] You've discussed the change with the user
- [ ] You'll commit and PR after this change

Tell user: "I'm about to modify [file]. Should I proceed with PR workflow?"
