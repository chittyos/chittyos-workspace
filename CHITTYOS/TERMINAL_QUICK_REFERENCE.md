# ChittyOS Terminal Quick Reference

**Setup Status**: ✅ Configured
**Configuration File**: `~/.bashrc`
**Setup Script**: `/Users/nb/.claude/projects/-/CHITTYOS/chittyos-terminal-setup.sh`

---

## Activation

```bash
# Reload terminal configuration
source ~/.bashrc

# Or restart your terminal
```

---

## Navigation Aliases

Quick navigation to ChittyOS directories:

```bash
chittyos    # → /Users/nb/.claude/projects/-/CHITTYOS
cs          # → /Users/nb/.claude/projects/-/CHITTYOS/chittyos-services
ca          # → /Users/nb/.claude/projects/-/CHITTYOS/chittyos-apps
cc          # → /Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/chittychat
cr          # → /Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/chittyrouter
creg        # → /Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/chittyregistry
cid         # → /Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/chittyid-worker
cauth       # → /Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/chittyauth
```

---

## ChittyOS Main Command

The `chitty` command is your main interface:

```bash
chitty status      # Show orchestration status (services, projects, todos)
chitty validate    # Validate all 17 services
chitty health      # Check infrastructure health
chitty services    # List all active services
```

### Examples

```bash
# Check system status
$ chitty status
🎯 ChittyChat Orchestration Status
   ✅ Session Orchestrator: RUNNING (PID: 5431)
   📊 Active Sessions: 0
   📁 Discovered Projects: 6
   ...

# Validate all services
$ chitty validate
✅ router (router.chitty.cc) - HTTP 200 - HEALTHY
✅ langchain (langchain.chitty.cc) - HTTP 200 - HEALTHY
...
OPERATIONAL: 17/17 (100%)

# Check infrastructure health
$ chitty health
{
  "status": "healthy",
  "service": "sync",
  "version": "2.0.0"
}

# List services
$ chitty services
  ✅ agents - agents.chitty.cc
  ✅ ai-gateway - ai.chitty.cc
  ✅ langchain - langchain.chitty.cc
  ...
```

---

## Development Helpers

### Start Development Server

```bash
cdev <service-name>

# Examples
cdev chittychat      # Start chittychat dev server
cdev chittyrouter    # Start chittyrouter dev server
cdev chittyregistry  # Start chittyregistry dev server
```

### Deploy to Production

```bash
cdeploy <service-name>

# Examples
cdeploy chittychat      # Deploy chittychat to production
cdeploy chittyrouter    # Deploy chittyrouter to production
```

### Check Service Health

```bash
chealth <service-name>

# Examples
chealth langchain    # Check langchain.chitty.cc/health
chealth auth         # Check auth.chitty.cc/health
chealth mcp          # Check mcp.chitty.cc/health
```

**Output Example**:
```json
{
  "status": "healthy",
  "service": "langchain",
  "version": "1.0.0",
  "provider": "cloudflare-ai",
  "model": "@cf/meta/llama-3.1-8b-instruct"
}
```

---

## Wrangler Shortcuts

Quick aliases for common wrangler commands:

```bash
wdev       # wrangler dev
wdeploy    # wrangler deploy
wtail      # wrangler tail
wlogs      # wrangler tail --format pretty
```

### Usage

```bash
# Navigate to service
cc  # Go to chittychat

# Start dev server
wdev

# Deploy
wdeploy

# Watch logs
wlogs
```

---

## Legacy Aliases

Validation and health check scripts:

```bash
chittycheck      # Run ChittyCheck compliance validation
chittyhealth     # Run project health check
chittystatus     # Show orchestration status (same as chitty status)
chittyvalidate   # Validate all services (same as chitty validate)
```

---

## Environment Variables

Automatically configured:

```bash
# Paths
$CHITTYOS_ROOT         # /Users/nb/.claude/projects/-/CHITTYOS
$CHITTYOS_SERVICES     # $CHITTYOS_ROOT/chittyos-services
$CHITTYOS_APPS         # $CHITTYOS_ROOT/chittyos-apps

# Service URLs
$CHITTYID_URL          # https://id.chitty.cc
$CHITTYAUTH_URL        # https://auth.chitty.cc
$CHITTYREGISTRY_URL    # https://registry.chitty.cc
$CHITTYGATEWAY_URL     # https://gateway.chitty.cc
$CHITTYSYNC_URL        # https://sync.chitty.cc
$CHITTYROUTER_URL      # https://router.chitty.cc
$CHITTYCANON_URL       # https://canon.chitty.cc
$CHITTYSCHEMA_URL      # https://schema.chitty.cc

# Cloudflare
$CLOUDFLARE_ACCOUNT_ID # 0bc21e3a5a9de1a4cc843be9c3e98121
$CHITTYOS_ACCOUNT_ID   # 0bc21e3a5a9de1a4cc843be9c3e98121
```

### Usage

```bash
# Use in commands
curl $CHITTYID_URL/health

# Reference in scripts
wrangler deploy --account-id $CLOUDFLARE_ACCOUNT_ID
```

---

## Common Workflows

### 1. Check System Status

```bash
chitty status
```

### 2. Develop a Service

```bash
# Navigate
cc  # or cr, creg, etc.

# Start dev
wdev

# In another terminal, check health
chealth chittychat
```

### 3. Deploy a Service

```bash
# Navigate
cc

# Deploy
wdeploy

# Verify
chitty validate
```

### 4. Debug a Service

```bash
# Check health
chealth langchain

# Watch logs
cc && wlogs

# Check registry
chitty services
```

### 5. Validate Infrastructure

```bash
# Full validation
chitty validate

# Check specific service
chealth mcp

# View orchestration status
chitty status
```

---

## Tips & Tricks

### Quick Service Check

```bash
# Check all services
for s in router canon schema registry id auth sync gateway ai-gateway langchain mcp api beacon chat; do
  echo "$s: $(curl -s -o /dev/null -w '%{http_code}' https://$s.chitty.cc/health)"
done
```

### Watch Orchestrator Logs

```bash
tail -f /Users/nb/.claude/.chittyos/orchestrator.log
```

### Jump and Deploy

```bash
cc && wdeploy  # Navigate to chittychat and deploy
cr && wdev     # Navigate to chittyrouter and start dev
```

### Service URLs

```bash
# Print all service URLs
env | grep _URL | sort
```

---

## Troubleshooting

### Configuration Not Working?

```bash
# Reload configuration
source ~/.bashrc

# Check if configuration exists
grep "ChittyOS Terminal Configuration" ~/.bashrc

# Reinstall
/Users/nb/.claude/projects/-/CHITTYOS/chittyos-terminal-setup.sh
```

### Command Not Found?

Make sure you've activated the configuration:
```bash
source ~/.bashrc
```

### Path Issues?

Verify environment variables are set:
```bash
echo $CHITTYOS_ROOT
echo $CHITTYOS_SERVICES
```

---

## Additional Resources

- **Validation Report**: `/Users/nb/.claude/projects/-/CHITTYOS/SERVICE_VALIDATION_REPORT.md`
- **Validation Script**: `/Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/validate-all-services.sh`
- **Orchestration Status**: `/Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/chittychat/orchestration-status.sh`
- **ChittyCheck**: `/Users/nb/.claude/projects/-/chittychat/chittycheck-enhanced.sh`

---

**Last Updated**: 2025-10-22
**Setup Version**: 1.0.0
**ChittyOS Version**: 1.0.1
