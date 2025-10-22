#!/bin/zsh
# ChittyOS Intelligent CLI
# Unified command interface for ChittyOS development

# ══════════════════════════════════════════════════════════════
# 1. .cc Pattern - Executable Services
# ══════════════════════════════════════════════════════════════

_chitty_cc() {
  local service=$1
  shift
  local cmd=$1
  shift

  local service_dir="$CHITTYOS_SERVICES/$service"
  local service_url="https://$service.chitty.cc"

  # No command = navigate
  if [[ -z "$cmd" ]]; then
    if [[ -d "$service_dir" ]]; then
      cd "$service_dir"
      echo "📁 $service"

      # Show service status
      if [[ -f "package.json" ]]; then
        local version=$(cat package.json | grep '"version"' | cut -d'"' -f4)
        echo "   v$version"
      fi

      # Check if deployed
      if curl -sf "$service_url/health" >/dev/null 2>&1; then
        echo "   🟢 Deployed"
      else
        echo "   ⚪ Local only"
      fi
    else
      echo "❌ Service not found: $service"
    fi
    return
  fi

  # Generic commands (work for all services)
  case "$cmd" in
    dev|d)
      cd "$service_dir" && wrangler dev
      ;;
    deploy|dep)
      cd "$service_dir" && wrangler deploy
      ;;
    logs|l)
      cd "$service_dir" && wrangler tail --format pretty
      ;;
    test|t)
      cd "$service_dir" && npm test
      ;;
    health|h)
      curl -s "$service_url/health" | jq
      ;;
    status|st)
      echo "🔍 $service Status"
      curl -s "$service_url/health" | jq
      wrangler deployments list 2>/dev/null | head -5
      ;;
    *)
      # Service-specific commands
      case "$service" in
        chittysync)
          _sync_cc_commands "$cmd" "$@"
          ;;
        chittyid-worker)
          _id_cc_commands "$cmd" "$@"
          ;;
        chittyauth)
          _auth_cc_commands "$cmd" "$@"
          ;;
        chittyregistry)
          _registry_cc_commands "$cmd" "$@"
          ;;
        chittychat)
          _chat_cc_commands "$cmd" "$@"
          ;;
        chittyrouter)
          _router_cc_commands "$cmd" "$@"
          ;;
        *)
          echo "❌ Unknown command for $service: $cmd"
          echo "Generic commands: dev, deploy, logs, test, health, status"
          ;;
      esac
      ;;
  esac
}

# Service-specific command handlers

_sync_cc_commands() {
  local cmd=$1
  shift

  case "$cmd" in
    topic)
      local topic=$1
      echo "🔄 Syncing topic: $topic"
      curl -sf -X POST "$CHITTYSYNC_URL/api/sync/topic/$topic" \
        -H "Authorization: Bearer $CHITTY_ID_TOKEN" | jq
      ;;
    project)
      local project=$1
      echo "🔄 Syncing project: $project"
      curl -sf -X POST "$CHITTYSYNC_URL/api/sync/project/$project" \
        -H "Authorization: Bearer $CHITTY_ID_TOKEN" | jq
      ;;
    session)
      local session=$1
      echo "🔄 Syncing session: ${session:-current}"
      curl -sf -X POST "$CHITTYSYNC_URL/api/sync/session/${session:-current}" \
        -H "Authorization: Bearer $CHITTY_ID_TOKEN" | jq
      ;;
    all)
      echo "🔄 Syncing all contexts"
      curl -sf -X POST "$CHITTYSYNC_URL/api/sync/all" \
        -H "Authorization: Bearer $CHITTY_ID_TOKEN" | jq
      ;;
    *)
      echo "sync.cc commands: topic, project, session, all"
      ;;
  esac
}

_id_cc_commands() {
  local cmd=$1
  shift

  case "$cmd" in
    mint)
      local entity=$1
      echo "🪙 Minting ChittyID for: $entity"
      curl -sf -X POST "$CHITTYID_URL/v1/mint" \
        -H "Authorization: Bearer $CHITTY_ID_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"entity\": \"$entity\"}" | jq
      ;;
    validate|v)
      local chitty_id=$1
      echo "✅ Validating: $chitty_id"
      curl -sf "$CHITTYID_URL/v1/validate/$chitty_id" \
        -H "Authorization: Bearer $CHITTY_ID_TOKEN" | jq
      ;;
    lookup|l)
      local chitty_id=$1
      echo "🔍 Looking up: $chitty_id"
      curl -sf "$CHITTYID_URL/v1/lookup/$chitty_id" \
        -H "Authorization: Bearer $CHITTY_ID_TOKEN" | jq
      ;;
    *)
      echo "id.cc commands: mint <entity>, validate <id>, lookup <id>"
      ;;
  esac
}

