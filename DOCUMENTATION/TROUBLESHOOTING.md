# ChittyOS Troubleshooting

**Common issues and solutions.**

---

## ChittyID Issues

### Token Not Found
```bash
# Check token exists
echo $CHITTY_ID_TOKEN

# If empty, load environment
source ~/.env

# Validate token
curl -H "Authorization: Bearer $CHITTY_ID_TOKEN" https://id.chitty.cc/health
```

### Local Generation Blocked
```bash
# ChittyCheck blocks local ID generation
/chittycheck

# Use official service
curl -X POST https://id.chitty.cc/v1/mint \
  -H "Authorization: Bearer $CHITTY_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"entity_type": "PROP"}'
```

---

## Service Connectivity

### Check All Services
```bash
/health

# Or manually
curl https://id.chitty.cc/health
curl https://registry.chitty.cc/health
curl https://gateway.chitty.cc/health
curl https://router.chitty.cc/health
curl https://schema.chitty.cc/health
```

### Service Timeout
- Verify Cloudflare Workers status
- Check account ID: `bbf9fcd845e78035b7a135c481e88541`
- Review Wrangler logs: `wrangler tail <worker-name>`

---

## Session Management

### Session Conflicts
```bash
# Load session management
/project

# Check git worktree status
git worktree list

# View session status
/status

# Remove stale worktrees
git worktree prune
```

### Cross-Session Sync Issues
```bash
# Check sync status
/sync status

# Restart sync
/sync stop
/sync start

# Manual sync
cd ~/.chittychat/ && git pull
```

---

## Build & Deployment Issues

### Build Failures
```bash
# Clean build artifacts
/clean

# Reinstall dependencies
cd chittychat/ && rm -rf node_modules && npm install

# Run validation
/chittycheck
```

### Deployment Failures
```bash
# Check Cloudflare auth
npx wrangler whoami

# Verify account ID
echo $CLOUDFLARE_ACCOUNT_ID  # Should be bbf9fcd845e78035b7a135c481e88541

# Check wrangler.toml
cat chittychat/wrangler.optimized.toml | grep account_id
```

### Test Failures
```bash
# Run specific test suite
cd chittyrouter/ && npm run test:unit
cd chittyschema/ && npm run test:security

# Check test environment
echo $NODE_ENV  # Should be 'test'

# Clear test cache
rm -rf .jest_cache coverage/
```

---

## Database Issues

### PostgreSQL Connection
```bash
# Check database URL
echo $NEON_DATABASE_URL | grep -o '^[^:]*'  # Should show 'postgresql'

# Test connection
cd chittyschema/
npm run db:studio  # Opens Drizzle Studio
```

### Schema Migrations
```bash
# Push schema changes
cd chittyschema/
npm run db:push

# Reset database (DANGER)
npm run db:reset
```

---

## Environment Issues

### Missing Variables
```bash
# Check required vars
env | grep CHITTY

# Should see:
# CHITTY_ID_TOKEN
# CHITTYOS_ACCOUNT_ID
# CHITTYID_SERVICE
# REGISTRY_SERVICE
# GATEWAY_SERVICE
```

### 1Password Integration
```bash
# Check 1Password CLI
op whoami

# Sign in if needed
eval $(op signin)

# Load secrets
op run --env-file=.env.op -- npm run deploy
```

---

## Git Issues

### Untracked Files
```bash
# Should see minimal untracked files after optimization
git status --short | wc -l  # Target: <50

# If too many, check .gitignore
cat .gitignore | grep -E "^(CHITTYFOUNDATION|CHITTYCORP|CHITTYAPPS)"
```

### Submodule Issues
```bash
# Check submodule status
git submodule status

# Update submodules
git submodule update --init --recursive

# Fix detached HEAD
cd chittyrouter/ && git checkout main
```

---

## Performance Issues

### Slow Glob/Grep
```bash
# Check for large node_modules
find . -name "node_modules" -type d | wc -l

# Clean old modules
find CHITTYOS/ -name "node_modules" -mtime +90 -type d -exec rm -rf {} \;
```

### High Token Usage
- Archived completion docs: `ls CHITTYOS/.archive/2025/`
- Reduced CLAUDE.md: `wc -l CLAUDE_CORE.md` (should be ~170)
- Clean git status: `git status --short | wc -l` (should be <50)

---

## macOS Integration Issues

### Permission Errors
- **Full Disk Access**: System Preferences → Security & Privacy
- **Accessibility**: Required for automation scripts
- **Network**: Required for ChittyOS service communication

### Storage Daemon
```bash
# Check daemon status
~/bin/chittycleaner status

# View logs
~/bin/chittycleaner logs

# Restart daemon
~/bin/chittycleaner restart
```

---

## Getting Help

1. **Check service status**: `/health`
2. **Run compliance check**: `/chittycheck --qa`
3. **Review logs**: `~/.chittychat/compliance/`
4. **Consult service docs**: `DOCUMENTATION/services/<service>.md`
5. **Check git history**: Recent changes may have broken things

---

## Emergency Recovery

### Reset to Clean State
```bash
# WARNING: This resets everything

# 1. Stash changes
git stash save "emergency_backup_$(date +%Y%m%d_%H%M%S)"

# 2. Reset to last commit
git reset --hard HEAD

# 3. Clean untracked files (review first!)
git clean -fdx

# 4. Validate
/chittycheck
```

### Recover Archived Docs
```bash
# All archived docs preserved
ls CHITTYOS/.archive/2025/

# Restore specific doc
cp CHITTYOS/.archive/2025/SOME_SUMMARY.md ./
```
