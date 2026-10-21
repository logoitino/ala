# Private Blob recovery is independent of an optional single app VM. Upload access requires named identity/range.
variable "subscription_id" { type = string }
variable "location" {
  type    = string
  default = "westus2"
}
variable "name" {
  type    = string
  default = "tapuai-recovery"
}
variable "environment" {
  type    = string
  default = "recovery"
}
variable "storage_account_name" {
  type = string
  validation {
    condition     = can(regex("^[a-z0-9]{3,24}$", var.storage_account_name))
    error_message = "Use 3-24 lowercase letters/digits for globally unique account."
  }
}
variable "backup_writer_object_id" { type = string }
variable "recovery_reader_object_id" { type = string }
variable "backup_ipv4_ranges" {
  type    = list(string)
  default = []
  validation {
    # IPv4 netmasks exclude IPv6 and catch noncanonical /0; appending /32 admits only bare IPv4 addresses.
    condition     = alltrue([for cidr in var.backup_ipv4_ranges : (can(cidrnetmask(cidr)) && try(cidrnetmask(cidr) != "0.0.0.0", false)) || can(cidrnetmask("${cidr}/32"))])
    error_message = "Use explicit operator IPv4 ranges or addresses; every /0 spelling and IPv6 are refused."
  }
}
variable "retention_days" {
  type    = number
  default = 90
  validation {
    condition     = var.retention_days >= 35
    error_message = "Recovery retention must be at least 35 days."
  }
}
variable "replication_type" {
  type    = string
  default = "GRS"
  validation {
    condition     = contains(["LRS", "ZRS", "GRS", "GZRS"], var.replication_type)
    error_message = "Select a region-supported standard replication option."
  }
}
variable "enable_vm" {
  type    = bool
  default = false
}
variable "vm_size" {
  type    = string
  default = "Standard_D2s_v5"
}
variable "ssh_public_key" {
  type    = string
  default = ""
}
variable "admin_ipv4_cidrs" {
  type    = list(string)
  default = []
  validation {
    # Reject normalized wildcard masks rather than one spelling, with no implicit IPv6 allowance.
    condition     = alltrue([for cidr in var.admin_ipv4_cidrs : can(cidrnetmask(cidr)) && try(cidrnetmask(cidr) != "0.0.0.0", false)])
    error_message = "SSH requires explicit operator IPv4 ranges; every /0 spelling and IPv6 are refused."
  }
}