_auth_cc_commands() {
  local cmd=$1
  shift

  case "$cmd" in
    provision|p)
      local target=$1
      echo "🔐 Provisioning auth for: $target"
      curl -sf -X POST "$CHITTYAUTH_URL/api/v1/provision" \
        -H "Authorization: Bearer $CHITTY_ID_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"target\": \"$target\"}" | jq
      ;;
    revoke|r)
      local token=$1
      echo "🚫 Revoking token: $token"
      curl -sf -X POST "$CHITTYAUTH_URL/api/v1/revoke" \
        -H "Authorization: Bearer $CHITTY_ID_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"token\": \"$token\"}" | jq
      ;;
    verify|v)
      local token=$1
      echo "✅ Verifying token: $token"
      curl -sf "$CHITTYAUTH_URL/api/v1/verify" \
        -H "Authorization: Bearer $token" | jq
      ;;
    *)
      echo "auth.cc commands: provision <target>, revoke <token>, verify <token>"
      ;;
  esac
}

_registry_cc_commands() {
  local cmd=$1
  shift

  case "$cmd" in
    register|r)
      local tool=$1
      echo "📝 Registering: $tool"
      curl -sf -X POST "$CHITTYREGISTRY_URL/api/v1/tools" \
        -H "Authorization: Bearer $CHITTY_ID_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"name\": \"$tool\"}" | jq
      ;;
    search|s)
      local query=$*
      echo "🔍 Searching: $query"
      curl -sf "$CHITTYREGISTRY_URL/api/v1/search?q=$(echo $query | jq -sRr @uri)" | jq
      ;;
    list|ls)
      echo "📋 Registry contents:"
      curl -sf "$CHITTYREGISTRY_URL/api/v1/tools" | jq
      ;;
    stats)
      echo "📊 Registry statistics:"
      curl -sf "$CHITTYREGISTRY_URL/api/v1/stats" | jq
      ;;
    *)
      echo "registry.cc commands: register <tool>, search <query>, list, stats"
      ;;
  esac
}

_chat_cc_commands() {
  local cmd=$1
  shift

  case "$cmd" in
    services)
      echo "📊 ChittyChat Platform Services:"
      curl -sf "$CHITTYGATEWAY_URL/api/v1/services" | jq
      ;;
    routes)
      echo "🛣️  ChittyChat Routes:"
      curl -sf "$CHITTYGATEWAY_URL/api/v1/routes" | jq
      ;;
    *)
      echo "chat.cc commands: services, routes, dev, deploy, logs"
      ;;
  esac
}

_router_cc_commands() {
  local cmd=$1
  shift

  case "$cmd" in
    routes)
      echo "🛣️  ChittyRouter Routes:"
      curl -sf "$CHITTYROUTER_URL/api/v1/routes" | jq
      ;;
    ai)
      local query=$*
      echo "🤖 AI Routing Query: $query"
      curl -sf -X POST "$CHITTYROUTER_URL/api/v1/route" \
        -H "Content-Type: application/json" \
        -d "{\"query\": \"$query\"}" | jq
      ;;
    *)
      echo "router.cc commands: routes, ai <query>, dev, deploy, logs"
      ;;
  esac
}

# Service executable functions
chat.cc() { _chitty_cc chittychat "$@"; }
router.cc() { _chitty_cc chittyrouter "$@"; }
registry.cc() { _chitty_cc chittyregistry "$@"; }
id.cc() { _chitty_cc chittyid-worker "$@"; }
auth.cc() { _chitty_cc chittyauth "$@"; }
sync.cc() { _chitty_cc chittysync "$@"; }
mcp.cc() { _chitty_cc chittymcp "$@"; }
gateway.cc() { _chitty_cc chittygateway "$@"; }
canon.cc() { _chitty_cc chittycanon "$@"; }
schema.cc() { _chitty_cc chittyschema "$@"; }
help.cc() { chitty.help; }

# ══════════════════════════════════════════════════════════════
# 2. chit - Git/GitHub with ChittyChat Integration
# ══════════════════════════════════════════════════════════════

