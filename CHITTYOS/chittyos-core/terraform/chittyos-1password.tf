# ChittyOS 1Password Terraform Integration
# Infrastructure as Code for secure credential management

terraform {
  required_providers {
    onepassword = {
      source  = "1password/onepassword"
      version = "~> 2.1.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

# Configure 1Password provider with service account
provider "onepassword" {
  service_account_token = var.op_service_account_token
}

# Configure Cloudflare providers for each account
provider "cloudflare" {
  alias     = "chittycorp"
  api_token = data.onepassword_item.chittycorp_credentials.credential
}

provider "cloudflare" {
  alias     = "foundation"
  api_token = data.onepassword_item.foundation_credentials.credential
}

provider "cloudflare" {
  alias     = "apps"
  api_token = data.onepassword_item.apps_credentials.credential
}

provider "cloudflare" {
  alias     = "furnished_condos"
  api_token = data.onepassword_item.furnished_condos_credentials.credential
}

provider "cloudflare" {
  alias     = "finance"
  api_token = data.onepassword_item.finance_credentials.credential
}

# Data sources for 1Password credentials
data "onepassword_vault" "chittyos_production" {
  name = "ChittyOS Production"
}

data "onepassword_item" "chittycorp_credentials" {
  vault = data.onepassword_vault.chittyos_production.uuid
  title = "ChittyCorp LLC"
}

data "onepassword_item" "foundation_credentials" {
  vault = data.onepassword_vault.chittyos_production.uuid
  title = "ChittyFoundation"
}

data "onepassword_item" "apps_credentials" {
  vault = data.onepassword_vault.chittyos_production.uuid
  title = "ChittyApps"
}

data "onepassword_item" "furnished_condos_credentials" {
  vault = data.onepassword_vault.chittyos_production.uuid
  title = "Furnished-Condos"
}

data "onepassword_item" "finance_credentials" {
  vault = data.onepassword_vault.chittyos_production.uuid
  title = "ChittyFinance"
}

# ChittyCorp LLC Infrastructure
resource "cloudflare_workers_script" "chittyrouter" {
  provider            = cloudflare.chittycorp
  account_id          = data.onepassword_item.chittycorp_credentials.section[0].field[0].value
  name                = "chittyrouter"
  content             = file("../chittyos/services/chittyrouter/src/index.js")
  compatibility_date  = "2024-09-10"
  compatibility_flags = ["nodejs_compat"]

  plain_text_binding {
    name = "SERVICE_NAME"
    text = "chittyrouter"
  }

  plain_text_binding {
    name = "ACCOUNT_TYPE"
    text = "chittycorp"
  }

  plain_text_binding {
    name = "SERVICE_VERSION"
    text = "2.1.0-ai"
  }

  kv_namespace_binding {
    name         = "SESSIONS"
    namespace_id = cloudflare_workers_kv_namespace.chittyrouter_sessions.id
  }

  kv_namespace_binding {
    name         = "ROUTING_STATE"
    namespace_id = cloudflare_workers_kv_namespace.chittyrouter_routing.id
  }

  # AI binding for Workers AI
  ai_binding {
    name = "AI"
  }
}

resource "cloudflare_workers_kv_namespace" "chittyrouter_sessions" {
  provider   = cloudflare.chittycorp
  account_id = data.onepassword_item.chittycorp_credentials.section[0].field[0].value
  title      = "chittyrouter-sessions"
}

resource "cloudflare_workers_kv_namespace" "chittyrouter_routing" {
  provider   = cloudflare.chittycorp
  account_id = data.onepassword_item.chittycorp_credentials.section[0].field[0].value
  title      = "chittyrouter-routing-state"
}

resource "cloudflare_worker_route" "chittyrouter" {
  provider   = cloudflare.chittycorp
  zone_id    = data.onepassword_item.chittycorp_credentials.section[0].field[1].value
  pattern    = "router.chitty.cc/*"
  script_name = cloudflare_workers_script.chittyrouter.name
}

# ChittyAuth Service
resource "cloudflare_workers_script" "chittyauth" {
  provider            = cloudflare.chittycorp
  account_id          = data.onepassword_item.chittycorp_credentials.section[0].field[0].value
  name                = "chittyauth"
  content             = templatefile("../chittyos/services/chittyauth/src/index.js", {
    jwt_secret = data.onepassword_item.encryption_keys.credential
  })
  compatibility_date  = "2024-09-10"

  plain_text_binding {
    name = "SERVICE_NAME"
    text = "chittyauth"
  }

  secret_text_binding {
    name = "JWT_SECRET"
    text = data.onepassword_item.encryption_keys.credential
  }

  secret_text_binding {
    name = "CHITTY_ID_SIGNING_KEY"
    text = data.onepassword_item.signing_keys.credential
  }
}

resource "cloudflare_worker_route" "chittyauth" {
  provider   = cloudflare.chittycorp
  zone_id    = data.onepassword_item.chittycorp_credentials.section[0].field[1].value
  pattern    = "auth.chitty.cc/*"
  script_name = cloudflare_workers_script.chittyauth.name
}

# ChittyFoundation Services
resource "cloudflare_workers_script" "chittyledger" {
  provider            = cloudflare.foundation
  account_id          = data.onepassword_item.foundation_credentials.section[0].field[0].value
  name                = "chittyledger"
  content             = file("../chittyos/services/chittyledger/src/index.js")
  compatibility_date  = "2024-09-10"

  plain_text_binding {
    name = "SERVICE_NAME"
    text = "chittyledger"
  }

  plain_text_binding {
    name = "ACCOUNT_TYPE"
    text = "chittyfoundation"
  }

  secret_text_binding {
    name = "BLOCKCHAIN_PRIVATE_KEY"
    text = data.onepassword_item.blockchain_keys.credential
  }
}

# ChittyFinance Services
resource "cloudflare_workers_script" "chittyfinance_banking" {
  provider            = cloudflare.finance
  account_id          = data.onepassword_item.finance_credentials.section[0].field[0].value
  name                = "chittyfinance-banking"
  content             = file("../chittyos/services/chittyfinance/banking/src/index.js")
  compatibility_date  = "2024-09-10"

  plain_text_binding {
    name = "SERVICE_NAME"
    text = "chittyfinance-banking"
  }

  plain_text_binding {
    name = "COMPLIANCE_LEVEL"
    text = "banking_grade"
  }

  secret_text_binding {
    name = "BANKING_API_KEY"
    text = data.onepassword_item.banking_credentials.credential
  }

  secret_text_binding {
    name = "ENCRYPTION_KEY"
    text = data.onepassword_item.finance_encryption.credential
  }
}

# 1Password credential rotation automation
resource "onepassword_item" "credential_rotation_schedule" {
  vault    = data.onepassword_vault.chittyos_production.uuid
  title    = "Credential Rotation Schedule"
  category = "secure_note"

  section {
    label = "Rotation Configuration"

    field {
      label = "cloudflare_tokens_rotation_days"
      type  = "STRING"
      value = "90"
    }

    field {
      label = "database_credentials_rotation_days"
      type  = "STRING"
      value = "30"
    }

    field {
      label = "signing_keys_rotation_days"
      type  = "STRING"
      value = "180"
    }

    field {
      label = "last_rotation_timestamp"
      type  = "STRING"
      value = timestamp()
    }
  }
}

# Events API integration for monitoring
data "onepassword_item" "events_api_credentials" {
  vault = data.onepassword_vault.chittyos_production.uuid
  title = "1Password Events API"
}

# Watchtower integration for security monitoring
resource "onepassword_item" "watchtower_config" {
  vault    = data.onepassword_vault.chittyos_production.uuid
  title    = "Watchtower Security Configuration"
  category = "secure_note"

  section {
    label = "Security Monitoring"

    field {
      label = "breach_monitoring_enabled"
      type  = "STRING"
      value = "true"
    }

    field {
      label = "vulnerable_password_alerts"
      type  = "STRING"
      value = "true"
    }

    field {
      label = "2fa_enforcement"
      type  = "STRING"
      value = "required"
    }
  }
}

# Output sensitive information (not displayed in logs)
output "chittycorp_account_id" {
  value     = data.onepassword_item.chittycorp_credentials.section[0].field[0].value
  sensitive = true
}

output "deployment_status" {
  value = "ChittyOS infrastructure deployed with 1Password credential management"
}

# Variables
variable "op_service_account_token" {
  description = "1Password service account token"
  type        = string
  sensitive   = true
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "production"
}

# Data sources for encryption keys
data "onepassword_item" "encryption_keys" {
  vault = data.onepassword_vault.chittyos_production.uuid
  title = "ChittyOS Encryption Keys"
}

data "onepassword_item" "signing_keys" {
  vault = data.onepassword_vault.chittyos_production.uuid
  title = "ChittyID Signing Keys"
}

data "onepassword_item" "blockchain_keys" {
  vault = data.onepassword_vault.chittyos_production.uuid
  title = "ChittyChain Blockchain Keys"
}

data "onepassword_item" "banking_credentials" {
  vault = data.onepassword_vault.chittyos_production.uuid
  title = "Banking API Credentials"
}

data "onepassword_item" "finance_encryption" {
  vault = data.onepassword_vault.chittyos_production.uuid
  title = "ChittyFinance Encryption Keys"
}