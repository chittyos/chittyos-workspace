#!/bin/bash

# ChittyOS Terminal Setup
# Configures your terminal for optimal ChittyOS development

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ChittyOS Terminal Setup                                     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Detect shell
SHELL_TYPE="bash"
if [ -n "$ZSH_VERSION" ]; then
  SHELL_TYPE="zsh"
  SHELL_RC="$HOME/.zshrc"
elif [ -n "$BASH_VERSION" ]; then
  SHELL_TYPE="bash"
  SHELL_RC="$HOME/.bashrc"
else
  SHELL_RC="$HOME/.profile"
fi

echo "Detected shell: $SHELL_TYPE"
echo "Configuration file: $SHELL_RC"
echo ""

# ChittyOS environment configuration
CHITTYOS_CONFIG="
# ══════════════════════════════════════════════════════════════
# ChittyOS Terminal Configuration
# ══════════════════════════════════════════════════════════════

# ChittyOS Paths
export CHITTYOS_ROOT=\"/Users/nb/.claude/projects/-/CHITTYOS\"
export CHITTYOS_SERVICES=\"\$CHITTYOS_ROOT/chittyos-services\"
export CHITTYOS_APPS=\"\$CHITTYOS_ROOT/chittyos-apps\"
export CHITTYOS_CORE=\"\$CHITTYOS_ROOT/chittyos-core\"

# ChittyOS Service URLs
export CHITTYID_URL=\"https://id.chitty.cc\"
export CHITTYAUTH_URL=\"https://auth.chitty.cc\"
export CHITTYREGISTRY_URL=\"https://registry.chitty.cc\"
export CHITTYGATEWAY_URL=\"https://gateway.chitty.cc\"
export CHITTYSYNC_URL=\"https://sync.chitty.cc\"
export CHITTYROUTER_URL=\"https://router.chitty.cc\"
export CHITTYCANON_URL=\"https://canon.chitty.cc\"
export CHITTYSCHEMA_URL=\"https://schema.chitty.cc\"

# Cloudflare Account
export CLOUDFLARE_ACCOUNT_ID=\"0bc21e3a5a9de1a4cc843be9c3e98121\"
export CHITTYOS_ACCOUNT_ID=\"0bc21e3a5a9de1a4cc843be9c3e98121\"

# ChittyOS Aliases - Navigation
alias chittyos='cd \$CHITTYOS_ROOT'
alias cs='cd \$CHITTYOS_SERVICES'
alias ca='cd \$CHITTYOS_APPS'
alias cc='cd \$CHITTYOS_SERVICES/chittychat'
alias cr='cd \$CHITTYOS_SERVICES/chittyrouter'
alias creg='cd \$CHITTYOS_SERVICES/chittyregistry'
alias cid='cd \$CHITTYOS_SERVICES/chittyid-worker'
alias cauth='cd \$CHITTYOS_SERVICES/chittyauth'

# ChittyOS Aliases - Services
alias chittycheck='/Users/nb/.claude/projects/-/chittychat/chittycheck-enhanced.sh'
alias chittyhealth='/Users/nb/.claude/projects/-/chittychat/project-health-check.sh'
alias chittystatus='cd /Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/chittychat && ./orchestration-status.sh'
alias chittyvalidate='/Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/validate-all-services.sh'

# ChittyOS Aliases - Development
alias wdev='wrangler dev'
alias wdeploy='wrangler deploy'
alias wtail='wrangler tail'
alias wlogs='wrangler tail --format pretty'

# ChittyOS Functions
chitty() {
  case \"\$1\" in
    status)
      /Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/chittychat/orchestration-status.sh
      ;;
    validate)
      /Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/validate-all-services.sh
      ;;
    health)
      echo \"🏥 Checking ChittyOS Infrastructure Health...\"
      curl -s https://gateway.chitty.cc/health | jq
      ;;
    services)
      echo \"📊 ChittyOS Services:\"
      curl -s https://registry.chitty.cc/api/v1/services | jq -r '.services[] | select(.status == \"active\") | \"  ✅ \\(.name) - \\(.host)\"'
      ;;
    *)
      echo \"ChittyOS Command Line Interface\"
      echo \"\"
      echo \"Usage: chitty <command>\"
      echo \"\"
      echo \"Commands:\"
      echo \"  status    - Show orchestration status\"
      echo \"  validate  - Validate all services\"
      echo \"  health    - Check infrastructure health\"
      echo \"  services  - List all active services\"
      ;;
  esac
}

# ChittyOS Development Helper
cdev() {
  local service=\$1
  if [ -z \"\$service\" ]; then
    echo \"Usage: cdev <service>\"
    echo \"Example: cdev chittychat\"
    return 1
  fi

  cd \"\$CHITTYOS_SERVICES/\$service\" && wrangler dev
}

# ChittyOS Deployment Helper
cdeploy() {
  local service=\$1
  if [ -z \"\$service\" ]; then
    echo \"Usage: cdeploy <service>\"
    echo \"Example: cdeploy chittychat\"
    return 1
  fi

  cd \"\$CHITTYOS_SERVICES/\$service\" && wrangler deploy --env production
}

# ChittyOS Service Health Check
chealth() {
  local service=\$1
  if [ -z \"\$service\" ]; then
    echo \"Usage: chealth <service>\"
    echo \"Example: chealth langchain\"
    return 1
  fi

  curl -s \"https://\$service.chitty.cc/health\" | jq
}

# ChittyOS Terminal Prompt (optional)
# Uncomment to add ChittyOS info to your prompt
# export PS1=\"[ChittyOS] \$PS1\"

# ══════════════════════════════════════════════════════════════
# End ChittyOS Configuration
# ══════════════════════════════════════════════════════════════
"

# Check if already configured
if grep -q "ChittyOS Terminal Configuration" "$SHELL_RC" 2>/dev/null; then
  echo "⚠️  ChittyOS configuration already exists in $SHELL_RC"
  echo ""
  read -p "Do you want to update it? (y/n) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Skipping configuration update"
    exit 0
  fi

  # Remove old configuration
  echo "Removing old configuration..."
  sed -i.bak '/# ChittyOS Terminal Configuration/,/# End ChittyOS Configuration/d' "$SHELL_RC"
fi

# Add configuration
echo "Adding ChittyOS configuration to $SHELL_RC..."
echo "$CHITTYOS_CONFIG" >> "$SHELL_RC"

echo ""
echo "✅ ChittyOS terminal configuration added!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Available Commands:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Navigation Aliases:"
echo "  chittyos   - Go to ChittyOS root"
echo "  cs         - Go to chittyos-services"
echo "  ca         - Go to chittyos-apps"
echo "  cc         - Go to chittychat"
echo "  cr         - Go to chittyrouter"
echo "  creg       - Go to chittyregistry"
echo ""
echo "Service Commands:"
echo "  chitty status     - Show orchestration status"
echo "  chitty validate   - Validate all services"
echo "  chitty health     - Check infrastructure health"
echo "  chitty services   - List active services"
echo ""
echo "Development Helpers:"
echo "  cdev <service>    - Start wrangler dev"
echo "  cdeploy <service> - Deploy to production"
echo "  chealth <service> - Check service health"
echo ""
echo "Wrangler Shortcuts:"
echo "  wdev       - wrangler dev"
echo "  wdeploy    - wrangler deploy"
echo "  wtail      - wrangler tail"
echo "  wlogs      - wrangler tail --format pretty"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "To activate the configuration:"
echo "  source $SHELL_RC"
echo ""
echo "Or restart your terminal"
echo ""