unalias chit 2>/dev/null || true
chit() {
  local cmd=$1
  shift

  case "$cmd" in
    commit|c)
      # Git commit with ChittyChat logging
      local message="$*"
      git add -A
      git commit -m "$message"

      # Log to ChittyChat
      _chitty_log "commit" "$message" "$(git rev-parse --short HEAD)"
      ;;

    push|p)
      # Git push with deployment tracking
      local branch=$(git branch --show-current)
      git push origin "$branch" "$@"

      # Track deployment
      _chitty_log "push" "Pushed $branch" "$(git rev-parse --short HEAD)"
      ;;

    pr)
      # Create PR via GitHub CLI
      local description="$*"
      gh pr create --title "$description" --body "🤖 Created via ChittyOS CLI"

      _chitty_log "pr" "$description" "$(git branch --show-current)"
      ;;

    branch|b)
      # Create branch and register session
      local branch_name="$1"
      git checkout -b "$branch_name"

      _chitty_log "branch" "Created $branch_name" ""
      ;;

    status|st)
      # Git status with ChittyChat context
      git status

      # Show ChittyChat session info
      echo ""
      echo "📊 ChittyChat Session:"
      _chitty_session_info
      ;;

    *)
      # Pass through to git
      git "$cmd" "$@"
      ;;
  esac
}

# Log to ChittyChat
_chitty_log() {
  local type=$1
  local message=$2
  local ref=$3

  local log_entry=$(cat <<EOF
{
  "type": "$type",
  "message": "$message",
  "ref": "$ref",
  "timestamp": $(date +%s),
  "pwd": "$(pwd)",
  "branch": "$(git branch --show-current 2>/dev/null || echo 'no-git')"
}
EOF
)

  # Post to ChittyChat sync endpoint
  if [[ -n "$CHITTY_ID_TOKEN" ]]; then
    curl -sf -X POST https://sync.chitty.cc/api/log \
      -H "Authorization: Bearer $CHITTY_ID_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$log_entry" >/dev/null 2>&1 || true
  fi

  # Also log locally
  mkdir -p ~/.chittyos/logs
  echo "$log_entry" >> ~/.chittyos/logs/chit-$(date +%Y%m%d).jsonl
}

_chitty_session_info() {
  if [[ -f ~/.chittyos/session.json ]]; then
    cat ~/.chittyos/session.json | jq -r '"\(.intent // "idle") - \(.duration // 0)s"'
  else
    echo "No active session"
  fi
}

# ══════════════════════════════════════════════════════════════
# 3. chitty - AI Problem-Solving Mode
# ══════════════════════════════════════════════════════════════

chitty() {
  local mode=$1
  shift

  case "$mode" in
    learn)
      _chitty_ai "learn" "$*"
      ;;

    discover)
      _chitty_ai "discover" "$*"
      ;;

    solve)
      _chitty_ai "solve" "$*"
      ;;

    listen)
      _chitty_ai "listen" "$*"
      ;;

    status|validate|health|services)
      # Existing commands (from previous config)
      case "$mode" in
        status)
          /Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/chittychat/orchestration-status.sh
          ;;
        validate)
          /Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/validate-all-services.sh
          ;;
        health)
          echo "🏥 Checking ChittyOS Infrastructure Health..."
          curl -s https://gateway.chitty.cc/health | jq
          ;;
        services)
          echo "📊 ChittyOS Services:"
          curl -s https://registry.chitty.cc/api/v1/services | jq -r '.services[] | select(.status == "active") | "  ✅ \(.name) - \(.host)"'
          ;;
      esac
      ;;

    *)
      # Natural language mode
      _chitty_ai "solve" "$mode $*"
      ;;
  esac
}

_chitty_ai() {
  local mode=$1
  local query=$2

  echo "🧠 ChittyOS AI Mode: $mode"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "Query: $query"
  echo ""

  # Build context
  local context=$(cat <<EOF
{
  "mode": "$mode",
  "query": "$query",
  "pwd": "$(pwd)",
  "git_branch": "$(git branch --show-current 2>/dev/null || echo 'no-git')",
  "timestamp": $(date +%s)
}
EOF
)

  # Call ChittyRouter AI Gateway
  local response=$(curl -sf -X POST https://ai.chitty.cc/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${CHITTY_ID_TOKEN:-demo}" \
    -d "{
      \"model\": \"@cf/meta/llama-3.1-8b-instruct\",
      \"messages\": [
        {
          \"role\": \"system\",
          \"content\": \"You are ChittyOS AI, an expert in the ChittyOS ecosystem. Mode: $mode. Provide actionable solutions.\"
        },
        {
          \"role\": \"user\",
          \"content\": \"$query\\n\\nContext: $(echo $context | jq -c .)\"
        }
      ]
    }" 2>/dev/null)

  if [[ -n "$response" ]]; then
    echo "$response" | jq -r '.choices[0].message.content // .response // "No response"'
  else
    # Fallback: Search registry for similar issues
    echo "🔍 Searching ChittyOS registry..."
    curl -sf "https://registry.chitty.cc/api/v1/search?q=$(echo $query | jq -sRr @uri)&limit=3" | \
      jq -r '.results[]? | "  • \(.name): \(.description)"'

    if [[ $? -ne 0 ]]; then
      echo ""
      echo "💡 Suggestions:"
      echo "  1. Check service health: chitty validate"
      echo "  2. Review logs: wlogs"
      echo "  3. Search docs: https://docs.chitty.cc"
    fi
  fi

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Log the query
  _chitty_log "ai_query" "$mode: $query" ""
}

