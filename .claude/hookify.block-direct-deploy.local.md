---
name: block-direct-deploy
enabled: true
event: bash
action: block
pattern: wrangler\s+(deploy|publish)
---

## BLOCKED: Direct Deployment Not Allowed

You attempted to run `wrangler deploy` directly.

**All deployments must go through CI/CD:**

1. Commit your changes
2. Push to your branch
3. Create/update PR
4. CI/CD deploys after merge

**You do NOT have permission to deploy directly.**

If this is urgent, tell the user: "I need to deploy but am blocked. Please run `wrangler deploy` manually if this is intentional."
