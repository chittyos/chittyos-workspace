# ChittyOS Terraform Variables
# Configuration for 1Password integrated infrastructure

variable "op_service_account_token" {
  description = "1Password service account token for credential access"
  type        = string
  sensitive   = true
}

variable "environment" {
  description = "Deployment environment (production, staging, development)"
  type        = string
  default     = "production"

  validation {
    condition     = contains(["production", "staging", "development"], var.environment)
    error_message = "Environment must be production, staging, or development."
  }
}

variable "chittyos_version" {
  description = "ChittyOS version to deploy"
  type        = string
  default     = "2.1.0-ai"
}

variable "enable_monitoring" {
  description = "Enable comprehensive monitoring and alerting"
  type        = bool
  default     = true
}

variable "enable_audit_logging" {
  description = "Enable detailed audit logging for compliance"
  type        = bool
  default     = true
}

variable "credential_rotation_enabled" {
  description = "Enable automated credential rotation"
  type        = bool
  default     = true
}

variable "compliance_level" {
  description = "Compliance level for financial services"
  type        = string
  default     = "banking_grade"

  validation {
    condition     = contains(["standard", "enhanced", "banking_grade"], var.compliance_level)
    error_message = "Compliance level must be standard, enhanced, or banking_grade."
  }
}

variable "multi_account_deployment" {
  description = "Deploy across multiple Cloudflare accounts"
  type        = bool
  default     = true
}

variable "foundation_governance_enabled" {
  description = "Enable ChittyFoundation governance controls"
  type        = bool
  default     = true
}

# Account-specific configurations
variable "accounts" {
  description = "ChittyOS account configurations"
  type = map(object({
    name                = string
    worker_limit        = number
    compliance_required = bool
    governance_level    = string
  }))

  default = {
    chittycorp = {
      name                = "ChittyCorp LLC"
      worker_limit        = 100
      compliance_required = true
      governance_level    = "enterprise"
    }
    chittyfoundation = {
      name                = "ChittyFoundation"
      worker_limit        = 100
      compliance_required = true
      governance_level    = "foundation"
    }
    chittyapps = {
      name                = "ChittyApps"
      worker_limit        = 100
      compliance_required = false
      governance_level    = "application"
    }
    furnished_condos = {
      name                = "Furnished-Condos"
      worker_limit        = 100
      compliance_required = true
      governance_level    = "business"
    }
    chittyfinance = {
      name                = "ChittyFinance"
      worker_limit        = 100
      compliance_required = true
      governance_level    = "financial"
    }
  }
}

# Service configurations
variable "services" {
  description = "ChittyOS service configurations"
  type = map(object({
    account             = string
    domain              = string
    ai_enabled          = bool
    kv_namespaces      = list(string)
    secrets_required   = list(string)
  }))

  default = {
    chittyrouter = {
      account           = "chittycorp"
      domain           = "router.chitty.cc"
      ai_enabled       = true
      kv_namespaces    = ["sessions", "routing_state"]
      secrets_required = ["jwt_secret"]
    }
    chittyauth = {
      account           = "chittycorp"
      domain           = "auth.chitty.cc"
      ai_enabled       = false
      kv_namespaces    = ["auth_sessions", "user_data"]
      secrets_required = ["jwt_secret", "signing_key"]
    }
    chittyregistry = {
      account           = "chittycorp"
      domain           = "registry.chitty.cc"
      ai_enabled       = false
      kv_namespaces    = ["service_registry"]
      secrets_required = ["registry_key"]
    }
    chittyledger = {
      account           = "chittyfoundation"
      domain           = "ledger.chitty.cc"
      ai_enabled       = false
      kv_namespaces    = ["transactions", "audit_trail"]
      secrets_required = ["blockchain_key", "signing_key"]
    }
    chittyfinance_banking = {
      account           = "chittyfinance"
      domain           = "api.chittyfinance.com"
      ai_enabled       = true
      kv_namespaces    = ["transactions", "kyc_data", "compliance_logs"]
      secrets_required = ["banking_api_key", "encryption_key", "compliance_key"]
    }
  }
}

# 1Password configuration
variable "onepassword_vaults" {
  description = "1Password vault configurations"
  type = map(object({
    name        = string
    description = string
    type        = string
  }))

  default = {
    production = {
      name        = "ChittyOS Production"
      description = "Production credentials and secrets"
      type        = "private"
    }
    staging = {
      name        = "ChittyOS Staging"
      description = "Staging environment credentials"
      type        = "private"
    }
    secrets = {
      name        = "ChittyOS Secrets"
      description = "Encryption keys and certificates"
      type        = "private"
    }
  }
}

# Monitoring and alerting
variable "monitoring_config" {
  description = "Monitoring and alerting configuration"
  type = object({
    health_check_interval = string
    alert_thresholds = object({
      error_rate      = number
      latency_ms      = number
      availability    = number
    })
    notification_channels = list(string)
  })

  default = {
    health_check_interval = "30s"
    alert_thresholds = {
      error_rate   = 0.05  # 5%
      latency_ms   = 500   # 500ms
      availability = 99.9  # 99.9%
    }
    notification_channels = ["email", "slack", "pagerduty"]
  }
}

# Security configuration
variable "security_config" {
  description = "Security and compliance configuration"
  type = object({
    mfa_required           = bool
    session_timeout_hours  = number
    ip_allowlist_enabled   = bool
    audit_log_retention    = string
    encryption_at_rest     = bool
    encryption_in_transit  = bool
  })

  default = {
    mfa_required           = true
    session_timeout_hours  = 8
    ip_allowlist_enabled   = true
    audit_log_retention    = "7_years"
    encryption_at_rest     = true
    encryption_in_transit  = true
  }
}