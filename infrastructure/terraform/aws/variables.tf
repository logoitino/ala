# Independent backup destination is always created; a single application host is optional and disabled by default.
variable "region" {
  type    = string
  default = "us-west-2"
}
variable "environment" {
  type    = string
  default = "recovery"
}
variable "name" {
  type    = string
  default = "tapuai-recovery"
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,35}$", var.name))
    error_message = "Use 3-36 lowercase letters/digits/hyphens."
  }
}
variable "backup_bucket_name" {
  type = string
}
variable "backup_writer_principal_arn" {
  type = string
}
variable "recovery_principal_arn" {
  type = string
}
variable "retention_days" {
  type    = number
  default = 90
  validation {
    condition     = var.retention_days >= 35
    error_message = "Recovery retention must be at least 35 days."
  }
}
variable "enable_vm" {
  type    = bool
  default = false
}
variable "instance_type" {
  type    = string
  default = "t3.large"
}
variable "admin_ipv4_cidrs" {
  type    = list(string)
  default = []
  validation {
    # Canonical masks catch host-bit /0 spellings; cidrnetmask also refuses IPv6 in this IPv4-only list.
    condition     = alltrue([for cidr in var.admin_ipv4_cidrs : can(cidrnetmask(cidr)) && try(cidrnetmask(cidr) != "0.0.0.0", false)])
    error_message = "SSH requires explicit IPv4 operator ranges; every /0 spelling and IPv6 are refused."
  }
}
variable "ssh_key_name" {
  type     = string
  default  = null
  nullable = true
}