# ══════════════════════════════════════════════════════════════
# Helper Functions
# ══════════════════════════════════════════════════════════════

# Quick service shortcuts
alias cc.dev='chat.cc && wrangler dev'
alias cc.deploy='chat.cc && wrangler deploy'
alias cc.logs='chat.cc && wrangler tail --format pretty'

alias rtr.dev='router.cc && wrangler dev'
alias rtr.deploy='router.cc && wrangler deploy'
alias rtr.logs='router.cc && wrangler tail --format pretty'

# ChittyOS environment check
chitty.env() {
  echo "🌍 ChittyOS Environment"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "CHITTYOS_ROOT:     $CHITTYOS_ROOT"
  echo "CHITTYOS_SERVICES: $CHITTYOS_SERVICES"
  echo "CHITTYOS_APPS:     $CHITTYOS_APPS"
  echo ""
  echo "Service URLs:"
  echo "  ID:       $CHITTYID_URL"
  echo "  Auth:     $CHITTYAUTH_URL"
  echo "  Registry: $CHITTYREGISTRY_URL"
  echo "  Gateway:  $CHITTYGATEWAY_URL"
  echo "  Sync:     $CHITTYSYNC_URL"
  echo "  Router:   $CHITTYROUTER_URL"
  echo ""
  echo "Cloudflare Account: $CLOUDFLARE_ACCOUNT_ID"
  echo "ChittyID Token:     ${CHITTY_ID_TOKEN:0:20}..."
}

# ══════════════════════════════════════════════════════════════
# Documentation
# ══════════════════════════════════════════════════════════════

chitty.help() {
  cat <<'EOF'
╔══════════════════════════════════════════════════════════════╗
║  ChittyOS Intelligent CLI                                    ║
╚══════════════════════════════════════════════════════════════╝

1. SERVICE NAVIGATION (.cc pattern)

   chat.cc          → Navigate to chittychat
   router.cc        → Navigate to chittyrouter
   registry.cc      → Navigate to chittyregistry
   id.cc            → Navigate to chittyid-worker
   auth.cc          → Navigate to chittyauth
   sync.cc          → Navigate to chittysync
   mcp.cc           → Navigate to chittymcp
   gateway.cc       → Navigate to chittygateway

2. GIT/GITHUB (chit command)

   chit commit "message"    → Git commit + log to ChittyChat
   chit push                → Git push + track deployment
   chit pr "description"    → Create PR + notify
   chit branch name         → Create branch + register session
   chit status              → Status + session info

3. AI PROBLEM-SOLVING (chitty command)

   Explicit modes:
   chitty learn "topic"     → Learn about ChittyOS topics
   chitty discover "query"  → Discover services/tools
   chitty solve "problem"   → Get actionable solutions
   chitty listen "feedback" → Process feedback

   Natural language:
   chitty "why is registry returning 404"
   chitty "how do I add a new service"
   chitty "optimize ai gateway"

4. EXISTING COMMANDS

   chitty status       → Orchestration status
   chitty validate     → Validate all services
   chitty health       → Infrastructure health
   chitty services     → List active services

5. QUICK SHORTCUTS

   cc.dev          → chat.cc + wrangler dev
   cc.deploy       → chat.cc + wrangler deploy
   cc.logs         → chat.cc + wrangler tail

   rtr.dev         → router.cc + wrangler dev
   rtr.deploy      → router.cc + wrangler deploy
   rtr.logs        → router.cc + wrangler tail

6. HELPERS

   chitty.env      → Show environment
   chitty.help     → This help

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Examples:

  # Navigate to service
  $ chat.cc
  📁 chittychat
     v2.0.0
     🟢 Deployed

  # Commit with logging
  $ chit commit "fix langchain handler"
  [main abc123] fix langchain handler
  ✅ Logged to ChittyChat

  # AI problem solving
  $ chitty solve "registry returns 404"
  🧠 ChittyOS AI Mode: solve

  The registry service needs to be deployed...

  Actionable steps:
  1. cd $CHITTYOS_SERVICES/chittyregistry
  2. wrangler deploy
  3. Verify: curl https://registry.chitty.cc/health

EOF
}

echo "✨ ChittyOS Intelligent CLI loaded"
echo "   Type 'help.cc' for usage"
